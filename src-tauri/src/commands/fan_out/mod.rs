//! Fan-out: render a `CanonicalSkill` into each agent-native target directory.
//!
//! - One-directional (canonical → agent). No reading back; that's Phase 2.
//! - One renderer per supported agent. Each owns its own field-mapping
//!   rules (snake → kebab for Anthropic, split-file for Codex, minimal for
//!   Gemini). See `agent-skills-schema` spec for the mappings.
//!
//! Module layout (decision 3):
//!   fan_out/
//!     mod.rs        — this trait + dispatch + skill_sync_one / skill_sync_all
//!     anthropic.rs  — kebab-case frontmatter, single SKILL.md
//!     codex.rs      — SKILL.md (name + description) + sibling agents/openai.yaml
//!     gemini.rs     — SKILL.md (name + description only)

use crate::commands::canonical_skills::{
    canonical_skills_dir, parse_skill_md, read_sync_meta_v2, read_sync_meta_v2_no_backfill,
    target_key, write_sync_meta_v2, AgentId, CanonicalSkill, LastSyncEntry, SkillScope,
    TargetMode,
};
use crate::paths::normalize_display_path;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub mod anthropic;
pub mod codex;
pub mod gemini;
pub mod generic;

fn try_snapshot(skill_name: &str) -> Option<String> {
    match super::snapshot::commit_skill_changes(skill_name) {
        Ok(hash) => Some(hash),
        Err(e) => {
            eprintln!("[snapshot] warning: {e}");
            None
        }
    }
}

/// Per-target push outcome. Wire format matches `SyncResult` in
/// `src/lib/types/skills.ts`.
///
/// `scope` is the **push destination** (`SkillTarget.scope`), not the
/// canonical master file location — canonical is always global after
/// `scope-model-simplification`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub agent: AgentId,
    pub scope: SkillScope,
    /// Absolute path the renderer wrote to (or attempted to).
    pub target_path: String,
    pub success: bool,
    /// Populated iff `success == false`.
    pub error: Option<String>,
    /// ISO-8601 UTC timestamp of the push attempt. Same value persisted to
    /// `lastSync[targetKey].at` on success. Always set (success or failure)
    /// so the UI can display when the most recent attempt happened.
    pub at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DriftStatus {
    Synced,
    Drifted,
    Missing,
    NoPushHistory,
    ForkedClean,
    ForkedEdited,
    ForkedCanonicalAhead,
    ForkedDiverged,
}

/// Compare an agent-side SKILL.md's semantic hash against a stored `pushed_hash`.
/// Returns the drift status without rendering or writing anything.
///
/// When `last_sync_at` is provided (ISO-8601 UTC), the file's mtime is compared
/// first: if mtime ≤ push timestamp, `Synced` is returned without reading file
/// content. This avoids hash computation for files untouched since the last push.
pub fn check_drift(
    agent_side_path: &Path,
    pushed_hash: Option<&str>,
    last_sync_at: Option<&str>,
    sibling_hashes: &Option<std::collections::BTreeMap<String, String>>,
    canonical_sibling_hashes: Option<&std::collections::BTreeMap<String, String>>,
) -> DriftStatus {
    let Some(pushed) = pushed_hash else {
        return DriftStatus::NoPushHistory;
    };
    let metadata = match fs::metadata(agent_side_path) {
        Ok(m) => m,
        Err(_) => return DriftStatus::Missing,
    };

    // mtime fast-path: only for SKILL.md, not siblings
    let mut skill_md_synced_by_mtime = false;
    if let (Some(at), Ok(mtime)) = (last_sync_at, metadata.modified()) {
        if let Some(push_time) = parse_iso8601_to_system_time(at) {
            if mtime <= push_time {
                skill_md_synced_by_mtime = true;
            }
        }
    }

    let skill_md_drifted = if skill_md_synced_by_mtime {
        false
    } else {
        let content = match fs::read_to_string(agent_side_path) {
            Ok(c) => c,
            Err(_) => return DriftStatus::Missing,
        };
        semantic_hash(&content) != pushed
    };

    if skill_md_drifted {
        return DriftStatus::Drifted;
    }

    // Sibling drift check (skip if no recorded hashes — legacy meta)
    let agent_skill_dir = agent_side_path.parent().unwrap_or(Path::new(""));
    if check_sibling_drift(agent_skill_dir, sibling_hashes) {
        // Three-way: if canonical siblings == agent-side siblings, stale baseline is not real drift
        if let Some(canonical) = canonical_sibling_hashes {
            let agent_current = compute_sibling_hashes(agent_skill_dir);
            if &agent_current == canonical {
                // Canonical and agent match — stale baseline, not real drift
            } else {
                return DriftStatus::Drifted;
            }
        } else {
            return DriftStatus::Drifted;
        }
    }

    DriftStatus::Synced
}

fn classify_fork_status(
    canonical_path: &Path,
    agent_side_path: &Path,
    last_sync_entry: Option<&LastSyncEntry>,
) -> DriftStatus {
    let canonical_raw = match fs::read_to_string(canonical_path) {
        Ok(c) => c,
        Err(_) => return DriftStatus::ForkedEdited,
    };
    let agent_raw = match fs::read_to_string(agent_side_path) {
        Ok(c) => c,
        Err(_) => return DriftStatus::ForkedEdited,
    };
    let canonical_hash = semantic_hash(&canonical_raw);
    let forked_hash = semantic_hash(&agent_raw);

    let Some(entry) = last_sync_entry else {
        return DriftStatus::ForkedEdited;
    };
    let Some(base_snapshot) = entry.base_snapshot.as_deref() else {
        return DriftStatus::ForkedEdited;
    };

    let canonical_matches_base = canonical_hash == base_snapshot;
    let forked_matches_pushed = forked_hash == entry.pushed_hash;

    match (canonical_matches_base, forked_matches_pushed) {
        (true, true) => DriftStatus::ForkedClean,
        (true, false) => DriftStatus::ForkedEdited,
        (false, true) => DriftStatus::ForkedCanonicalAhead,
        (false, false) => DriftStatus::ForkedDiverged,
    }
}

/// Compute raw SHA-256 hashes for all sibling files in a skill directory.
/// Excludes SKILL.md and .felina-sync-meta.json. Returns a BTreeMap with
/// forward-slash relative paths as keys and hex SHA-256 as values.
pub(crate) fn compute_sibling_hashes(
    skill_dir: &Path,
) -> std::collections::BTreeMap<String, String> {
    let mut map = std::collections::BTreeMap::new();
    collect_sibling_hashes(skill_dir, skill_dir, &mut map);
    map
}

fn collect_sibling_hashes(
    root: &Path,
    dir: &Path,
    map: &mut std::collections::BTreeMap<String, String>,
) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if dir == root && (name_str == "SKILL.md" || name_str == ".felina-sync-meta.json") {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            collect_sibling_hashes(root, &path, map);
        } else if path.is_file() {
            let rel = path
                .strip_prefix(root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            if let Ok(raw) = fs::read(&path) {
                let data = if let Ok(text) = std::str::from_utf8(&raw) {
                    normalize_line_endings(text).into_bytes()
                } else {
                    raw
                };
                let hash = sha256_hex_bytes(&data);
                map.insert(rel, hash);
            }
        }
    }
}

fn sha256_hex_bytes(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    format!("{:x}", hasher.finalize())
}

/// Check whether agent-side sibling files have drifted from the recorded hashes.
/// Returns true if any sibling was added, deleted, or modified.
/// `None` = legacy meta (no field) → skip comparison (no false positives).
/// `Some(map)` = compare current agent-side siblings against recorded map.
fn check_sibling_drift(
    agent_skill_dir: &Path,
    sibling_hashes: &Option<std::collections::BTreeMap<String, String>>,
) -> bool {
    let Some(recorded) = sibling_hashes else {
        return false;
    };
    let current = compute_sibling_hashes(agent_skill_dir);
    current != *recorded
}

fn parse_iso8601_to_system_time(s: &str) -> Option<std::time::SystemTime> {
    // Parse "YYYY-MM-DDTHH:MM:SSZ" format produced by current_iso8601().
    if s.len() != 20 || !s.ends_with('Z') {
        return None;
    }
    let year: i64 = s[0..4].parse().ok()?;
    let month: u32 = s[5..7].parse().ok()?;
    let day: u32 = s[8..10].parse().ok()?;
    let hour: u64 = s[11..13].parse().ok()?;
    let min: u64 = s[14..16].parse().ok()?;
    let sec: u64 = s[17..19].parse().ok()?;
    let days = days_from_civil(year, month, day)?;
    let total_secs = days as u64 * 86_400 + hour * 3600 + min * 60 + sec;
    Some(std::time::UNIX_EPOCH + std::time::Duration::from_secs(total_secs))
}

fn days_from_civil(y: i64, m: u32, d: u32) -> Option<i64> {
    if m < 1 || m > 12 || d < 1 || d > 31 {
        return None;
    }
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y / 400 } else { (y - 399) / 400 };
    let yoe = (y - era * 400) as u32;
    let m_adj = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * m_adj + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    Some(era * 146_097 + doe as i64 - 719_468)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SkillSyncPreviewOperation {
    Create,
    Overwrite,
    NoOp,
    Skipped,
    BlockedDrift,
    OverwriteUnknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SkillSyncDriftResolution {
    Override,
    Detach,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncPreviewItem {
    pub skill_name: String,
    pub target_key: String,
    pub agent: AgentId,
    pub scope: SkillScope,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    pub target_dir: String,
    pub skill_dir: String,
    pub skill_md_path: String,
    pub operation: SkillSyncPreviewOperation,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rendered_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_sync_hash: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncPreviewSummary {
    pub create: usize,
    pub overwrite: usize,
    pub no_op: usize,
    pub skipped: usize,
    pub blocked_drift: usize,
    pub overwrite_unknown: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncPreview {
    pub skill_name: String,
    pub items: Vec<SkillSyncPreviewItem>,
    pub summary: SkillSyncPreviewSummary,
    #[serde(default)]
    pub orphan_siblings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncAllPreview {
    pub skills: Vec<SkillSyncPreview>,
    pub summary: SkillSyncPreviewSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncResolution {
    pub target_key: String,
    pub resolution: SkillSyncDriftResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncCommitRequest {
    pub skill_name: String,
    pub resolutions: Vec<SkillSyncResolution>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillSyncAllCommitRequest {
    pub resolutions_by_skill: std::collections::BTreeMap<String, Vec<SkillSyncResolution>>,
}

/// One render-and-write pass for a single agent.
pub trait FanOutRenderer {
    /// The agent this renderer handles. Useful for debugging / future
    /// renderer-driven dispatch; current dispatch in [`skill_sync_one`]
    /// already knows the agent from the canonical `agents` field.
    #[allow(dead_code)]
    fn agent_id(&self) -> &'static str;

    /// Resolve the target directory for the given scope using the
    /// caller-supplied `AgentPathPair`. `global` is an absolute or
    /// `~`-anchored path; `project_relative` is joined onto `project_path`.
    fn resolve_target_dir(
        &self,
        scope: SkillScope,
        project_path: Option<&str>,
        path_pair: &super::agent_paths::AgentPathPair,
    ) -> Result<PathBuf, String>;

    /// Render `skill` into the target directory. Caller has already created
    /// the target directory's *parent*; the renderer SHALL create its own
    /// `<target>/<skill.name>/` sub-directory.
    fn render(&self, skill: &CanonicalSkill, target_dir: &Path) -> Result<(), String>;
}

/// Look up the path pair for an agent from a config snapshot.
fn pair_for<'a>(
    cfg: &'a super::agent_paths::AgentPathsConfig,
    agent: &str,
) -> Option<&'a super::agent_paths::AgentPathPair> {
    cfg.pair_for(agent)
}

fn renderer_for(agent: &str) -> Box<dyn FanOutRenderer> {
    match agent {
        "anthropic" => Box::new(anthropic::AnthropicRenderer),
        "codex" => Box::new(codex::CodexRenderer),
        "gemini" => Box::new(gemini::GeminiRenderer),
        _ => Box::new(generic::GenericRenderer),
    }
}

/// Sync one canonical skill to every enabled tracked target in its
/// sync-meta v2 target list (or v1 backfill, defaulted to one global target
/// per agent). Returns a `SyncResult` per *written* target. Disabled /
/// detached / forked targets are skipped silently. A failure on one target
/// does NOT abort the others.
///
/// Canonical lives in the single global dir; `SkillTarget.scope` decides
/// where each push lands. The caller passes only the skill name.
#[tauri::command]
pub fn skill_sync_one(name: String) -> Result<Vec<SyncResult>, String> {
    let canonical_dir = canonical_skills_dir();
    let canonical_skill_dir = canonical_dir.join(&name);
    let skill_md = canonical_skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("canonical skill not found: {name}"));
    }
    let raw = fs::read_to_string(&skill_md)
        .map_err(|e| format!("failed to read canonical SKILL.md: {e}"))?;
    let mut skill = parse_skill_md(&raw)?;
    skill.canonical_id = name.clone();
    skill.name = name.clone();

    // Driver of fan-out is the per-skill target list (sync-meta v2). v1
    // sidecars are backfilled at read time from skill.agents (defaulting to
    // global targets); the user can add project targets via the target editor.
    let (mut meta, _legacy) = read_sync_meta_v2(&canonical_skill_dir, &skill);

    let cfg = super::agent_paths::agent_paths_get()?;
    let mut results = Vec::new();
    let mut written_keys: Vec<String> = Vec::new();
    let attempted_at = current_iso8601();

    for target in meta.targets.clone() {
        if !target.enabled {
            continue;
        }
        // forked targets are reserved for Phase 2 overlay rendering; this
        // capability treats them as detached.
        if matches!(target.mode, TargetMode::Detached | TargetMode::Forked) {
            continue;
        }

        let renderer = renderer_for(&target.agent);
        let Some(pair) = pair_for(&cfg, &target.agent) else { continue; };
        let target_dir =
            match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
                Ok(d) => d,
                Err(e) => {
                    results.push(SyncResult {
                        agent: target.agent.clone(),
                        scope: target.scope,
                        target_path: String::new(),
                        success: false,
                        error: Some(e),
                        at: attempted_at.clone(),
                    });
                    continue;
                }
            };
        let target_skill_dir = target_dir.join(&skill.name);
        let key = target_key(&target);
        let old_sibling_hashes = meta.last_sync.get(&key).and_then(|e| e.sibling_hashes.clone());
        let render_result = renderer.render(&skill, &target_dir);
        let final_result = match render_result {
            Ok(()) => copy_bundled_siblings(&canonical_skill_dir, &target_skill_dir),
            Err(e) => Err(e),
        };

        match final_result {
            Ok(()) => {
                cleanup_orphan_siblings(&old_sibling_hashes, &canonical_skill_dir, &target_skill_dir);
                let rendered =
                    fs::read_to_string(target_skill_dir.join("SKILL.md")).unwrap_or_default();
                let snapshot = try_snapshot(&name);
                meta.last_sync.insert(
                    key.clone(),
                    LastSyncEntry {
                        pushed_hash: semantic_hash(&rendered),
                        base_snapshot: snapshot,
                        at: attempted_at.clone(),
                        sibling_hashes: Some(compute_sibling_hashes(&target_skill_dir)),
                    },
                );
                written_keys.push(key);
                results.push(SyncResult {
                    agent: target.agent.clone(),
                    scope: target.scope,
                    target_path: normalize_display_path(&target_skill_dir.to_string_lossy()),
                    success: true,
                    error: None,
                    at: attempted_at.clone(),
                });
            }
            Err(e) => results.push(SyncResult {
                agent: target.agent,
                scope: target.scope,
                target_path: normalize_display_path(&target_skill_dir.to_string_lossy()),
                success: false,
                error: Some(e),
                at: attempted_at.clone(),
            }),
        }
    }

    // No targets → nothing to push → clear dirty. Partial success keeps
    // dirty=true so the user can re-push after fixing the failing target.
    let all_ok = results.is_empty() || results.iter().all(|r| r.success);
    if all_ok {
        meta.dirty = false;
    }
    let _ = write_sync_meta_v2(&canonical_skill_dir, &meta);

    Ok(results)
}

pub(crate) fn sha256_hex(data: &str) -> String {
    let mut h = Sha256::new();
    h.update(data.as_bytes());
    format!("{:x}", h.finalize())
}

/// Produce a semantic hash of a SKILL.md-style document. The content is
/// split into YAML frontmatter and body. Frontmatter keys are sorted
/// alphabetically and re-serialized; the body is trimmed. The concatenation
/// is then SHA-256 hashed. Documents without frontmatter delimiters are
/// hashed as trim-only.
pub(crate) fn semantic_hash(content: &str) -> String {
    let normalized = normalize_skill_content(content);
    sha256_hex(&normalized)
}

/// Produce a composite hash of an entire skill directory: SKILL.md semantic
/// hash concatenated with sorted sibling file hashes, then SHA-256'd.
pub(crate) fn directory_hash(skill_dir: &Path) -> Option<String> {
    let skill_md = skill_dir.join("SKILL.md");
    let content = fs::read_to_string(&skill_md).ok()?;
    let main_hash = semantic_hash(&content);
    let sibling_hashes = compute_sibling_hashes(skill_dir);
    let mut combined = main_hash;
    for (name, hash) in &sibling_hashes {
        combined.push(':');
        combined.push_str(name);
        combined.push(':');
        combined.push_str(hash);
    }
    Some(sha256_hex(&combined))
}

fn normalize_line_endings(s: &str) -> String {
    s.replace("\r\n", "\n").replace('\r', "\n")
}

fn normalize_skill_content(content: &str) -> String {
    let normalized = normalize_line_endings(content);
    let Some((fm_raw, body)) = split_frontmatter(&normalized) else {
        return normalized.trim().to_string();
    };

    let sorted_fm = match serde_yaml::from_str::<serde_yaml::Value>(fm_raw) {
        Ok(val) => normalize_yaml_value(&val),
        Err(_) => fm_raw.trim().to_string(),
    };

    let trimmed_body = body.trim();
    if trimmed_body.is_empty() {
        format!("---\n{sorted_fm}\n---")
    } else {
        format!("---\n{sorted_fm}\n---\n{trimmed_body}")
    }
}

fn split_frontmatter(content: &str) -> Option<(&str, &str)> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let after_open = &trimmed[3..];
    let after_open = after_open.strip_prefix('\n').unwrap_or(
        after_open.strip_prefix("\r\n").unwrap_or(after_open),
    );
    let close_pos = after_open.find("\n---")?;
    let fm = &after_open[..close_pos];
    let rest = &after_open[close_pos + 4..];
    let rest = rest.strip_prefix('\n').unwrap_or(
        rest.strip_prefix("\r\n").unwrap_or(rest),
    );
    Some((fm, rest))
}

fn normalize_yaml_value(val: &serde_yaml::Value) -> String {
    match val {
        serde_yaml::Value::Mapping(map) => {
            let mut pairs: Vec<_> = map.iter().collect();
            pairs.sort_by(|(a, _), (b, _)| {
                let ak = a.as_str().unwrap_or("");
                let bk = b.as_str().unwrap_or("");
                ak.cmp(bk)
            });
            let mut out = String::new();
            for (k, v) in pairs {
                let ks = serde_yaml::to_string(k).unwrap_or_default();
                let vs = serde_yaml::to_string(v).unwrap_or_default();
                // serde_yaml appends trailing newline; strip it
                let ks = ks.trim_end();
                let vs = vs.trim_end();
                out.push_str(&format!("{ks}: {vs}\n"));
            }
            out.trim_end().to_string()
        }
        other => {
            serde_yaml::to_string(other)
                .unwrap_or_default()
                .trim()
                .to_string()
        }
    }
}

/// Sync every canonical skill in the global canonical dir. Skips broken skills.
#[tauri::command]
pub fn skill_sync_all() -> Result<Vec<SyncResult>, String> {
    let entries = super::canonical_skills::canonical_skills_list()?;
    let mut out = Vec::new();
    for entry in entries {
        if let super::canonical_skills::SkillListEntry::Ok {
            canonical_id,
            skill,
        } = entry
        {
            // Re-use skill_sync_one for consistent semantics (meta update etc).
            match skill_sync_one(canonical_id) {
                Ok(mut r) => out.append(&mut r),
                Err(e) => {
                    // Pre-render failure (e.g. missing file): surface as a
                    // single result tagged to the first agent so the UI has
                    // somewhere to render the error. Scope is Global because
                    // canonical now lives there exclusively.
                    let agent = skill.agents.first().cloned().unwrap_or_else(|| "anthropic".to_string());
                    out.push(SyncResult {
                        agent,
                        scope: SkillScope::Global,
                        target_path: String::new(),
                        success: false,
                        error: Some(e),
                        at: current_iso8601(),
                    });
                }
            }
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn skill_sync_preview(name: String) -> Result<SkillSyncPreview, String> {
    let (skill, canonical_skill_dir, mut meta) = load_skill_for_fan_out(&name)?;
    build_preview_for_skill(&skill, &canonical_skill_dir, &mut meta)
}

#[tauri::command]
pub fn skill_sync_all_preview() -> Result<SkillSyncAllPreview, String> {
    let entries = super::canonical_skills::canonical_skills_list()?;
    let mut skills = Vec::new();
    let mut summary = SkillSyncPreviewSummary::default();
    for entry in entries {
        if let super::canonical_skills::SkillListEntry::Ok {
            canonical_id, skill, ..
        } = entry
        {
            if !skill.dirty {
                continue;
            }
            let has_pushable_target = skill.targets.iter().any(|t| {
                t.enabled && matches!(t.mode, super::canonical_skills::TargetMode::Auto | super::canonical_skills::TargetMode::Manual)
            });
            if !has_pushable_target {
                continue;
            }
            let preview = skill_sync_preview(canonical_id)?;
            merge_summary(&mut summary, &preview.summary);
            skills.push(preview);
        }
    }
    Ok(SkillSyncAllPreview { skills, summary })
}

#[tauri::command]
pub fn skill_sync_commit(request: SkillSyncCommitRequest) -> Result<Vec<SyncResult>, String> {
    let (skill, canonical_skill_dir, mut meta) = load_skill_for_fan_out(&request.skill_name)?;
    let preview = build_preview_for_skill(&skill, &canonical_skill_dir, &mut meta)?;
    let resolutions: std::collections::BTreeMap<String, SkillSyncDriftResolution> = request
        .resolutions
        .into_iter()
        .map(|r| (r.target_key, r.resolution))
        .collect();
    let attempted_at = current_iso8601();
    let mut results = Vec::new();
    let mut any_failure = false;

    for item in preview.items {
        let Some(target_index) = meta
            .targets
            .iter()
            .position(|target| target_key(target) == item.target_key)
        else {
            continue;
        };
        let target = meta.targets[target_index].clone();

        match item.operation {
            SkillSyncPreviewOperation::Skipped => {
                if let Some(error) = item.error.clone() {
                    any_failure = true;
                    results.push(commit_result_from_item(
                        &item,
                        false,
                        Some(error),
                        &attempted_at,
                    ));
                }
            }
            SkillSyncPreviewOperation::BlockedDrift
            | SkillSyncPreviewOperation::OverwriteUnknown => {
                match resolutions.get(&item.target_key).copied() {
                    Some(SkillSyncDriftResolution::Override) => {
                        match write_target(
                            &skill,
                            &canonical_skill_dir,
                            &target,
                            &attempted_at,
                            &mut meta,
                        ) {
                            Ok(result) => results.push(result),
                            Err(result) => {
                                any_failure = true;
                                results.push(result);
                            }
                        }
                    }
                    Some(SkillSyncDriftResolution::Detach) => {
                        meta.targets[target_index].mode = TargetMode::Detached;
                        results.push(commit_result_from_item(&item, true, None, &attempted_at));
                    }
                    Some(SkillSyncDriftResolution::Cancel) | None => {
                        // User chose not to write this target — not a failure.
                        // dirty is determined by unsynced targets, not by cancel.
                        results.push(commit_result_from_item(&item, true, None, &attempted_at));
                    }
                }
            }
            SkillSyncPreviewOperation::Create | SkillSyncPreviewOperation::Overwrite => {
                match write_target(
                    &skill,
                    &canonical_skill_dir,
                    &target,
                    &attempted_at,
                    &mut meta,
                ) {
                    Ok(result) => results.push(result),
                    Err(result) => {
                        any_failure = true;
                        results.push(result);
                    }
                }
            }
            SkillSyncPreviewOperation::NoOp => {
                if let Some(hash) = item
                    .rendered_hash
                    .as_deref()
                    .or(item.current_hash.as_deref())
                {
                    let existing = meta.last_sync.get(&item.target_key);
                    let hash_unchanged = existing.map_or(false, |e| e.pushed_hash == hash);

                    if hash_unchanged {
                        if let Some(entry) = meta.last_sync.get_mut(&item.target_key) {
                            entry.at = attempted_at.clone();
                        }
                    } else {
                        let snapshot = try_snapshot(&skill.name);
                        meta.last_sync.insert(
                            item.target_key.clone(),
                            LastSyncEntry {
                                pushed_hash: hash.to_string(),
                                base_snapshot: snapshot,
                                at: attempted_at.clone(),
                                sibling_hashes: Some(compute_sibling_hashes(
                                    &std::path::Path::new(&item.target_dir).join(&item.skill_name),
                                )),
                            },
                        );
                    }
                }
                results.push(commit_result_from_item(&item, true, None, &attempted_at));
            }
        }
    }

    meta.dirty = any_failure
        || meta.targets.iter().any(|target| {
            target.enabled && matches!(target.mode, TargetMode::Auto | TargetMode::Manual) && {
                let key = target_key(target);
                !meta.last_sync.contains_key(&key)
            }
        });
    let _ = write_sync_meta_v2(&canonical_skill_dir, &meta);

    Ok(results)
}

#[tauri::command]
pub fn skill_sync_all_commit(
    request: SkillSyncAllCommitRequest,
) -> Result<Vec<SyncResult>, String> {
    let entries = super::canonical_skills::canonical_skills_list()?;
    let skill_ids: Vec<String> = entries
        .into_iter()
        .filter_map(|entry| {
            if let super::canonical_skills::SkillListEntry::Ok { canonical_id, .. } = entry {
                Some(canonical_id)
            } else {
                None
            }
        })
        .collect();

    if skill_ids.is_empty() {
        return Ok(Vec::new());
    }

    let max_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .min(8);

    let chunk_size = ((skill_ids.len() + max_threads - 1) / max_threads).max(1);

    #[cfg(test)]
    let felina_home_for_threads = crate::paths::felina_home();

    let results: Vec<Result<Vec<SyncResult>, String>> = std::thread::scope(|s| {
        let chunks: Vec<&[String]> = skill_ids.chunks(chunk_size).collect();

        let handles: Vec<_> = chunks
            .into_iter()
            .map(|chunk| {
                let request_ref = &request;
                #[cfg(test)]
                let felina_home_capture = felina_home_for_threads.clone();
                s.spawn(move || {
                    #[cfg(test)]
                    crate::paths::set_felina_home_override_for_test(Some(felina_home_capture));
                    let mut chunk_results = Vec::new();
                    for canonical_id in chunk {
                        let resolutions = request_ref
                            .resolutions_by_skill
                            .get(canonical_id)
                            .cloned()
                            .unwrap_or_default();
                        let mut results = skill_sync_commit(SkillSyncCommitRequest {
                            skill_name: canonical_id.clone(),
                            resolutions,
                        })?;
                        chunk_results.append(&mut results);
                    }
                    Ok(chunk_results)
                })
            })
            .collect();

        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let mut out = Vec::new();
    for result in results {
        out.append(&mut result?);
    }
    Ok(out)
}

pub fn auto_push_if_needed(canonical_id: &str) -> Vec<SyncResult> {
    let canonical_dir = canonical_skills_dir();
    let canonical_skill_dir = canonical_dir.join(canonical_id);
    let skill_md = canonical_skill_dir.join("SKILL.md");

    let raw = match fs::read_to_string(&skill_md) {
        Ok(r) => r,
        Err(_) => return vec![],
    };
    let mut skill = match parse_skill_md(&raw) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    skill.canonical_id = canonical_id.to_string();
    skill.name = canonical_id.to_string();

    let (mut meta, _) = read_sync_meta_v2(&canonical_skill_dir, &skill);

    let auto_targets: Vec<_> = meta
        .targets
        .iter()
        .filter(|t| t.enabled && matches!(t.mode, TargetMode::Auto))
        .cloned()
        .collect();

    if auto_targets.is_empty() {
        return vec![];
    }

    let attempted_at = current_iso8601();
    let mut results = Vec::new();

    for target in &auto_targets {
        match write_target(&skill, &canonical_skill_dir, target, &attempted_at, &mut meta) {
            Ok(r) => {
                let snapshot = try_snapshot(canonical_id);
                let key = target_key(target);
                if let Some(entry) = meta.last_sync.get_mut(&key) {
                    entry.base_snapshot = snapshot;
                }
                results.push(r);
            }
            Err(r) => results.push(r),
        }
    }

    let auto_failed = results.iter().any(|r| !r.success);
    let has_manual_targets = meta
        .targets
        .iter()
        .any(|t| t.enabled && matches!(t.mode, TargetMode::Manual));
    meta.dirty = auto_failed || has_manual_targets;

    let _ = write_sync_meta_v2(&canonical_skill_dir, &meta);
    results
}

fn write_target(
    skill: &CanonicalSkill,
    canonical_skill_dir: &Path,
    target: &super::canonical_skills::SkillTarget,
    attempted_at: &str,
    meta: &mut super::canonical_skills::SyncMetaV2,
) -> Result<SyncResult, SyncResult> {
    let cfg = match super::agent_paths::agent_paths_get() {
        Ok(cfg) => cfg,
        Err(e) => {
            return Err(SyncResult {
                agent: target.agent.clone(),
                scope: target.scope,
                target_path: String::new(),
                success: false,
                error: Some(e),
                at: attempted_at.to_string(),
            });
        }
    };
    let renderer = renderer_for(&target.agent);
    let pair = pair_for(&cfg, &target.agent).ok_or_else(|| SyncResult {
        agent: target.agent.clone(),
        scope: target.scope,
        target_path: String::new(),
        success: false,
        error: Some(format!("unknown agent: {}", target.agent)),
        at: attempted_at.to_string(),
    })?;
    let target_dir =
        match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
            Ok(path) => path,
            Err(e) => {
                return Err(SyncResult {
                    agent: target.agent.clone(),
                    scope: target.scope,
                    target_path: String::new(),
                    success: false,
                    error: Some(e),
                    at: attempted_at.to_string(),
                });
            }
        };
    let target_skill_dir = target_dir.join(&skill.name);
    let old_sibling_hashes = meta.last_sync.get(&target_key(target)).and_then(|e| e.sibling_hashes.clone());
    let final_result = match renderer.render(skill, &target_dir) {
        Ok(()) => copy_bundled_siblings(canonical_skill_dir, &target_skill_dir),
        Err(e) => Err(e),
    };

    match final_result {
        Ok(()) => {
            cleanup_orphan_siblings(&old_sibling_hashes, canonical_skill_dir, &target_skill_dir);
            let rendered =
                fs::read_to_string(target_skill_dir.join("SKILL.md")).unwrap_or_default();
            let snapshot = try_snapshot(&skill.name);
            meta.last_sync.insert(
                target_key(target),
                LastSyncEntry {
                    pushed_hash: semantic_hash(&rendered),
                    base_snapshot: snapshot,
                    at: attempted_at.to_string(),
                    sibling_hashes: Some(compute_sibling_hashes(&target_skill_dir)),
                },
            );
            Ok(SyncResult {
                agent: target.agent.clone(),
                scope: target.scope,
                target_path: normalize_display_path(&target_skill_dir.to_string_lossy()),
                success: true,
                error: None,
                at: attempted_at.to_string(),
            })
        }
        Err(e) => Err(SyncResult {
            agent: target.agent.clone(),
            scope: target.scope,
            target_path: normalize_display_path(&target_skill_dir.to_string_lossy()),
            success: false,
            error: Some(e),
            at: attempted_at.to_string(),
        }),
    }
}

fn commit_result_from_item(
    item: &SkillSyncPreviewItem,
    success: bool,
    error: Option<String>,
    attempted_at: &str,
) -> SyncResult {
    SyncResult {
        agent: item.agent.clone(),
        scope: item.scope,
        target_path: item.skill_dir.clone(),
        success,
        error,
        at: attempted_at.to_string(),
    }
}

fn load_skill_for_fan_out(
    name: &str,
) -> Result<(CanonicalSkill, PathBuf, super::canonical_skills::SyncMetaV2), String> {
    let canonical_dir = canonical_skills_dir();
    let canonical_skill_dir = canonical_dir.join(name);
    let skill_md = canonical_skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("canonical skill not found: {name}"));
    }
    let raw = fs::read_to_string(&skill_md)
        .map_err(|e| format!("failed to read canonical SKILL.md: {e}"))?;
    let mut skill = parse_skill_md(&raw)?;
    skill.canonical_id = name.to_string();
    skill.name = name.to_string();
    let (meta, _legacy) = read_sync_meta_v2(&canonical_skill_dir, &skill);
    Ok((skill, canonical_skill_dir, meta))
}

fn build_preview_for_skill(
    skill: &CanonicalSkill,
    canonical_skill_dir: &Path,
    meta: &mut super::canonical_skills::SyncMetaV2,
) -> Result<SkillSyncPreview, String> {
    let cfg = super::agent_paths::agent_paths_get()?;
    let mut items = Vec::new();
    for target in &meta.targets {
        let key = target_key(target);
        let renderer = renderer_for(&target.agent);
        let Some(pair) = pair_for(&cfg, &target.agent) else { continue; };

        let target_dir =
            match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
                Ok(path) => path,
                Err(error) => {
                    items.push(SkillSyncPreviewItem {
                        skill_name: skill.name.clone(),
                        target_key: key,
                        agent: target.agent.clone(),
                        scope: target.scope,
                        project: target.project.clone(),
                        target_dir: String::new(),
                        skill_dir: String::new(),
                        skill_md_path: String::new(),
                        operation: SkillSyncPreviewOperation::Skipped,
                        current_hash: None,
                        rendered_hash: None,
                        last_sync_hash: meta
                            .last_sync
                            .get(&target_key(target))
                            .map(|e| e.pushed_hash.clone()),
                        error: Some(error),
                    });
                    continue;
                }
            };
        let skill_dir = target_dir.join(&skill.name);
        let skill_md_path = skill_dir.join("SKILL.md");
        let last_sync_hash = meta.last_sync.get(&key).map(|e| e.pushed_hash.clone());

        if !target.enabled || matches!(target.mode, TargetMode::Detached | TargetMode::Forked) {
            items.push(SkillSyncPreviewItem {
                skill_name: skill.name.clone(),
                target_key: key,
                agent: target.agent.clone(),
                scope: target.scope,
                project: target.project.clone(),
                target_dir: normalize_display_path(&target_dir.to_string_lossy()),
                skill_dir: normalize_display_path(&skill_dir.to_string_lossy()),
                skill_md_path: normalize_display_path(&skill_md_path.to_string_lossy()),
                operation: SkillSyncPreviewOperation::Skipped,
                current_hash: None,
                rendered_hash: None,
                last_sync_hash,
                error: None,
            });
            continue;
        }

        let rendered_hash = match rendered_skill_md_hash(skill, &target.agent, canonical_skill_dir) {
            Ok(hash) => hash,
            Err(error) => {
                items.push(SkillSyncPreviewItem {
                    skill_name: skill.name.clone(),
                    target_key: key,
                    agent: target.agent.clone(),
                    scope: target.scope,
                    project: target.project.clone(),
                    target_dir: normalize_display_path(&target_dir.to_string_lossy()),
                    skill_dir: normalize_display_path(&skill_dir.to_string_lossy()),
                    skill_md_path: normalize_display_path(&skill_md_path.to_string_lossy()),
                    operation: SkillSyncPreviewOperation::Skipped,
                    current_hash: None,
                    rendered_hash: None,
                    last_sync_hash,
                    error: Some(error),
                });
                continue;
            }
        };

        let last_sync_entry = meta.last_sync.get(&key);
        let last_sync_at = last_sync_entry.map(|e| e.at.as_str());
        let sibling_hashes_ref = last_sync_entry
            .and_then(|e| e.sibling_hashes.clone());
        let canonical_siblings = compute_sibling_hashes(canonical_skill_dir);
        let drift = check_drift(&skill_md_path, last_sync_hash.as_deref(), last_sync_at, &sibling_hashes_ref, Some(&canonical_siblings));
        let current_hash = if skill_md_path.is_file() {
            let current = fs::read_to_string(&skill_md_path).map_err(|e| {
                format!(
                    "failed to read target SKILL.md {}: {e}",
                    skill_md_path.display()
                )
            })?;
            Some(semantic_hash(&current))
        } else {
            None
        };

        let canonical_siblings = compute_sibling_hashes(canonical_skill_dir);
        let recorded_siblings = meta
            .last_sync
            .get(&key)
            .and_then(|e| e.sibling_hashes.as_ref());
        let siblings_changed = match recorded_siblings {
            Some(recorded) => canonical_siblings != *recorded,
            None => !canonical_siblings.is_empty(),
        };

        let operation = match (&current_hash, drift) {
            (None, _) => SkillSyncPreviewOperation::Create,
            (Some(current), _) if current == &rendered_hash && !siblings_changed => {
                SkillSyncPreviewOperation::NoOp
            }
            (Some(current), _) if current == &rendered_hash && siblings_changed => {
                SkillSyncPreviewOperation::Overwrite
            }
            (_, DriftStatus::Drifted) => SkillSyncPreviewOperation::BlockedDrift,
            (_, DriftStatus::Synced) => SkillSyncPreviewOperation::Overwrite,
            (_, DriftStatus::NoPushHistory) => SkillSyncPreviewOperation::OverwriteUnknown,
            (_, DriftStatus::Missing) => SkillSyncPreviewOperation::Create,
            (_, DriftStatus::ForkedClean | DriftStatus::ForkedEdited | DriftStatus::ForkedCanonicalAhead | DriftStatus::ForkedDiverged) => SkillSyncPreviewOperation::Skipped,
        };

        items.push(SkillSyncPreviewItem {
            skill_name: skill.name.clone(),
            target_key: key,
            agent: target.agent.clone(),
            scope: target.scope,
            project: target.project.clone(),
            target_dir: normalize_display_path(&target_dir.to_string_lossy()),
            skill_dir: normalize_display_path(&skill_dir.to_string_lossy()),
            skill_md_path: normalize_display_path(&skill_md_path.to_string_lossy()),
            operation,
            current_hash,
            rendered_hash: Some(rendered_hash),
            last_sync_hash,
            error: None,
        });
    }

    let mut summary = SkillSyncPreviewSummary::default();
    for item in &items {
        count_operation(&mut summary, item.operation);
    }

    // Problem B self-heal: a skill flagged dirty whose every preview item
    // resolves to NoOp or Skipped (no Create/Overwrite/BlockedDrift/
    // OverwriteUnknown) is effectively in sync — the rendered outputs already
    // match what was pushed. The frontend skips the commit path when there is
    // nothing to write, so the stale dirty flag would otherwise never clear.
    // Recover it here and persist. Leave dirty untouched when a pending write
    // exists, and never act on a skill with no targets at all.
    if meta.dirty
        && !items.is_empty()
        && items.iter().all(|item| {
            matches!(
                item.operation,
                SkillSyncPreviewOperation::NoOp | SkillSyncPreviewOperation::Skipped
            )
        })
    {
        meta.dirty = false;
        let _ = write_sync_meta_v2(canonical_skill_dir, meta);
    }

    // Compute orphan siblings: files in ANY target's previous baseline that
    // no longer exist in the canonical dir. Since canonical is the same for
    // all targets, we collect from all last_sync entries and deduplicate.
    let canonical_siblings = compute_sibling_hashes(canonical_skill_dir);
    let mut orphan_set = std::collections::BTreeSet::new();
    for entry in meta.last_sync.values() {
        if let Some(ref baseline) = entry.sibling_hashes {
            for key in baseline.keys() {
                if !canonical_siblings.contains_key(key) {
                    orphan_set.insert(key.clone());
                }
            }
        }
    }
    let orphan_siblings: Vec<String> = orphan_set.into_iter().collect();

    Ok(SkillSyncPreview {
        skill_name: skill.name.clone(),
        items,
        summary,
        orphan_siblings,
    })
}

fn rendered_skill_md_hash(
    skill: &CanonicalSkill,
    agent: &str,
    canonical_skill_dir: &Path,
) -> Result<String, String> {
    let render_root = std::env::temp_dir().join(format!(
        "felina-preview-{}-{}-{}",
        std::process::id(),
        skill.name,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    fs::create_dir_all(&render_root)
        .map_err(|e| format!("failed to create preview temp dir: {e}"))?;
    let renderer = renderer_for(&agent);
    let render_result = renderer.render(skill, &render_root);
    let target_skill_dir = render_root.join(&skill.name);
    let final_result = match render_result {
        Ok(()) => copy_bundled_siblings(canonical_skill_dir, &target_skill_dir),
        Err(e) => Err(e),
    };
    let hash_result = final_result.and_then(|_| {
        fs::read_to_string(target_skill_dir.join("SKILL.md"))
            .map(|rendered| semantic_hash(&rendered))
            .map_err(|e| format!("failed to read rendered preview SKILL.md: {e}"))
    });
    let _ = fs::remove_dir_all(&render_root);
    hash_result
}

fn count_operation(summary: &mut SkillSyncPreviewSummary, operation: SkillSyncPreviewOperation) {
    match operation {
        SkillSyncPreviewOperation::Create => summary.create += 1,
        SkillSyncPreviewOperation::Overwrite => summary.overwrite += 1,
        SkillSyncPreviewOperation::NoOp => summary.no_op += 1,
        SkillSyncPreviewOperation::Skipped => summary.skipped += 1,
        SkillSyncPreviewOperation::BlockedDrift => summary.blocked_drift += 1,
        SkillSyncPreviewOperation::OverwriteUnknown => summary.overwrite_unknown += 1,
    }
}

fn merge_summary(into: &mut SkillSyncPreviewSummary, from: &SkillSyncPreviewSummary) {
    into.create += from.create;
    into.overwrite += from.overwrite;
    into.no_op += from.no_op;
    into.skipped += from.skipped;
    into.blocked_drift += from.blocked_drift;
    into.overwrite_unknown += from.overwrite_unknown;
}

/// Resolved fan-out destination directory for one target, plus an on-disk
/// existence flag. Powers the TargetEditor per-row "Open target folder"
/// button, which is disabled when `exists` is false.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetDirInfo {
    pub path: String,
    pub exists: bool,
}

/// Resolve the fan-out destination `<target>/<skill_name>/` for a single
/// target and report whether it currently exists on disk. The skill name is
/// the canonical directory identity (the same value fan-out writes under), so
/// the resolved path matches what a push produces — not parsed `frontmatter.name`.
#[tauri::command]
pub fn skill_target_dir_resolve(
    skill_name: String,
    agent: AgentId,
    scope: SkillScope,
    project: Option<String>,
) -> Result<TargetDirInfo, String> {
    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = pair_for(&cfg, &agent)
        .ok_or_else(|| format!("unknown agent: {agent}"))?;
    let target_dir = resolve_pair(scope, project.as_deref(), pair)?;
    let dir = target_dir.join(&skill_name);
    let exists = dir.is_dir();
    Ok(TargetDirInfo {
        path: normalize_display_path(&dir.to_string_lossy()),
        exists,
    })
}

/// Batch drift scan: iterate all canonical skills, check each enabled tracked
/// target for drift, and return a nested map keyed by skill name → target key.
#[tauri::command]
pub fn skill_drift_scan() -> Result<std::collections::BTreeMap<String, std::collections::BTreeMap<String, DriftStatus>>, String> {
    let entries = super::canonical_skills::canonical_skills_list()?;
    let cfg = super::agent_paths::agent_paths_get()?;
    let mut result: std::collections::BTreeMap<String, std::collections::BTreeMap<String, DriftStatus>> = std::collections::BTreeMap::new();

    // Collect (skill_name, target_key, agent_side_path, pushed_hash, last_sync_at)
    // for targets that need checking. Disabled/detached targets are skipped per spec.
    let mut checks: Vec<(String, String, PathBuf, Option<String>, Option<String>, Option<std::collections::BTreeMap<String, String>>, std::collections::BTreeMap<String, String>)> = Vec::new();

    for entry in entries {
        let super::canonical_skills::SkillListEntry::Ok {
            canonical_id,
            skill,
        } = entry
        else {
            continue;
        };
        let canonical_skill_dir = canonical_skills_dir().join(&canonical_id);
        let (meta, _) = read_sync_meta_v2(&canonical_skill_dir, &skill);

        for target in &meta.targets {
            if !target.enabled || matches!(target.mode, TargetMode::Detached) {
                continue;
            }
            let key = target_key(target);
            let last_sync_entry = meta.last_sync.get(&key);

            if matches!(target.mode, TargetMode::Forked) {
                let canonical_skill_md = canonical_skills_dir().join(&canonical_id).join("SKILL.md");
                let renderer = renderer_for(&target.agent);
                let Some(pair) = pair_for(&cfg, &target.agent) else { continue; };
                let target_dir =
                    match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
                        Ok(d) => d,
                        Err(_) => continue,
                    };
                let agent_side = target_dir.join(&canonical_id).join("SKILL.md");

                let fork_status = classify_fork_status(
                    &canonical_skill_md,
                    &agent_side,
                    last_sync_entry,
                );
                result
                    .entry(canonical_id.clone())
                    .or_default()
                    .insert(key, fork_status);
                continue;
            }

            let pushed_hash = last_sync_entry.map(|e| e.pushed_hash.clone());
            let last_sync_at = last_sync_entry.map(|e| e.at.clone());

            let renderer = renderer_for(&target.agent);
            let Some(pair) = pair_for(&cfg, &target.agent) else { continue; };
            let target_dir =
                match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
                    Ok(d) => d,
                    Err(_) => continue,
                };
            let skill_md_path = target_dir.join(&canonical_id).join("SKILL.md");
            let sib_hashes = last_sync_entry
                .and_then(|e| e.sibling_hashes.clone());
            let canonical_sibs = compute_sibling_hashes(&canonical_skill_dir);
            checks.push((
                canonical_id.clone(),
                key,
                skill_md_path,
                pushed_hash,
                last_sync_at,
                sib_hashes,
                canonical_sibs,
            ));
        }
    }

    // Parallel hash computation for targets that pass mtime fast-path
    use rayon::prelude::*;
    let statuses: Vec<(String, String, DriftStatus)> = checks
        .into_par_iter()
        .map(|(skill_name, tkey, path, pushed, at, sib_hashes, canonical_sibs)| {
            let status = check_drift(&path, pushed.as_deref(), at.as_deref(), &sib_hashes, Some(&canonical_sibs));
            (skill_name, tkey, status)
        })
        .collect();

    for (skill_name, tkey, status) in statuses {
        result
            .entry(skill_name)
            .or_default()
            .insert(tkey, status);
    }

    Ok(result)
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub kind: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub old_start: u32,
    pub old_count: u32,
    pub new_start: u32,
    pub new_count: u32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum SiblingStatus {
    Added,
    Modified,
    Deleted,
    Conflict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiblingChange {
    pub path: String,
    pub status: SiblingStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum SiblingResolution {
    UseAgent,
    UseCanonical,
    Skip,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullDiffPreview {
    pub has_base: bool,
    pub canonical_content: String,
    pub target_content: String,
    pub base_content: Option<String>,
    pub hunks: Vec<DiffHunk>,
    pub sibling_changes: Vec<SiblingChange>,
}

pub(crate) fn build_diff_hunks(old_text: &str, new_text: &str) -> Vec<DiffHunk> {
    use similar::TextDiff;

    let diff = TextDiff::from_lines(old_text, new_text);
    let mut hunks = Vec::new();

    for group in diff.grouped_ops(3) {
        let mut lines = Vec::new();
        let mut old_start = u32::MAX;
        let mut old_end = 0u32;
        let mut new_start = u32::MAX;
        let mut new_end = 0u32;

        for op in &group {
            let tag = op.tag();
            let old_range = op.old_range();
            let new_range = op.new_range();
            old_start = old_start.min(old_range.start as u32);
            old_end = old_end.max(old_range.end as u32);
            new_start = new_start.min(new_range.start as u32);
            new_end = new_end.max(new_range.end as u32);

            match tag {
                similar::DiffTag::Equal => {
                    for line in old_text.lines().skip(old_range.start).take(old_range.len()) {
                        lines.push(DiffLine { kind: "context".into(), content: format!("{line}\n") });
                    }
                }
                similar::DiffTag::Delete => {
                    for line in old_text.lines().skip(old_range.start).take(old_range.len()) {
                        lines.push(DiffLine { kind: "delete".into(), content: format!("{line}\n") });
                    }
                }
                similar::DiffTag::Insert => {
                    for line in new_text.lines().skip(new_range.start).take(new_range.len()) {
                        lines.push(DiffLine { kind: "add".into(), content: format!("{line}\n") });
                    }
                }
                similar::DiffTag::Replace => {
                    for line in old_text.lines().skip(old_range.start).take(old_range.len()) {
                        lines.push(DiffLine { kind: "delete".into(), content: format!("{line}\n") });
                    }
                    for line in new_text.lines().skip(new_range.start).take(new_range.len()) {
                        lines.push(DiffLine { kind: "add".into(), content: format!("{line}\n") });
                    }
                }
            }
        }

        hunks.push(DiffHunk {
            old_start: old_start + 1,
            old_count: old_end - old_start,
            new_start: new_start + 1,
            new_count: new_end - new_start,
            lines,
        });
    }

    hunks
}

/// Three-way comparison of sibling files: pushed (from sync meta) vs canonical vs agent.
/// Returns empty if `pushed_map` is `None` (legacy meta).
pub(crate) fn compute_sibling_changes(
    pushed_map: Option<&std::collections::BTreeMap<String, String>>,
    canonical_skill_dir: &Path,
    agent_skill_dir: &Path,
) -> Vec<SiblingChange> {
    let Some(pushed) = pushed_map else {
        return vec![];
    };

    let canonical_hashes = compute_sibling_hashes(canonical_skill_dir);
    let agent_hashes = compute_sibling_hashes(agent_skill_dir);

    let mut all_keys = std::collections::BTreeSet::new();
    all_keys.extend(pushed.keys().cloned());
    all_keys.extend(agent_hashes.keys().cloned());
    all_keys.extend(canonical_hashes.keys().cloned());

    let mut changes = Vec::new();
    for key in all_keys {
        let p = pushed.get(&key);
        let c = canonical_hashes.get(&key);
        let a = agent_hashes.get(&key);

        let status = match (p, c, a) {
            (None, _, Some(_)) => SiblingStatus::Added,
            (Some(ph), Some(ch), Some(ah)) => {
                if ah == ph {
                    continue;
                }
                if ch == ph {
                    SiblingStatus::Modified
                } else {
                    SiblingStatus::Conflict
                }
            }
            (Some(ph), None, Some(ah)) => {
                if ah == ph {
                    continue;
                }
                SiblingStatus::Conflict
            }
            (Some(ph), Some(ch), None) => {
                if ch == ph {
                    SiblingStatus::Deleted
                } else {
                    SiblingStatus::Conflict
                }
            }
            (Some(_), None, None) => continue,
            (None, _, None) => continue,
        };

        changes.push(SiblingChange {
            path: key,
            status,
        });
    }

    changes
}

#[tauri::command]
pub fn skill_pull_preview(canonical_id: String, target_key: String) -> Result<PullDiffPreview, String> {
    use crate::commands::canonical_skills::{
        split_frontmatter, target_key as make_target_key,
    };

    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&canonical_id);
    if !skill_dir.is_dir() {
        return Err(format!("canonical skill directory not found: {}", skill_dir.display()));
    }

    let meta = read_sync_meta_v2_no_backfill(&skill_dir);
    let tgt = meta
        .targets
        .iter()
        .find(|t| make_target_key(t) == target_key)
        .ok_or_else(|| format!("target not found: {target_key}"))?
        .clone();

    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = pair_for(&cfg, &tgt.agent)
        .ok_or_else(|| format!("unknown agent: {}", tgt.agent))?;
    let target_dir = resolve_pair(tgt.scope, tgt.project.as_deref(), pair)?;
    let agent_side = target_dir.join(&canonical_id).join("SKILL.md");

    let agent_content = fs::read_to_string(&agent_side)
        .map_err(|e| format!("cannot read target file {}: {e}", agent_side.display()))?;
    let (_, target_body) = split_frontmatter(&agent_content);

    let canonical_path = skill_dir.join("SKILL.md");
    let canonical_raw = fs::read_to_string(&canonical_path)
        .map_err(|e| format!("cannot read canonical SKILL.md: {e}"))?;
    let (_, canonical_body) = split_frontmatter(&canonical_raw);

    let base_snapshot = meta.last_sync.get(&target_key).and_then(|e| e.base_snapshot.as_deref());

    let (has_base, base_content) = if let Some(hash) = base_snapshot {
        match super::snapshot::get_snapshot_content(hash, &format!("{}/SKILL.md", canonical_id)) {
            Ok(Some(raw)) => {
                let (_, body) = split_frontmatter(&raw);
                (true, Some(body))
            }
            _ => (false, None),
        }
    } else {
        (false, None)
    };

    let old_text = base_content.as_deref().unwrap_or(&canonical_body);
    let hunks = build_diff_hunks(old_text, &target_body);

    let agent_skill_dir = target_dir.join(&canonical_id);
    let sibling_changes = compute_sibling_changes(
        meta.last_sync.get(&target_key).and_then(|e| e.sibling_hashes.as_ref()),
        &skill_dir,
        &agent_skill_dir,
    );

    Ok(PullDiffPreview {
        has_base,
        canonical_content: canonical_body,
        target_content: target_body,
        base_content: base_content.clone(),
        hunks,
        sibling_changes,
    })
}

/// Apply sibling file changes from agent to canonical directory.
fn apply_sibling_changes(
    changes: &[SiblingChange],
    resolutions: &[SiblingResolution],
    canonical_skill_dir: &Path,
    agent_skill_dir: &Path,
) -> Result<(), String> {
    let resolution_map: std::collections::HashMap<usize, &SiblingResolution> =
        resolutions.iter().enumerate().map(|(i, r)| (i, r)).collect();

    let mut conflict_idx = 0usize;
    for change in changes {
        let canonical_path = canonical_skill_dir.join(&change.path);
        let agent_path = agent_skill_dir.join(&change.path);

        match change.status {
            SiblingStatus::Added | SiblingStatus::Modified => {
                if let Some(parent) = canonical_path.parent() {
                    fs::create_dir_all(parent)
                        .map_err(|e| format!("cannot create dir for sibling {}: {e}", change.path))?;
                }
                fs::copy(&agent_path, &canonical_path)
                    .map_err(|e| format!("cannot copy sibling {}: {e}", change.path))?;
            }
            SiblingStatus::Deleted => {
                if canonical_path.exists() {
                    fs::remove_file(&canonical_path)
                        .map_err(|e| format!("cannot delete sibling {}: {e}", change.path))?;
                }
            }
            SiblingStatus::Conflict => {
                let resolution = resolution_map.get(&conflict_idx).copied();
                conflict_idx += 1;
                match resolution {
                    Some(SiblingResolution::UseAgent) => {
                        if let Some(parent) = canonical_path.parent() {
                            fs::create_dir_all(parent)
                                .map_err(|e| format!("cannot create dir for sibling {}: {e}", change.path))?;
                        }
                        fs::copy(&agent_path, &canonical_path)
                            .map_err(|e| format!("cannot copy sibling {}: {e}", change.path))?;
                    }
                    Some(SiblingResolution::UseCanonical) | Some(SiblingResolution::Skip) | None => {
                        // keep canonical as-is
                    }
                }
            }
        }
    }
    Ok(())
}

/// Pull: read agent-side SKILL.md and overwrite canonical, then update sidecar.
#[tauri::command]
pub fn skill_pull_from_target(
    canonical_id: String,
    target_key: String,
    sibling_resolutions: Option<Vec<SiblingResolution>>,
) -> Result<(), String> {
    use crate::commands::canonical_skills::{
        split_frontmatter, target_key as make_target_key,
    };

    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&canonical_id);
    if !skill_dir.is_dir() {
        return Err(format!("canonical skill directory not found: {}", skill_dir.display()));
    }

    let mut meta = read_sync_meta_v2_no_backfill(&skill_dir);
    let tgt = meta
        .targets
        .iter()
        .find(|t| make_target_key(t) == target_key)
        .ok_or_else(|| format!("target not found: {target_key}"))?
        .clone();

    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = pair_for(&cfg, &tgt.agent)
        .ok_or_else(|| format!("unknown agent: {}", tgt.agent))?;
    let target_dir = resolve_pair(tgt.scope, tgt.project.as_deref(), pair)?;
    let agent_skill_dir = target_dir.join(&canonical_id);
    let agent_side = agent_skill_dir.join("SKILL.md");

    let agent_content = fs::read_to_string(&agent_side)
        .map_err(|e| format!("cannot read target file {}: {e}", agent_side.display()))?;
    let (_, agent_body) = split_frontmatter(&agent_content);

    let canonical_path = skill_dir.join("SKILL.md");
    let canonical_raw = fs::read_to_string(&canonical_path)
        .map_err(|e| format!("cannot read canonical SKILL.md: {e}"))?;
    let (canonical_fm, _) = split_frontmatter(&canonical_raw);

    let body = if agent_body.ends_with('\n') || agent_body.is_empty() {
        agent_body
    } else {
        format!("{agent_body}\n")
    };
    let merged = format!("---\n{canonical_fm}\n---\n{body}");

    fs::write(&canonical_path, &merged)
        .map_err(|e| format!("cannot write canonical SKILL.md: {e}"))?;

    // Sibling sync
    let sibling_changes = compute_sibling_changes(
        meta.last_sync.get(&target_key).and_then(|e| e.sibling_hashes.as_ref()),
        &skill_dir,
        &agent_skill_dir,
    );
    if !sibling_changes.is_empty() {
        apply_sibling_changes(
            &sibling_changes,
            sibling_resolutions.as_deref().unwrap_or(&[]),
            &skill_dir,
            &agent_skill_dir,
        )?;
    }

    let hash = semantic_hash(&agent_content);
    let pulled_key = target_key.clone();
    meta.last_sync.insert(
        target_key,
        LastSyncEntry {
            pushed_hash: hash,
            base_snapshot: None,
            at: current_iso8601(),
            sibling_hashes: Some(compute_sibling_hashes(&skill_dir)),
        },
    );
    let has_other_targets = meta
        .targets
        .iter()
        .any(|t| make_target_key(t) != pulled_key && t.enabled && !matches!(t.mode, TargetMode::Detached | TargetMode::Forked));
    meta.dirty = has_other_targets;
    write_sync_meta_v2(&skill_dir, &meta)?;

    auto_push_if_needed(&canonical_id);

    Ok(())
}

/// Best-effort ISO-8601 UTC timestamp without pulling chrono. Format:
/// `YYYY-MM-DDTHH:MM:SSZ` derived from `SystemTime`.
pub(crate) fn current_iso8601() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // Civil-from-days algorithm (Howard Hinnant). Pure integer math; no deps.
    let days = (secs / 86_400) as i64;
    let secs_of_day = (secs % 86_400) as u32;
    let (y, m, d) = civil_from_days(days);
    let h = secs_of_day / 3600;
    let mi = (secs_of_day % 3600) / 60;
    let s = secs_of_day % 60;
    format!("{y:04}-{m:02}-{d:02}T{h:02}:{mi:02}:{s:02}Z")
}

fn civil_from_days(z: i64) -> (i64, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 {
        z / 146_097
    } else {
        (z - 146_096) / 146_097
    };
    let doe = (z - era * 146_097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

// ---------------------------------------------------------------------------
// Helpers re-used by per-agent renderers.
// ---------------------------------------------------------------------------

/// Ensure `target_dir/<skill_name>/` exists and return that path. Used by
/// every renderer; centralised so skill-name validation runs once.
pub(crate) fn prepare_skill_subdir(target_dir: &Path, skill_name: &str) -> Result<PathBuf, String> {
    // Defence in depth: even though canonical writes already validated the
    // name, refuse to touch the filesystem if someone hands a renderer a
    // bad name directly.
    if skill_name.is_empty()
        || skill_name.starts_with('.')
        || skill_name.contains('/')
        || skill_name.contains('\\')
        || skill_name == ".."
    {
        return Err(format!(
            "renderer refused unsafe skill name: {skill_name:?}"
        ));
    }
    let dir = target_dir.join(skill_name);
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create target skill dir: {e}"))?;
    Ok(dir)
}

/// Remove agent-side sibling files that were in the previous push baseline
/// but no longer exist in the canonical skill directory. Files on the agent
/// side that are NOT in the baseline are left untouched (user manual additions).
/// Deletion failures are logged but do not interrupt the push.
pub(crate) fn cleanup_orphan_siblings(
    old_sibling_hashes: &Option<std::collections::BTreeMap<String, String>>,
    canonical_skill_dir: &Path,
    target_skill_dir: &Path,
) {
    let Some(baseline) = old_sibling_hashes else {
        return;
    };
    if baseline.is_empty() {
        return;
    }
    let current_canonical = compute_sibling_hashes(canonical_skill_dir);
    for key in baseline.keys() {
        if !current_canonical.contains_key(key) {
            let orphan_path = target_skill_dir.join(key.replace('/', std::path::MAIN_SEPARATOR_STR));
            if orphan_path.is_file() {
                if let Err(e) = fs::remove_file(&orphan_path) {
                    eprintln!("[fan_out] warning: failed to remove orphan sibling {}: {e}", orphan_path.display());
                }
            }
        }
    }
}

/// Recursively copy bundled siblings from a canonical skill dir into a
/// rendered target skill dir. Skips SKILL.md (re-written by the renderer)
/// and the sync-meta sidecar. Files are overwritten unconditionally so
/// canonical changes propagate; existing target-only files survive.
pub(crate) fn copy_bundled_siblings(
    canonical_skill_dir: &Path,
    target_skill_dir: &Path,
) -> Result<(), String> {
    let entries = match fs::read_dir(canonical_skill_dir) {
        Ok(e) => e,
        Err(_) => return Ok(()), // no bundled files — fine
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str == "SKILL.md" || name_str == ".felina-sync-meta.json" {
            continue;
        }
        let src_path = entry.path();
        let dst_path = target_skill_dir.join(&name);
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("failed to mirror bundled dir {}: {e}", dst_path.display()))?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ft.is_file() {
            fs::copy(&src_path, &dst_path).map_err(|e| {
                format!("failed to mirror bundled file {}: {e}", dst_path.display())
            })?;
        }
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    let entries =
        fs::read_dir(src).map_err(|e| format!("failed to read {}: {e}", src.display()))?;
    for entry in entries.flatten() {
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("failed to create {}: {e}", dst_path.display()))?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ft.is_file() {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("failed to copy {}: {e}", dst_path.display()))?;
        }
    }
    Ok(())
}

/// Expand a leading `~` to the user's home directory. Path traversal
/// segments (`..`) are NOT resolved here — `agent_paths_set` already
/// validates inputs; this function just applies the home expansion.
pub(crate) fn expand_user_path(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/").or_else(|| p.strip_prefix("~\\")) {
        if let Some(home) = dirs::home_dir() {
            let normalized = if cfg!(windows) {
                rest.replace('/', "\\")
            } else {
                rest.to_string()
            };
            return home.join(normalized);
        }
    }
    if p == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from(p));
    }
    let normalized = if cfg!(windows) {
        p.replace('/', "\\")
    } else {
        p.to_string()
    };
    PathBuf::from(normalized)
}

/// Resolve a path pair into a concrete target directory using the same rule
/// for every agent: `global` scope → expand-user on `pair.global`;
/// `project` scope → join `pair.project_relative` onto `project_path`.
// ── Fork preview commands ──────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkAgentContent {
    pub body: String,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ForkStatus {
    Clean,
    Edited,
    CanonicalAhead,
    Diverged,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkDiffPreview {
    pub canonical_body: String,
    pub forked_body: String,
    pub base_body: Option<String>,
    pub has_base: bool,
    pub hunks: Vec<DiffHunk>,
    pub fork_status: ForkStatus,
}

#[tauri::command]
pub fn skill_fork_read_agent_content(
    canonical_id: String,
    target_key: String,
) -> Result<ForkAgentContent, String> {
    use crate::commands::canonical_skills::{
        split_frontmatter, target_key as make_target_key,
    };

    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&canonical_id);
    if !skill_dir.is_dir() {
        return Err(format!("canonical skill directory not found: {}", skill_dir.display()));
    }

    let meta = read_sync_meta_v2_no_backfill(&skill_dir);
    let tgt = meta
        .targets
        .iter()
        .find(|t| make_target_key(t) == target_key)
        .ok_or_else(|| format!("target not found: {target_key}"))?
        .clone();

    if !matches!(tgt.mode, TargetMode::Forked) {
        return Err("target is not in forked mode".to_string());
    }

    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = pair_for(&cfg, &tgt.agent)
        .ok_or_else(|| format!("unknown agent: {}", tgt.agent))?;
    let target_dir = resolve_pair(tgt.scope, tgt.project.as_deref(), pair)?;
    let agent_side = target_dir.join(&canonical_id).join("SKILL.md");

    let raw = fs::read_to_string(&agent_side)
        .map_err(|_| format!("agent-side file not found: {}", agent_side.display()))?;
    let (_, body) = split_frontmatter(&raw);

    Ok(ForkAgentContent { body, raw })
}

#[tauri::command]
pub fn skill_fork_diff_preview(
    canonical_id: String,
    target_key: String,
) -> Result<ForkDiffPreview, String> {
    use crate::commands::canonical_skills::{
        split_frontmatter, target_key as make_target_key,
    };

    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&canonical_id);
    if !skill_dir.is_dir() {
        return Err(format!("canonical skill directory not found: {}", skill_dir.display()));
    }

    let meta = read_sync_meta_v2_no_backfill(&skill_dir);
    let tgt = meta
        .targets
        .iter()
        .find(|t| make_target_key(t) == target_key)
        .ok_or_else(|| format!("target not found: {target_key}"))?
        .clone();

    if !matches!(tgt.mode, TargetMode::Forked) {
        return Err("target is not in forked mode".to_string());
    }

    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = pair_for(&cfg, &tgt.agent)
        .ok_or_else(|| format!("unknown agent: {}", tgt.agent))?;
    let target_dir = resolve_pair(tgt.scope, tgt.project.as_deref(), pair)?;
    let agent_side = target_dir.join(&canonical_id).join("SKILL.md");

    let forked_raw = fs::read_to_string(&agent_side)
        .map_err(|_| format!("agent-side file not found: {}", agent_side.display()))?;
    let (_, forked_body) = split_frontmatter(&forked_raw);

    let canonical_path = skill_dir.join("SKILL.md");
    let canonical_raw = fs::read_to_string(&canonical_path)
        .map_err(|e| format!("cannot read canonical SKILL.md: {e}"))?;
    let (_, canonical_body) = split_frontmatter(&canonical_raw);

    let last_sync_entry = meta.last_sync.get(&target_key);
    let base_snapshot = last_sync_entry.and_then(|e| e.base_snapshot.as_deref());
    let pushed_hash = last_sync_entry.map(|e| e.pushed_hash.as_str());

    let canonical_hash = semantic_hash(&canonical_raw);
    let forked_hash = semantic_hash(&forked_raw);

    let (has_base, base_body, fork_status) = if let Some(base_hash) = base_snapshot {
        let canonical_matches_base = canonical_hash == base_hash;
        let forked_matches_pushed = pushed_hash.map_or(false, |ph| forked_hash == ph);

        let status = match (canonical_matches_base, forked_matches_pushed) {
            (true, true) => ForkStatus::Clean,
            (true, false) => ForkStatus::Edited,
            (false, true) => ForkStatus::CanonicalAhead,
            (false, false) => ForkStatus::Diverged,
        };

        let base_content = super::snapshot::get_snapshot_content(
            base_hash,
            &format!("{}/SKILL.md", canonical_id),
        )
        .ok()
        .flatten()
        .map(|raw| {
            let (_, body) = split_frontmatter(&raw);
            body
        });

        (true, base_content, status)
    } else {
        (false, None, ForkStatus::Edited)
    };

    let hunks = build_diff_hunks(&canonical_body, &forked_body);

    Ok(ForkDiffPreview {
        canonical_body,
        forked_body,
        base_body,
        has_base,
        hunks,
        fork_status,
    })
}

///
/// **`scope` here is the push destination** (`SkillTarget.scope`); it no
/// longer implies anything about where the canonical master file lives.
/// After `scope-model-simplification`, canonical is always
/// `~/.felina/skills/`; this function only decides per-target push paths.
pub(crate) fn resolve_pair(
    scope: SkillScope,
    project_path: Option<&str>,
    pair: &super::agent_paths::AgentPathPair,
) -> Result<PathBuf, String> {
    match scope {
        SkillScope::Global => Ok(expand_user_path(&pair.global)),
        SkillScope::Project => {
            let pp = project_path.ok_or("project_path required for project scope")?;
            Ok(PathBuf::from(pp).join(&pair.project_relative))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn check_drift_returns_synced_when_hashes_match() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-drift-synced-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let content = "---\nname: test\n---\n# Body\n";
        let path = tmp.join("SKILL.md");
        fs::write(&path, content).unwrap();
        let hash = semantic_hash(content);
        assert_eq!(check_drift(&path, Some(&hash), None, &Default::default(), None), DriftStatus::Synced);
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn check_drift_returns_drifted_when_hashes_differ() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-drift-drifted-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("SKILL.md");
        fs::write(&path, "---\nname: changed\n---\n# New body\n").unwrap();
        let old_hash = semantic_hash("---\nname: original\n---\n# Old body\n");
        assert_eq!(check_drift(&path, Some(&old_hash), None, &Default::default(), None), DriftStatus::Drifted);
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn check_drift_returns_missing_when_file_does_not_exist() {
        let path = std::env::temp_dir().join("felina-drift-nonexistent-SKILL.md");
        assert_eq!(
            check_drift(&path, Some("somehash"), None, &Default::default(), None),
            DriftStatus::Missing
        );
    }

    #[test]
    fn check_drift_returns_no_push_history_when_no_hash() {
        let path = std::env::temp_dir().join("felina-drift-nopush-SKILL.md");
        assert_eq!(check_drift(&path, None, None, &Default::default(), None), DriftStatus::NoPushHistory);
    }

    #[test]
    fn check_drift_mtime_fast_path_returns_synced_without_reading_content() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-drift-mtime-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        let path = tmp.join("SKILL.md");
        // Write content whose hash does NOT match the pushed_hash.
        // If mtime fast-path works, check_drift returns Synced anyway
        // because mtime ≤ push timestamp — it never reads the file.
        fs::write(&path, "---\nname: different\n---\n# Changed\n").unwrap();
        let wrong_hash = semantic_hash("---\nname: original\n---\n# Original\n");
        // Use a far-future push timestamp so file mtime is definitely ≤.
        let future_at = "2099-01-01T00:00:00Z";
        assert_eq!(
            check_drift(&path, Some(&wrong_hash), Some(future_at), &Default::default(), None),
            DriftStatus::Synced,
            "mtime fast-path should return Synced without hash computation"
        );
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn sibling_modified_triggers_drift() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: my-skill\n---\n# Body\n").unwrap();
        let script = skill_dir.join("run.py");
        fs::write(&script, "print('hello')").unwrap();

        let pushed_hash = semantic_hash("---\nname: my-skill\n---\n# Body\n");
        let sib = Some(compute_sibling_hashes(&skill_dir));

        // Modify sibling
        fs::write(&script, "print('modified')").unwrap();
        assert_eq!(
            check_drift(&skill_md, Some(&pushed_hash), None, &sib, None),
            DriftStatus::Drifted,
        );
    }

    #[test]
    fn sibling_deleted_triggers_drift() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: my-skill\n---\n# Body\n").unwrap();
        let script = skill_dir.join("run.py");
        fs::write(&script, "print('hello')").unwrap();

        let pushed_hash = semantic_hash("---\nname: my-skill\n---\n# Body\n");
        let sib = Some(compute_sibling_hashes(&skill_dir));

        // Delete sibling
        fs::remove_file(&script).unwrap();
        assert_eq!(
            check_drift(&skill_md, Some(&pushed_hash), None, &sib, None),
            DriftStatus::Drifted,
        );
    }

    #[test]
    fn sibling_added_on_agent_side_triggers_drift() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: my-skill\n---\n# Body\n").unwrap();

        let pushed_hash = semantic_hash("---\nname: my-skill\n---\n# Body\n");
        // Push with no siblings → Some(empty map)
        let sib = Some(compute_sibling_hashes(&skill_dir));
        assert!(sib.as_ref().unwrap().is_empty());

        // Agent adds a file after push → drifted
        fs::write(skill_dir.join("new.txt"), "surprise").unwrap();
        assert_eq!(
            check_drift(&skill_md, Some(&pushed_hash), None, &sib, None),
            DriftStatus::Drifted,
        );
    }

    #[test]
    fn sibling_added_with_existing_recorded_triggers_drift() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: my-skill\n---\n# Body\n").unwrap();
        fs::write(skill_dir.join("existing.txt"), "existing content").unwrap();

        let pushed_hash = semantic_hash("---\nname: my-skill\n---\n# Body\n");
        let sib = Some(compute_sibling_hashes(&skill_dir));

        // Agent adds extra file → drifted
        fs::write(skill_dir.join("extra.txt"), "extra").unwrap();
        assert_eq!(
            check_drift(&skill_md, Some(&pushed_hash), None, &sib, None),
            DriftStatus::Drifted,
        );
    }

    #[test]
    fn legacy_meta_no_sibling_hashes_does_not_drift() {
        let tmp = tempfile::TempDir::new().unwrap();
        let skill_dir = tmp.path().join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        let skill_md = skill_dir.join("SKILL.md");
        fs::write(&skill_md, "---\nname: my-skill\n---\n# Body\n").unwrap();
        fs::write(skill_dir.join("script.sh"), "#!/bin/bash").unwrap();

        let pushed_hash = semantic_hash("---\nname: my-skill\n---\n# Body\n");
        // None = legacy meta, no siblingHashes field → skip comparison
        assert_eq!(
            check_drift(&skill_md, Some(&pushed_hash), None, &None, None),
            DriftStatus::Synced,
        );
    }

    #[test]
    fn semantic_hash_identical_for_reordered_frontmatter() {
        let a = "---\nagents:\n  - claude\n  - gemini\nname: test\n---\n# Body\n";
        let b = "---\nname: test\nagents:\n  - claude\n  - gemini\n---\n# Body\n";
        assert_eq!(semantic_hash(a), semantic_hash(b));
    }

    #[test]
    fn semantic_hash_identical_despite_trailing_whitespace() {
        let a = "---\nagents:\n  - claude\n---\n# Body\n";
        let b = "---\nagents:\n  - claude\n---\n# Body\n\n  \n";
        assert_eq!(semantic_hash(a), semantic_hash(b));
    }

    #[test]
    fn semantic_hash_spec_scenario_inline_vs_block_sequence() {
        let a = "---\nagents:\n  - claude\n  - gemini\n---\n# Body";
        let b = "---\nagents:\n  - gemini\n  - claude\n---\n# Body  \n";
        // Both have same agents (order within array preserved by YAML — these
        // ARE different values), so hashes differ. But formatting-only diffs
        // (trailing whitespace) are ignored.
        let a_trimmed = "---\nagents:\n  - claude\n  - gemini\n---\n# Body";
        let b_no_ws = "---\nagents:\n  - gemini\n  - claude\n---\n# Body";
        assert_eq!(semantic_hash(a), semantic_hash(a_trimmed));
        assert_eq!(semantic_hash(b), semantic_hash(b_no_ws));
    }

    #[test]
    fn semantic_hash_no_frontmatter_trims_only() {
        let a = "# Just body\n";
        let b = "# Just body\n\n  \n";
        assert_eq!(semantic_hash(a), semantic_hash(b));
    }

    #[test]
    fn semantic_hash_differs_for_different_content() {
        let a = "---\nname: foo\n---\n# A";
        let b = "---\nname: bar\n---\n# A";
        assert_ne!(semantic_hash(a), semantic_hash(b));
    }

    #[test]
    fn iso8601_format_is_well_formed() {
        let t = current_iso8601();
        assert_eq!(t.len(), 20);
        assert!(t.ends_with('Z'));
        assert_eq!(&t[4..5], "-");
        assert_eq!(&t[10..11], "T");
    }

    #[test]
    fn prepare_skill_subdir_rejects_bad_names() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-fanout-test-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        for bad in ["..", "/etc/passwd", "..\\boot", ".hidden", ""] {
            assert!(prepare_skill_subdir(&tmp, bad).is_err(), "bad={bad}");
        }
    }

    // Smoke contract tests (multi-agent-skills-foundation task 8.3 /
    // design Addendum E): cover smoke #2 (fan-out + bundled siblings)
    // and #3 (dirty flip after push). Project scope keeps all writes
    // inside a tempdir; the user's real ~/.claude/.agents/.gemini are
    // never touched.

    use crate::commands::canonical_skills::{
        canonical_skills_list, canonical_skills_write, write_sync_meta_v2, SkillListEntry,
        SkillScope, SkillTarget, SyncMetaV2, TargetMode,
    };
    use std::sync::atomic::{AtomicU32, Ordering};

    /// RAII guard that redirects `felina_home()` to `<tmp>/.felina` on this
    /// thread. Matches the helper in `canonical_skills::tests`.
    struct FelinaHomeGuard;
    impl Drop for FelinaHomeGuard {
        fn drop(&mut self) {
            crate::paths::set_felina_home_override_for_test(None);
        }
    }
    fn override_felina_home(tmp: &std::path::Path) -> FelinaHomeGuard {
        crate::paths::set_felina_home_override_for_test(Some(tmp.join(".felina")));
        FelinaHomeGuard
    }

    fn smoke_tempdir(tag: &str) -> std::path::PathBuf {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("felina-smoke-{tag}-{pid}-{nanos}-{n}"));
        fs::create_dir_all(&dir).expect("mkdir smoke tempdir");
        dir
    }

    fn make_canonical(name: &str, agents: &[&str]) {
        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(name.into()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String(format!("{name} description")),
        );
        let agents_seq = agents
            .iter()
            .map(|a| serde_yaml::Value::String((*a).into()))
            .collect();
        fm.insert(
            serde_yaml::Value::String("agents".into()),
            serde_yaml::Value::Sequence(agents_seq),
        );
        canonical_skills_write(
            name.into(),
            serde_yaml::Value::Mapping(fm),
            format!("# {name}\n\nBody for {name}.\n"),
            None,
        )
        .expect("canonical write");
    }

    #[test]
    fn fan_out_to_three_agents_mirrors_bundled_siblings() {
        let tmp = smoke_tempdir("fanout3");
        let _g = override_felina_home(&tmp);
        make_canonical("smoke-fanout", &["anthropic", "codex", "gemini"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("smoke-fanout");
        let project = tmp.to_string_lossy().to_string();
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![
                    SkillTarget {
                        agent: "anthropic".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "codex".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "gemini".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let scripts = canonical_skill_dir.join("scripts");
        let references = canonical_skill_dir.join("references");
        fs::create_dir_all(&scripts).unwrap();
        fs::create_dir_all(&references).unwrap();
        fs::write(scripts.join("helper.sh"), "#!/bin/sh\necho hi\n").unwrap();
        fs::write(references.join("api.md"), "# API notes\n").unwrap();

        let results = skill_sync_one("smoke-fanout".into()).expect("sync");

        assert_eq!(
            results.len(),
            3,
            "expected 3 SyncResult entries, got {results:#?}"
        );
        for r in &results {
            assert!(r.success, "agent {:?} failed: {:?}", r.agent, r.error);
        }

        // gemini-to-antigravity-cli-default: gemini project target is
        // `.agents/skills` — codex and gemini share that dir by convention,
        // so three agents land in two physical roots and `.gemini/` is gone.
        let target_roots = [
            tmp.join(".claude").join("skills").join("smoke-fanout"),
            tmp.join(".agents").join("skills").join("smoke-fanout"),
        ];
        assert!(
            !tmp.join(".gemini").exists(),
            "legacy .gemini project dir must no longer be written"
        );
        for target in &target_roots {
            assert!(
                target.join("SKILL.md").is_file(),
                "missing SKILL.md in {target:?}"
            );
            assert!(
                target.join("scripts").join("helper.sh").is_file(),
                "bundled scripts/helper.sh missing in {target:?}"
            );
            assert!(
                target.join("references").join("api.md").is_file(),
                "bundled references/api.md missing in {target:?}"
            );
            assert!(
                !target.join(".felina-sync-meta.json").exists(),
                "sync-meta leaked into target {target:?}"
            );
        }

        let meta_path = canonical_skill_dir.join(".felina-sync-meta.json");
        assert!(meta_path.is_file(), "sync-meta sidecar not written");
        let meta: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&meta_path).unwrap()).unwrap();
        // After path-bug-and-target-model, sidecars are upgraded to v2 on push.
        assert_eq!(meta["version"], 2);
        assert_eq!(meta["dirty"], serde_json::Value::Bool(false));
        let last_sync = meta["lastSync"].as_object().expect("lastSync object");
        assert_eq!(last_sync.len(), 3, "expected one lastSync entry per target");
    }

    #[test]
    fn disabled_and_detached_targets_are_skipped() {
        // Construct a canonical (agents = [anthropic]) so backfill gives one
        // tracked target. Then manually overwrite the sidecar with three
        // targets: one tracked enabled (anthropic), one detached (codex),
        // one disabled (gemini). Only anthropic should be written. Codex and
        // gemini both map to the shared `.agents/skills` project dir, so the
        // detached/disabled assertion below is collision-free: nothing may
        // create that dir.
        let tmp = smoke_tempdir("skip");
        let _g = override_felina_home(&tmp);
        make_canonical("skip-targets", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("skip-targets");
        let project = tmp.to_string_lossy().to_string();

        let sidecar = serde_json::json!({
            "version": 2,
            "targets": [
                { "agent": "anthropic", "scope": "project", "project": project, "enabled": true,  "mode": "tracked" },
                { "agent": "codex",     "scope": "project", "project": project, "enabled": true,  "mode": "detached" },
                { "agent": "gemini",    "scope": "project", "project": project, "enabled": false, "mode": "tracked" }
            ],
            "lastSync": {},
            "dirty": true
        });
        fs::write(
            canonical_skill_dir.join(".felina-sync-meta.json"),
            serde_json::to_string_pretty(&sidecar).unwrap(),
        )
        .unwrap();

        let results = skill_sync_one("skip-targets".into()).expect("sync");

        // Only anthropic should produce a SyncResult.
        assert_eq!(results.len(), 1, "expected one result, got {results:#?}");
        assert_eq!(results[0].agent, "anthropic".to_string());
        assert!(
            results[0].success,
            "anthropic push failed: {:?}",
            results[0].error
        );

        // Shared `.agents/skills` dir: codex (detached) and gemini (disabled)
        // both map here — neither may write, so the dir must not exist at all.
        assert!(
            !tmp.join(".agents")
                .join("skills")
                .join("skip-targets")
                .exists(),
            "detached/disabled target was written into shared .agents dir",
        );
        assert!(
            tmp.join(".claude")
                .join("skills")
                .join("skip-targets")
                .join("SKILL.md")
                .is_file(),
            "anthropic (tracked enabled) target NOT written",
        );

        // last_sync should ONLY have the anthropic entry.
        let after_meta: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let last_sync = after_meta["lastSync"].as_object().unwrap();
        assert_eq!(
            last_sync.len(),
            1,
            "expected 1 last_sync entry, got {last_sync:?}"
        );
        let anthropic_key = format!("anthropic:project:{}", project);
        assert!(
            last_sync.contains_key(&anthropic_key),
            "missing key {anthropic_key} in {last_sync:?}"
        );
    }

    #[test]
    fn per_target_pushed_hash_and_at_recorded() {
        let tmp = smoke_tempdir("hashat");
        let _g = override_felina_home(&tmp);
        make_canonical("hash-skill", &["anthropic", "gemini"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("hash-skill");
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![
                    SkillTarget {
                        agent: "anthropic".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "gemini".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let results = skill_sync_one("hash-skill".into()).expect("sync");
        let _ = project;
        assert!(results.iter().all(|r| r.success), "{results:#?}");

        let after_meta: serde_json::Value = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();

        let last_sync = after_meta["lastSync"].as_object().expect("lastSync object");
        assert_eq!(last_sync.len(), 2, "two targets pushed, got {last_sync:?}");

        for (key, entry) in last_sync {
            let hash = entry["pushedHash"].as_str().expect("pushedHash string");
            assert_eq!(
                hash.len(),
                64,
                "SHA-256 hex must be 64 chars, key={key} got {hash:?}"
            );
            assert!(
                hash.chars().all(|c| c.is_ascii_hexdigit()),
                "non-hex pushedHash {hash}"
            );

            let at = entry["at"].as_str().expect("at string");
            assert_eq!(
                at.len(),
                20,
                "ISO-8601 'YYYY-MM-DDTHH:MM:SSZ' length, key={key} got {at}"
            );
            assert!(at.ends_with('Z'));
        }
    }

    #[test]
    fn sync_meta_dirty_flips_false_after_successful_push() {
        let tmp = smoke_tempdir("dirty");
        let _g = override_felina_home(&tmp);
        make_canonical("smoke-dirty", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("smoke-dirty");
        let meta_path = canonical_skill_dir.join(".felina-sync-meta.json");
        fs::write(&meta_path, r#"{"dirty":true,"last_synced":null}"#).unwrap();

        let before = canonical_skills_list().expect("list before");
        match &before[0] {
            SkillListEntry::Ok { skill, .. } => {
                assert!(skill.dirty, "expected dirty=true before push")
            }
            other => panic!("expected Ok entry, got {other:?}"),
        }

        let results = skill_sync_one("smoke-dirty".into()).expect("sync");
        assert!(
            results.iter().all(|r| r.success),
            "push failed: {results:#?}"
        );

        let after_meta: serde_json::Value =
            serde_json::from_str(&fs::read_to_string(&meta_path).unwrap()).unwrap();
        assert_eq!(after_meta["version"], 2);
        assert_eq!(after_meta["dirty"], serde_json::Value::Bool(false));
        let last_sync = after_meta["lastSync"].as_object().expect("lastSync object");
        assert_eq!(
            last_sync.len(),
            1,
            "anthropic-only skill: one lastSync entry"
        );

        let after = canonical_skills_list().expect("list after");
        match &after[0] {
            SkillListEntry::Ok { skill, .. } => {
                assert!(!skill.dirty, "expected dirty=false after push");
                assert!(
                    skill.last_synced.is_some(),
                    "expected last_synced populated"
                );
            }
            other => panic!("expected Ok entry, got {other:?}"),
        }
    }

    /// Task 4.1: a broken (unparseable) canonical skill is never fanned out.
    /// `skill_sync_one` errors with the parse error; `skill_sync_all` skips it
    /// (no agent file written, no SyncResult attributed to it).
    #[test]
    fn broken_canonical_skill_is_not_pushed() {
        use crate::commands::canonical_skills::parse_skill_md;
        let tmp = smoke_tempdir("pushguard");
        let _g = override_felina_home(&tmp);

        // Plant a broken canonical skill directly (non-mapping frontmatter root).
        let broken_dir = tmp.join(".felina").join("skills").join("broken-push");
        fs::create_dir_all(&broken_dir).unwrap();
        let broken_content = "---\n- not\n- a mapping\n---\n# Body\n";
        fs::write(broken_dir.join("SKILL.md"), broken_content).unwrap();
        assert!(
            parse_skill_md(broken_content).is_err(),
            "fixture must be unparseable"
        );

        // Give it a tracked target so, absent the guard, push would write.
        let project = tmp.to_string_lossy().to_string();
        write_sync_meta_v2(
            &broken_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        // sync_one must error (parse gate), not push.
        let one = skill_sync_one("broken-push".into());
        assert!(
            one.is_err(),
            "broken skill must not push via sync_one: {one:?}"
        );

        // sync_all must skip the broken entry entirely.
        let all = skill_sync_all().expect("sync_all returns Ok overall");
        let agent_dir = tmp.join(".claude").join("skills").join("broken-push");
        assert!(
            !agent_dir.join("SKILL.md").exists(),
            "broken skill must not be fanned out to an agent dir"
        );
        assert!(
            all.iter().all(|r| !r.target_path.contains("broken-push")),
            "no SyncResult should target the broken skill: {all:#?}"
        );
    }

    /// Task 8.3: fan-out uses the canonical directory identity, not parsed
    /// frontmatter `name`. A skill at `~/.felina/skills/smoke-nested/` with
    /// frontmatter `name: real` must push to `smoke-nested/`, not `real/`.
    #[test]
    fn fan_out_uses_canonical_directory_not_parsed_name() {
        let tmp = smoke_tempdir("id-fanout");
        let _g = override_felina_home(&tmp);

        let skills_root = tmp.join(".felina").join("skills");
        let skill_dir = skills_root.join("smoke-nested");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: real\ndescription: test\nagents:\n  - anthropic\n---\nbody\n",
        )
        .unwrap();

        let project = tmp.to_string_lossy().to_string();
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let results = skill_sync_one("smoke-nested".into()).expect("sync");
        assert_eq!(results.len(), 1);
        assert!(results[0].success, "push failed: {:?}", results[0].error);

        let correct_dir = tmp.join(".claude").join("skills").join("smoke-nested");
        assert!(
            correct_dir.join("SKILL.md").is_file(),
            "push must write to canonical dir name 'smoke-nested'"
        );

        let wrong_dir = tmp.join(".claude").join("skills").join("real");
        assert!(
            !wrong_dir.exists(),
            "push must NOT write to parsed frontmatter name 'real'"
        );

        let rendered = fs::read_to_string(correct_dir.join("SKILL.md")).unwrap();
        assert!(
            rendered.contains("name: smoke-nested"),
            "rendered SKILL.md must contain canonical name: {rendered}"
        );
    }

    /// Task 10.3: the per-row "Open target folder" resolver reports the
    /// canonical-identity destination and its on-disk existence, so the UI can
    /// disable the button until a push has actually created the folder.
    #[test]
    fn target_dir_resolve_reports_canonical_path_and_existence() {
        let tmp = smoke_tempdir("resolvedir");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        // Before any push the destination does not exist.
        let before = skill_target_dir_resolve(
            "smoke-nested".into(),
            "anthropic".to_string(),
            SkillScope::Project,
            Some(project.clone()),
        )
        .expect("resolve");
        assert!(!before.exists, "destination should not exist before push");
        assert!(
            before
                .path
                .replace('\\', "/")
                .ends_with(".claude/skills/smoke-nested"),
            "path must use canonical identity: {}",
            before.path,
        );

        // Create the destination; existence flips true.
        let dest = tmp.join(".claude").join("skills").join("smoke-nested");
        fs::create_dir_all(&dest).unwrap();
        let after = skill_target_dir_resolve(
            "smoke-nested".into(),
            "anthropic".to_string(),
            SkillScope::Project,
            Some(project),
        )
        .expect("resolve");
        assert!(after.exists, "destination should exist after creation");
    }

    /// `TargetDirInfo.path` SHALL be display-normalized: no backslashes,
    /// original case preserved. Covers the fan_out side of the
    /// `Backend Display-Path Normalization` requirement.
    #[test]
    fn target_dir_resolve_normalizes_path_for_display() {
        let tmp = smoke_tempdir("resolvedir-normalize");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        let info = skill_target_dir_resolve(
            "smoke-nested".into(),
            "anthropic".to_string(),
            SkillScope::Project,
            Some(project),
        )
        .expect("resolve");
        assert!(
            !info.path.contains('\\'),
            "path must be display-normalized (no backslashes): {}",
            info.path
        );
    }

    #[test]
    fn preview_classifies_targets_and_does_not_mutate_files_or_sync_meta() {
        let tmp = smoke_tempdir("preview");
        let _g = override_felina_home(&tmp);
        make_canonical("preview-skill", &["anthropic", "codex", "gemini"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("preview-skill");
        let project = tmp.to_string_lossy().to_string();
        let anthropic = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        let codex = SkillTarget {
            agent: "codex".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        // gemini-to-antigravity-cli-default: gemini's project dir is the
        // same `.agents/skills` codex uses. To exercise an independent
        // drifted gemini target, point it at a second project root.
        let project2_root = tmp.join("proj2");
        fs::create_dir_all(&project2_root).unwrap();
        let project2 = project2_root.to_string_lossy().to_string();
        let gemini = SkillTarget {
            agent: "gemini".to_string(),
            scope: SkillScope::Project,
            project: Some(project2.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };

        let codex_dir = tmp.join(".agents").join("skills").join("preview-skill");
        fs::create_dir_all(&codex_dir).unwrap();
        fs::write(
            codex_dir.join("SKILL.md"),
            "---\nname: preview-skill\ndescription: preview-skill description\n---\n# preview-skill\n\nBody for preview-skill.\n",
        )
        .unwrap();

        let gemini_dir = project2_root
            .join(".agents")
            .join("skills")
            .join("preview-skill");
        fs::create_dir_all(&gemini_dir).unwrap();
        fs::write(gemini_dir.join("SKILL.md"), "external edit\n").unwrap();

        let mut last_sync = std::collections::BTreeMap::new();
        last_sync.insert(
            target_key(&gemini),
            LastSyncEntry {
                pushed_hash: sha256_hex("previous push\n"),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
                sibling_hashes: None,
            },
        );
        let meta = SyncMetaV2 {
            version: 2,
            targets: vec![anthropic.clone(), codex.clone(), gemini.clone()],
            last_sync,
            dirty: true,
            directory_hash: None,
        };
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();
        let before_meta =
            fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap();

        let preview = skill_sync_preview("preview-skill".into()).expect("preview");

        assert_eq!(preview.items.len(), 3);
        assert_eq!(preview.summary.create, 1);
        assert_eq!(preview.summary.no_op, 1);
        assert_eq!(preview.summary.blocked_drift, 1);
        assert_eq!(preview.summary.overwrite, 0);
        assert_eq!(preview.summary.overwrite_unknown, 0);

        assert!(
            !tmp.join(".claude")
                .join("skills")
                .join("preview-skill")
                .exists(),
            "preview must not create missing target dirs",
        );
        assert_eq!(
            fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
            before_meta,
            "preview must not update sync-meta",
        );
        assert_eq!(
            fs::read_to_string(gemini_dir.join("SKILL.md")).unwrap(),
            "external edit\n",
            "preview must not overwrite drifted files",
        );
    }

    #[test]
    fn commit_blocks_drift_until_override_and_detach_are_explicit() {
        let tmp = smoke_tempdir("commit-drift");
        let _g = override_felina_home(&tmp);
        make_canonical("commit-skill", &["anthropic", "gemini"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("commit-skill");
        let project = tmp.to_string_lossy().to_string();
        let anthropic = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        let gemini = SkillTarget {
            agent: "gemini".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };

        let anthropic_dir = tmp.join(".claude").join("skills").join("commit-skill");
        // gemini project target resolves to `.agents/skills` since
        // gemini-to-antigravity-cli-default (no codex target here, no sharing).
        let gemini_dir = tmp.join(".agents").join("skills").join("commit-skill");
        fs::create_dir_all(&anthropic_dir).unwrap();
        fs::create_dir_all(&gemini_dir).unwrap();
        fs::write(anthropic_dir.join("SKILL.md"), "anthropic drift\n").unwrap();
        fs::write(gemini_dir.join("SKILL.md"), "gemini drift\n").unwrap();

        let mut last_sync = std::collections::BTreeMap::new();
        last_sync.insert(
            target_key(&anthropic),
            LastSyncEntry {
                pushed_hash: sha256_hex("old anthropic\n"),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
                sibling_hashes: None,
            },
        );
        last_sync.insert(
            target_key(&gemini),
            LastSyncEntry {
                pushed_hash: sha256_hex("old gemini\n"),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
                sibling_hashes: None,
            },
        );
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![anthropic.clone(), gemini.clone()],
                last_sync,
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let cancelled = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "commit-skill".into(),
            resolutions: vec![],
        })
        .expect("cancelled commit returns per-target results");
        assert!(cancelled.iter().all(|r| r.success), "{cancelled:#?}");
        assert_eq!(
            fs::read_to_string(anthropic_dir.join("SKILL.md")).unwrap(),
            "anthropic drift\n",
            "blocked drift must not write",
        );

        let committed = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "commit-skill".into(),
            resolutions: vec![
                SkillSyncResolution {
                    target_key: target_key(&anthropic),
                    resolution: SkillSyncDriftResolution::Override,
                },
                SkillSyncResolution {
                    target_key: target_key(&gemini),
                    resolution: SkillSyncDriftResolution::Detach,
                },
            ],
        })
        .expect("resolved commit");

        let anth_result = committed
            .iter()
            .find(|r| r.agent == "anthropic".to_string())
            .expect("anthropic result");
        assert!(anth_result.success, "{committed:#?}");
        assert!(
            fs::read_to_string(anthropic_dir.join("SKILL.md"))
                .unwrap()
                .contains("name: commit-skill"),
            "override must write rendered canonical content",
        );
        assert_eq!(
            fs::read_to_string(gemini_dir.join("SKILL.md")).unwrap(),
            "gemini drift\n",
            "detach must preserve drifted file",
        );

        let meta: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        assert!(meta.last_sync.contains_key(&target_key(&anthropic)));
        let gemini_after = meta
            .targets
            .iter()
            .find(|t| t.agent == "gemini".to_string())
            .expect("gemini target survives");
        assert_eq!(gemini_after.mode, TargetMode::Detached);
        assert!(
            !meta.dirty,
            "after override + detach no enabled tracked target remains pending",
        );
    }

    #[test]
    fn lazy_migration_legacy_hash_triggers_drift_then_push_upgrades() {
        let tmp = smoke_tempdir("lazymig");
        let _g = override_felina_home(&tmp);
        make_canonical("mig-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("mig-skill");
        let project = tmp.to_string_lossy().to_string();
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };

        // First push to create the target file.
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target.clone()],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results = skill_sync_one("mig-skill".into()).expect("initial push");
        assert!(results[0].success);

        // Read the semantic hash that was just written.
        let meta_after_push: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let key = target_key(&target);
        // Simulate legacy state: overwrite pushed_hash with a raw sha256_hex,
        // then modify the canonical so rendered ≠ current on disk. This is the
        // realistic lazy migration path: old push wrote a raw hash, then the
        // canonical was edited, and now preview sees current != last_sync.
        let target_skill_md = tmp
            .join(".claude")
            .join("skills")
            .join("mig-skill")
            .join("SKILL.md");
        let rendered = fs::read_to_string(&target_skill_md).unwrap();
        let raw_hash = sha256_hex(&rendered);

        let mut legacy_meta = meta_after_push.clone();
        legacy_meta.last_sync.insert(
            key.clone(),
            LastSyncEntry {
                pushed_hash: raw_hash.clone(),
                base_snapshot: None,
                at: "2026-01-01T00:00:00Z".into(),
                sibling_hashes: None,
            },
        );
        write_sync_meta_v2(&canonical_skill_dir, &legacy_meta).unwrap();

        // Update canonical content so rendered hash changes.
        let skill_md_path = canonical_skill_dir.join("SKILL.md");
        let mut content = fs::read_to_string(&skill_md_path).unwrap();
        content.push_str("\nUpdated body.\n");
        fs::write(&skill_md_path, &content).unwrap();

        // Preview: rendered ≠ current, current ≠ last_sync (legacy raw hash)
        // → BlockedDrift.
        let preview = skill_sync_preview("mig-skill".into()).expect("preview");
        let item = &preview.items[0];
        assert_eq!(
            item.operation,
            SkillSyncPreviewOperation::BlockedDrift,
            "legacy hash + changed canonical must trigger BlockedDrift, got {:?}",
            item.operation
        );

        // Commit with Override to upgrade the hash.
        let committed = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "mig-skill".into(),
            resolutions: vec![SkillSyncResolution {
                target_key: key.clone(),
                resolution: SkillSyncDriftResolution::Override,
            }],
        })
        .expect("commit override");
        assert!(committed[0].success);

        // After override-push, the stored hash should be a semantic hash (not raw).
        let final_meta: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let new_pushed = &final_meta.last_sync[&key].pushed_hash;
        assert_ne!(new_pushed, &raw_hash, "pushed hash must not be the old raw hash");
        let new_rendered = fs::read_to_string(&target_skill_md).unwrap();
        assert_eq!(new_pushed, &semantic_hash(&new_rendered));

        // Preview should now show NoOp.
        let after_preview = skill_sync_preview("mig-skill".into()).expect("after preview");
        assert_eq!(after_preview.items[0].operation, SkillSyncPreviewOperation::NoOp);
    }

    #[test]
    fn unknown_extras_preserved_in_canonical_but_not_emitted() {
        let tmp = smoke_tempdir("unknown-extras");
        let _g = override_felina_home(&tmp);

        // Write a canonical skill with an unknown field in frontmatter.
        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String("d".into()),
        );
        fm.insert(
            serde_yaml::Value::String("agents".into()),
            serde_yaml::Value::Sequence(vec![
                serde_yaml::Value::String("anthropic".into()),
                serde_yaml::Value::String("codex".into()),
                serde_yaml::Value::String("gemini".into()),
            ]),
        );
        fm.insert(
            serde_yaml::Value::String("vendor_future_flag".into()),
            serde_yaml::Value::Bool(true),
        );
        canonical_skills_write(
            "unknown-test".into(),
            serde_yaml::Value::Mapping(fm),
            "body\n".into(),
            None,
        )
        .unwrap();

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("unknown-test");
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![
                    SkillTarget {
                        agent: "anthropic".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "codex".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "gemini".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        skill_sync_one("unknown-test".into()).unwrap();

        // Canonical should still have the unknown field.
        let canonical_raw = fs::read_to_string(canonical_skill_dir.join("SKILL.md")).unwrap();
        assert!(
            canonical_raw.contains("vendor_future_flag"),
            "unknown field must be preserved in canonical"
        );

        // No target SKILL.md should contain the unknown field.
        for subdir in [".claude/skills", ".agents/skills", ".gemini/skills"] {
            let md_path = tmp.join(subdir).join("unknown-test").join("SKILL.md");
            if md_path.is_file() {
                let md = fs::read_to_string(&md_path).unwrap();
                assert!(
                    !md.contains("vendor_future_flag"),
                    "{subdir} output leaked unknown field:\n{md}"
                );
            }
        }
    }

    #[test]
    fn skill_sync_all_preview_includes_dirty_with_pushable_targets() {
        let tmp = smoke_tempdir("allprev-dirty");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        make_canonical("alpha", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("alpha"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let result = skill_sync_all_preview().expect("all preview");
        assert_eq!(result.skills.len(), 1);
        assert_eq!(result.skills[0].skill_name, "alpha");
    }

    #[test]
    fn skill_sync_all_preview_excludes_clean_skill() {
        let tmp = smoke_tempdir("allprev-clean");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        make_canonical("beta", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("beta"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        let result = skill_sync_all_preview().expect("all preview");
        assert!(
            result.skills.is_empty(),
            "clean skill should not appear in Push all preview"
        );
    }

    #[test]
    fn skill_sync_all_preview_excludes_dirty_targetless_skill() {
        let tmp = smoke_tempdir("allprev-notgt");
        let _g = override_felina_home(&tmp);

        make_canonical("gamma", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("gamma"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let result = skill_sync_all_preview().expect("all preview");
        assert!(
            result.skills.is_empty(),
            "dirty skill with no pushable targets should not appear"
        );
    }

    #[test]
    fn skill_sync_all_preview_excludes_dirty_detached_only() {
        let tmp = smoke_tempdir("allprev-detach");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        make_canonical("delta", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("delta"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Detached,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let result = skill_sync_all_preview().expect("all preview");
        assert!(
            result.skills.is_empty(),
            "dirty skill with only detached targets should not appear"
        );
    }

    #[test]
    fn skill_sync_all_preview_summary_reflects_filtered_only() {
        let tmp = smoke_tempdir("allprev-sum");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        make_canonical("dirty-one", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("dirty-one"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        make_canonical("clean-one", &["anthropic"]);
        write_sync_meta_v2(
            &tmp.join(".felina").join("skills").join("clean-one"),
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        let result = skill_sync_all_preview().expect("all preview");
        assert_eq!(result.skills.len(), 1, "only dirty skill included");
        assert_eq!(result.skills[0].skill_name, "dirty-one");
        assert_eq!(
            result.summary.create + result.summary.overwrite + result.summary.no_op,
            result.skills[0].summary.create
                + result.skills[0].summary.overwrite
                + result.skills[0].summary.no_op,
            "summary must reflect only included skills"
        );
    }

    #[test]
    fn skill_drift_scan_detects_synced_and_drifted_targets() {
        let tmp = smoke_tempdir("driftscan");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        // Skill A: push to anthropic → target will be synced
        make_canonical("scan-a", &["anthropic"]);
        let scan_a_dir = tmp.join(".felina").join("skills").join("scan-a");
        write_sync_meta_v2(
            &scan_a_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results_a = skill_sync_one("scan-a".into()).expect("push scan-a");
        assert!(results_a[0].success);

        // Skill B: push to gemini, then externally modify → drifted
        make_canonical("scan-b", &["gemini"]);
        let scan_b_dir = tmp.join(".felina").join("skills").join("scan-b");
        write_sync_meta_v2(
            &scan_b_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "gemini".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results_b = skill_sync_one("scan-b".into()).expect("push scan-b");
        assert!(results_b[0].success);

        // Externally modify scan-b's gemini target (project dir is
        // `.agents/skills` since gemini-to-antigravity-cli-default)
        let gemini_skill_md = tmp
            .join(".agents")
            .join("skills")
            .join("scan-b")
            .join("SKILL.md");
        fs::write(&gemini_skill_md, "---\nname: scan-b\n---\n# Externally changed\n").unwrap();

        let scan = skill_drift_scan().expect("drift scan");

        // scan-a → synced
        let scan_a_map = scan.get("scan-a").expect("scan-a in result");
        let a_key = format!("anthropic:project:{project}");
        assert_eq!(
            scan_a_map.get(&a_key).copied(),
            Some(DriftStatus::Synced),
            "scan-a target should be synced"
        );

        // scan-b → drifted
        let scan_b_map = scan.get("scan-b").expect("scan-b in result");
        let b_key = format!("gemini:project:{project}");
        assert_eq!(
            scan_b_map.get(&b_key).copied(),
            Some(DriftStatus::Drifted),
            "scan-b target should be drifted"
        );
    }

    #[test]
    fn pull_from_target_errors_on_missing_canonical_dir() {
        let result = skill_pull_from_target(
            "nonexistent-skill-12345".to_string(),
            "anthropic:global".to_string(),
            None,
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("not found"));
    }

    #[test]
    fn build_diff_hunks_detects_added_and_deleted_lines() {
        let old = "line1\nline2\nline3\n";
        let new = "line1\nmodified\nline3\nextra\n";
        let hunks = build_diff_hunks(old, new);
        assert!(!hunks.is_empty());
        let all_lines: Vec<&str> = hunks.iter().flat_map(|h| h.lines.iter().map(|l| l.kind.as_str())).collect();
        assert!(all_lines.contains(&"delete"));
        assert!(all_lines.contains(&"add"));
        assert!(all_lines.contains(&"context"));
    }

    #[test]
    fn build_diff_hunks_returns_empty_for_identical() {
        let text = "same\ncontent\n";
        let hunks = build_diff_hunks(text, text);
        assert!(hunks.is_empty());
    }

    fn tmp_dir(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "felina-sibling-{}-{}-{}",
            label,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ))
    }

    #[test]
    fn push_cleans_orphan_siblings_from_agent_side() {
        let tmp = smoke_tempdir("orphan-clean");
        let _g = override_felina_home(&tmp);
        make_canonical("orphan-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("orphan-skill");
        let project = tmp.to_string_lossy().to_string();

        // Add a sibling to canonical, push once to establish baseline
        fs::write(canonical_skill_dir.join("script.py"), "print('hello')").unwrap();
        fs::write(canonical_skill_dir.join("keep.txt"), "keep me").unwrap();
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results = skill_sync_one("orphan-skill".into()).expect("initial push");
        assert!(results[0].success);

        let agent_skill_dir = tmp.join(".claude").join("skills").join("orphan-skill");
        assert!(agent_skill_dir.join("script.py").is_file());
        assert!(agent_skill_dir.join("keep.txt").is_file());

        // Now delete script.py from canonical (keep.txt remains)
        fs::remove_file(canonical_skill_dir.join("script.py")).unwrap();

        // Mark dirty and re-push
        let mut meta: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        meta.dirty = true;
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();

        let results2 = skill_sync_one("orphan-skill".into()).expect("second push");
        assert!(results2[0].success);

        // Agent-side script.py should be deleted (orphan), keep.txt should remain
        assert!(
            !agent_skill_dir.join("script.py").exists(),
            "orphan sibling script.py should be cleaned from agent side"
        );
        assert!(
            agent_skill_dir.join("keep.txt").is_file(),
            "non-orphan sibling keep.txt should remain"
        );
    }

    #[test]
    fn push_preserves_agent_manual_additions() {
        let tmp = smoke_tempdir("orphan-manual");
        let _g = override_felina_home(&tmp);
        make_canonical("manual-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("manual-skill");
        let project = tmp.to_string_lossy().to_string();

        fs::write(canonical_skill_dir.join("bundled.txt"), "from canonical").unwrap();
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results = skill_sync_one("manual-skill".into()).expect("initial push");
        assert!(results[0].success);

        let agent_skill_dir = tmp.join(".claude").join("skills").join("manual-skill");
        // Agent manually adds a file (not in baseline)
        fs::write(agent_skill_dir.join("notes.txt"), "my notes").unwrap();

        // Re-push (mark dirty)
        let mut meta: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        meta.dirty = true;
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();

        let results2 = skill_sync_one("manual-skill".into()).expect("second push");
        assert!(results2[0].success);

        // Agent-side notes.txt should NOT be deleted (not in baseline)
        assert!(
            agent_skill_dir.join("notes.txt").is_file(),
            "agent-side manual addition should not be deleted"
        );
    }

    #[test]
    fn push_with_legacy_meta_skips_orphan_cleanup() {
        let tmp = smoke_tempdir("orphan-legacy");
        let _g = override_felina_home(&tmp);
        make_canonical("legacy-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("legacy-skill");
        let project = tmp.to_string_lossy().to_string();

        // Manually set up a legacy sidecar (sibling_hashes = None)
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        let key = target_key(&target);
        let mut last_sync = std::collections::BTreeMap::new();
        last_sync.insert(
            key,
            LastSyncEntry {
                pushed_hash: "fakehash".into(),
                base_snapshot: None,
                at: "2026-01-01T00:00:00Z".into(),
                sibling_hashes: None, // legacy
            },
        );
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync,
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        // Create the agent-side dir with a file that would be an "orphan" if
        // baseline existed
        let agent_skill_dir = tmp.join(".claude").join("skills").join("legacy-skill");
        fs::create_dir_all(&agent_skill_dir).unwrap();
        fs::write(agent_skill_dir.join("old-file.txt"), "should survive").unwrap();

        let results = skill_sync_one("legacy-skill".into()).expect("push");
        assert!(results[0].success);

        // With legacy meta (sibling_hashes = None), nothing should be deleted
        assert!(
            agent_skill_dir.join("old-file.txt").is_file(),
            "legacy meta push should not delete any siblings"
        );
    }

    #[test]
    fn preview_includes_orphan_siblings_list() {
        let tmp = smoke_tempdir("orphan-preview");
        let _g = override_felina_home(&tmp);
        make_canonical("prev-orphan", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("prev-orphan");
        let project = tmp.to_string_lossy().to_string();

        // Add siblings and push to establish baseline
        fs::write(canonical_skill_dir.join("keep.txt"), "keep").unwrap();
        fs::write(canonical_skill_dir.join("remove.txt"), "remove").unwrap();
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results = skill_sync_one("prev-orphan".into()).expect("initial push");
        assert!(results[0].success);

        // Delete remove.txt from canonical
        fs::remove_file(canonical_skill_dir.join("remove.txt")).unwrap();

        // Preview should list remove.txt as orphan
        let preview = skill_sync_preview("prev-orphan".into()).expect("preview");
        assert_eq!(preview.orphan_siblings, vec!["remove.txt".to_string()]);
    }

    #[test]
    fn push_with_empty_baseline_skips_orphan_cleanup() {
        let tmp = smoke_tempdir("orphan-empty");
        let _g = override_felina_home(&tmp);
        make_canonical("empty-baseline", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("empty-baseline");
        let project = tmp.to_string_lossy().to_string();

        // Push with no siblings to establish empty baseline
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();
        let results = skill_sync_one("empty-baseline".into()).expect("initial push");
        assert!(results[0].success);

        let agent_skill_dir = tmp.join(".claude").join("skills").join("empty-baseline");
        // Agent manually adds a file
        fs::write(agent_skill_dir.join("manual.txt"), "manual").unwrap();

        // Re-push
        let mut meta: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        meta.dirty = true;
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();

        let results2 = skill_sync_one("empty-baseline".into()).expect("second push");
        assert!(results2[0].success);

        // Empty baseline → no orphans to clean → manual file survives
        assert!(
            agent_skill_dir.join("manual.txt").is_file(),
            "empty baseline push should not delete any siblings"
        );
    }

    #[test]
    fn sibling_changes_legacy_none_returns_empty() {
        let canonical = tmp_dir("leg-can");
        let agent = tmp_dir("leg-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(agent.join("extra.txt"), "data").unwrap();
        let result = compute_sibling_changes(None, &canonical, &agent);
        assert!(result.is_empty());
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn sibling_changes_empty_pushed_detects_added() {
        let canonical = tmp_dir("emp-can");
        let agent = tmp_dir("emp-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(agent.join("new.py"), "print('hi')").unwrap();
        let pushed = std::collections::BTreeMap::new();
        let result = compute_sibling_changes(Some(&pushed), &canonical, &agent);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "new.py");
        assert_eq!(result[0].status, SiblingStatus::Added);
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn sibling_changes_detects_modified() {
        let canonical = tmp_dir("mod-can");
        let agent = tmp_dir("mod-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        let original = "original content";
        let modified = "modified content";
        fs::write(canonical.join("file.txt"), original).unwrap();
        fs::write(agent.join("file.txt"), modified).unwrap();
        let mut pushed = std::collections::BTreeMap::new();
        let orig_hash = format!("{:x}", Sha256::digest(original.as_bytes()));
        pushed.insert("file.txt".into(), orig_hash);
        let result = compute_sibling_changes(Some(&pushed), &canonical, &agent);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "file.txt");
        assert_eq!(result[0].status, SiblingStatus::Modified);
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn sibling_changes_detects_deleted() {
        let canonical = tmp_dir("del-can");
        let agent = tmp_dir("del-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        let content = "to be deleted";
        fs::write(canonical.join("old.txt"), content).unwrap();
        // agent side: file deleted (not present)
        let mut pushed = std::collections::BTreeMap::new();
        let hash = format!("{:x}", Sha256::digest(content.as_bytes()));
        pushed.insert("old.txt".into(), hash);
        let result = compute_sibling_changes(Some(&pushed), &canonical, &agent);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "old.txt");
        assert_eq!(result[0].status, SiblingStatus::Deleted);
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn sibling_changes_detects_conflict() {
        let canonical = tmp_dir("con-can");
        let agent = tmp_dir("con-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(canonical.join("shared.txt"), "canonical edit").unwrap();
        fs::write(agent.join("shared.txt"), "agent edit").unwrap();
        let mut pushed = std::collections::BTreeMap::new();
        let orig_hash = format!("{:x}", Sha256::digest(b"original"));
        pushed.insert("shared.txt".into(), orig_hash);
        let result = compute_sibling_changes(Some(&pushed), &canonical, &agent);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].path, "shared.txt");
        assert_eq!(result[0].status, SiblingStatus::Conflict);
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn apply_sibling_copies_added_and_deletes_removed() {
        let canonical = tmp_dir("apply-can");
        let agent = tmp_dir("apply-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        // Added: agent has new.py
        fs::write(agent.join("new.py"), "print('hi')").unwrap();
        // Deleted: canonical has old.txt
        fs::write(canonical.join("old.txt"), "bye").unwrap();
        // Modified: agent modified existing.txt
        fs::write(canonical.join("existing.txt"), "original").unwrap();
        fs::write(agent.join("existing.txt"), "modified").unwrap();

        let changes = vec![
            SiblingChange { path: "new.py".into(), status: SiblingStatus::Added },
            SiblingChange { path: "old.txt".into(), status: SiblingStatus::Deleted },
            SiblingChange { path: "existing.txt".into(), status: SiblingStatus::Modified },
        ];
        apply_sibling_changes(&changes, &[], &canonical, &agent).unwrap();

        assert!(canonical.join("new.py").exists());
        assert!(!canonical.join("old.txt").exists());
        assert_eq!(fs::read_to_string(canonical.join("existing.txt")).unwrap(), "modified");
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn apply_sibling_conflict_use_agent_overwrites() {
        let canonical = tmp_dir("conf-can");
        let agent = tmp_dir("conf-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(canonical.join("shared.txt"), "canonical ver").unwrap();
        fs::write(agent.join("shared.txt"), "agent ver").unwrap();

        let changes = vec![
            SiblingChange { path: "shared.txt".into(), status: SiblingStatus::Conflict },
        ];
        apply_sibling_changes(&changes, &[SiblingResolution::UseAgent], &canonical, &agent).unwrap();
        assert_eq!(fs::read_to_string(canonical.join("shared.txt")).unwrap(), "agent ver");
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn apply_sibling_conflict_use_canonical_keeps_original() {
        let canonical = tmp_dir("confk-can");
        let agent = tmp_dir("confk-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(canonical.join("shared.txt"), "canonical ver").unwrap();
        fs::write(agent.join("shared.txt"), "agent ver").unwrap();

        let changes = vec![
            SiblingChange { path: "shared.txt".into(), status: SiblingStatus::Conflict },
        ];
        apply_sibling_changes(&changes, &[SiblingResolution::UseCanonical], &canonical, &agent).unwrap();
        assert_eq!(fs::read_to_string(canonical.join("shared.txt")).unwrap(), "canonical ver");
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn apply_sibling_conflict_skip_keeps_original() {
        let canonical = tmp_dir("confs-can");
        let agent = tmp_dir("confs-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        fs::write(canonical.join("shared.txt"), "canonical ver").unwrap();
        fs::write(agent.join("shared.txt"), "agent ver").unwrap();

        let changes = vec![
            SiblingChange { path: "shared.txt".into(), status: SiblingStatus::Conflict },
        ];
        apply_sibling_changes(&changes, &[SiblingResolution::Skip], &canonical, &agent).unwrap();
        assert_eq!(fs::read_to_string(canonical.join("shared.txt")).unwrap(), "canonical ver");
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn sibling_changes_agent_unchanged_skipped() {
        let canonical = tmp_dir("unch-can");
        let agent = tmp_dir("unch-agt");
        fs::create_dir_all(&canonical).unwrap();
        fs::create_dir_all(&agent).unwrap();
        let content = "unchanged";
        fs::write(canonical.join("same.txt"), content).unwrap();
        fs::write(agent.join("same.txt"), content).unwrap();
        let mut pushed = std::collections::BTreeMap::new();
        let hash = format!("{:x}", Sha256::digest(content.as_bytes()));
        pushed.insert("same.txt".into(), hash);
        let result = compute_sibling_changes(Some(&pushed), &canonical, &agent);
        assert!(result.is_empty());
        let _ = fs::remove_dir_all(&canonical);
        let _ = fs::remove_dir_all(&agent);
    }

    #[test]
    fn noop_fast_path_preserves_snapshot_and_siblings_when_hash_matches() {
        let tmp = smoke_tempdir("noop-fastpath");
        let _g = override_felina_home(&tmp);
        make_canonical("noop-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("noop-skill");
        let project = tmp.to_string_lossy().to_string();
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        let key = target_key(&target);

        let agent_dir = tmp.join(".claude").join("skills").join("noop-skill");
        fs::create_dir_all(&agent_dir).unwrap();

        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target.clone()],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let results1 = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "noop-skill".into(),
            resolutions: vec![],
        })
        .expect("first commit");
        assert!(results1.iter().all(|r| r.success), "{results1:#?}");

        let meta1: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let entry1 = meta1.last_sync.get(&key).expect("entry after first commit");
        let snap1 = entry1.base_snapshot.clone();
        let sibs1 = entry1.sibling_hashes.clone();

        fs::write(agent_dir.join("extra.txt"), "extra").unwrap();

        let results2 = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "noop-skill".into(),
            resolutions: vec![],
        })
        .expect("second commit (noop)");
        assert!(results2.iter().all(|r| r.success), "{results2:#?}");

        let meta2: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let entry2 = meta2.last_sync.get(&key).expect("entry after second commit");

        assert_eq!(
            entry2.base_snapshot, snap1,
            "fast-path: base_snapshot must not be recomputed"
        );
        assert_eq!(
            entry2.sibling_hashes, sibs1,
            "fast-path: sibling_hashes must not be recomputed"
        );
        assert_ne!(
            entry2.at, "2020-01-01T00:00:00Z",
            "at must be a real timestamp, not stale"
        );
    }

    #[test]
    fn noop_full_path_recomputes_when_hash_differs() {
        let tmp = smoke_tempdir("noop-fullpath");
        let _g = override_felina_home(&tmp);
        make_canonical("noop-diff-skill", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("noop-diff-skill");
        let project = tmp.to_string_lossy().to_string();
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Manual,
        };
        let key = target_key(&target);

        let agent_dir = tmp.join(".claude").join("skills").join("noop-diff-skill");
        fs::create_dir_all(&agent_dir).unwrap();

        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target.clone()],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let results1 = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "noop-diff-skill".into(),
            resolutions: vec![],
        })
        .expect("first commit");
        assert!(results1.iter().all(|r| r.success), "{results1:#?}");

        let meta1: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let actual_hash = meta1.last_sync.get(&key).expect("entry after first commit").pushed_hash.clone();
        let snap1 = meta1.last_sync.get(&key).unwrap().base_snapshot.clone();

        let mut meta_patched = meta1.clone();
        meta_patched.last_sync.get_mut(&key).unwrap().pushed_hash = "stale-hash".into();
        meta_patched.last_sync.get_mut(&key).unwrap().base_snapshot = Some("old-snap".into());
        write_sync_meta_v2(&canonical_skill_dir, &meta_patched).unwrap();

        let results2 = skill_sync_commit(SkillSyncCommitRequest {
            skill_name: "noop-diff-skill".into(),
            resolutions: vec![],
        })
        .expect("second commit");
        assert!(results2.iter().all(|r| r.success), "{results2:#?}");

        let meta2: SyncMetaV2 = serde_json::from_str(
            &fs::read_to_string(canonical_skill_dir.join(".felina-sync-meta.json")).unwrap(),
        )
        .unwrap();
        let entry2 = meta2.last_sync.get(&key).expect("entry after second commit");

        assert_eq!(
            entry2.pushed_hash, actual_hash,
            "full-path: pushed_hash must be updated to actual hash"
        );
        assert_ne!(
            entry2.base_snapshot,
            Some("old-snap".into()),
            "full-path: base_snapshot must be recomputed when hash differs"
        );
        let _ = snap1;
    }

    #[test]
    fn sync_all_commit_processes_multiple_skills() {
        let tmp = smoke_tempdir("allcommit-multi");
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        for name in &["alpha", "beta", "gamma"] {
            make_canonical(name, &["anthropic"]);
            let canonical_skill_dir = tmp.join(".felina").join("skills").join(name);
            let target = SkillTarget {
                agent: "anthropic".to_string(),
                scope: SkillScope::Project,
                project: Some(project.clone()),
                enabled: true,
                mode: TargetMode::Manual,
            };
            write_sync_meta_v2(
                &canonical_skill_dir,
                &SyncMetaV2 {
                    version: 2,
                    targets: vec![target],
                    last_sync: std::collections::BTreeMap::new(),
                    dirty: true,
                    directory_hash: None,
                },
            )
            .unwrap();

            let agent_dir = tmp.join(".claude").join("skills").join(name);
            fs::create_dir_all(&agent_dir).unwrap();
            fs::write(agent_dir.join("SKILL.md"), format!("# {name}\n\nOld body.\n")).unwrap();
        }

        let request = SkillSyncAllCommitRequest {
            resolutions_by_skill: std::collections::BTreeMap::new(),
        };
        let results = skill_sync_all_commit(request).expect("all commit");

        assert_eq!(results.len(), 3, "expected one SyncResult per skill: {results:#?}");
        assert!(results.iter().all(|r| r.success), "all results must succeed: {results:#?}");
    }

    #[test]
    fn directory_hash_stable_and_changes_with_sibling() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-dirhash-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();
        fs::write(
            tmp.join("SKILL.md"),
            "---\nname: test\ndescription: d\n---\nbody\n",
        )
        .unwrap();
        fs::write(tmp.join("helper.py"), "print('hi')").unwrap();

        let h1 = directory_hash(&tmp).expect("hash should succeed");
        assert!(!h1.is_empty());
        let h2 = directory_hash(&tmp).expect("hash should be stable");
        assert_eq!(h1, h2);

        fs::write(tmp.join("helper.py"), "print('changed')").unwrap();
        let h3 = directory_hash(&tmp).expect("hash after modification");
        assert_ne!(h1, h3);

        let _ = fs::remove_dir_all(&tmp);
    }

    fn setup_forked_skill(tag: &str) -> (std::path::PathBuf, String, String) {
        let tmp = smoke_tempdir(tag);
        let _g = override_felina_home(&tmp);
        make_canonical("fork-test", &["anthropic"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("fork-test");
        let canonical_raw = fs::read_to_string(canonical_skill_dir.join("SKILL.md")).unwrap();
        let canonical_hash = semantic_hash(&canonical_raw);

        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Forked,
        };
        let key = target_key(&target);

        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert(key.clone(), LastSyncEntry {
                        pushed_hash: canonical_hash.clone(),
                        base_snapshot: Some(canonical_hash),
                        at: "2026-01-01T00:00:00Z".into(),
                        sibling_hashes: None,
                    });
                    m
                },
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        // Copy canonical to agent-side so hashes match for clean state.
        let agent_dir = tmp.join(".claude").join("skills").join("fork-test");
        fs::create_dir_all(&agent_dir).unwrap();
        fs::copy(
            canonical_skill_dir.join("SKILL.md"),
            agent_dir.join("SKILL.md"),
        )
        .unwrap();

        (tmp, key, project)
    }

    #[test]
    fn fork_read_agent_content_success() {
        let (tmp, key, _project) = setup_forked_skill("fork-read-ok");
        let _g = override_felina_home(&tmp);
        let result = skill_fork_read_agent_content("fork-test".into(), key).unwrap();
        assert!(result.body.contains("Body for fork-test"));
        assert!(result.raw.contains("name: fork-test"));
    }

    #[test]
    fn fork_read_rejects_non_forked() {
        let tmp = smoke_tempdir("fork-read-reject");
        let _g = override_felina_home(&tmp);
        make_canonical("fork-reject", &["anthropic"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("fork-reject");
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project),
            enabled: true,
            mode: TargetMode::Auto,
        };
        let key = target_key(&target);
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: Default::default(),
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        let err = skill_fork_read_agent_content("fork-reject".into(), key).unwrap_err();
        assert!(err.contains("not in forked mode"), "got: {err}");
    }

    #[test]
    fn fork_read_missing_file() {
        let tmp = smoke_tempdir("fork-read-missing");
        let _g = override_felina_home(&tmp);
        make_canonical("fork-missing", &["anthropic"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("fork-missing");
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project),
            enabled: true,
            mode: TargetMode::Forked,
        };
        let key = target_key(&target);
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: Default::default(),
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        let err = skill_fork_read_agent_content("fork-missing".into(), key).unwrap_err();
        assert!(err.contains("agent-side file not found"), "got: {err}");
    }

    #[test]
    fn fork_diff_preview_clean_status() {
        let (tmp, key, _project) = setup_forked_skill("fork-diff-clean");
        let _g = override_felina_home(&tmp);
        let result = skill_fork_diff_preview("fork-test".into(), key).unwrap();
        assert!(result.has_base);
        assert!(matches!(result.fork_status, ForkStatus::Clean));
    }

    #[test]
    fn fork_diff_preview_edited_status() {
        let (tmp, key, _project) = setup_forked_skill("fork-diff-edited");
        let _g = override_felina_home(&tmp);

        // Modify agent-side to make forked hash differ from pushed_hash.
        let agent_file = tmp.join(".claude").join("skills").join("fork-test").join("SKILL.md");
        fs::write(
            &agent_file,
            "---\nname: fork-test\ndescription: fork-test description\n---\n# fork-test\n\nEdited body.\n",
        )
        .unwrap();

        let result = skill_fork_diff_preview("fork-test".into(), key).unwrap();
        assert!(result.has_base);
        assert!(matches!(result.fork_status, ForkStatus::Edited));
        assert!(!result.hunks.is_empty());
    }

    #[test]
    fn fork_diff_preview_canonical_ahead_status() {
        let (tmp, key, _project) = setup_forked_skill("fork-diff-ahead");
        let _g = override_felina_home(&tmp);

        // Modify canonical to make canonical hash differ from base_snapshot.
        let canonical_file = tmp.join(".felina").join("skills").join("fork-test").join("SKILL.md");
        fs::write(
            &canonical_file,
            "---\nname: fork-test\ndescription: fork-test description\n---\n# fork-test\n\nUpdated canonical.\n",
        )
        .unwrap();

        let result = skill_fork_diff_preview("fork-test".into(), key).unwrap();
        assert!(result.has_base);
        assert!(matches!(result.fork_status, ForkStatus::CanonicalAhead));
    }

    #[test]
    fn fork_diff_preview_diverged_status() {
        let (tmp, key, _project) = setup_forked_skill("fork-diff-diverged");
        let _g = override_felina_home(&tmp);

        // Modify both canonical and agent-side.
        let canonical_file = tmp.join(".felina").join("skills").join("fork-test").join("SKILL.md");
        fs::write(
            &canonical_file,
            "---\nname: fork-test\ndescription: fork-test description\n---\n# fork-test\n\nUpdated canonical.\n",
        )
        .unwrap();
        let agent_file = tmp.join(".claude").join("skills").join("fork-test").join("SKILL.md");
        fs::write(
            &agent_file,
            "---\nname: fork-test\ndescription: fork-test description\n---\n# fork-test\n\nEdited agent.\n",
        )
        .unwrap();

        let result = skill_fork_diff_preview("fork-test".into(), key).unwrap();
        assert!(result.has_base);
        assert!(matches!(result.fork_status, ForkStatus::Diverged));
    }

    #[test]
    fn fork_diff_preview_missing_base_snapshot_fallback() {
        let tmp = smoke_tempdir("fork-diff-nobase");
        let _g = override_felina_home(&tmp);
        make_canonical("fork-nobase", &["anthropic"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("fork-nobase");
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project),
            enabled: true,
            mode: TargetMode::Forked,
        };
        let key = target_key(&target);
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert(key.clone(), LastSyncEntry {
                        pushed_hash: "some-old-hash".into(),
                        base_snapshot: None,
                        at: "2026-01-01T00:00:00Z".into(),
                        sibling_hashes: None,
                    });
                    m
                },
                dirty: false,
                directory_hash: None,
            },
        )
        .unwrap();

        let agent_dir = tmp.join(".claude").join("skills").join("fork-nobase");
        fs::create_dir_all(&agent_dir).unwrap();
        fs::write(
            agent_dir.join("SKILL.md"),
            "---\nname: fork-nobase\ndescription: fork-nobase description\n---\n# fork-nobase\n\nBody.\n",
        )
        .unwrap();

        let result = skill_fork_diff_preview("fork-nobase".into(), key).unwrap();
        assert!(!result.has_base);
        assert!(matches!(result.fork_status, ForkStatus::Edited));
    }

    #[test]
    fn push_skips_forked_target() {
        let tmp = smoke_tempdir("push-skip-forked");
        let _g = override_felina_home(&tmp);
        make_canonical("skip-forked", &["anthropic"]);

        let project = tmp.to_string_lossy().to_string();
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("skip-forked");
        let target = SkillTarget {
            agent: "anthropic".to_string(),
            scope: SkillScope::Project,
            project: Some(project),
            enabled: true,
            mode: TargetMode::Forked,
        };
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target],
                last_sync: Default::default(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        let results = skill_sync_one("skip-forked".into()).unwrap();
        assert!(results.is_empty(), "forked target should be skipped by push");
    }

    #[test]
    fn drift_scan_classifies_forked_target() {
        let (tmp, key, _project) = setup_forked_skill("drift-fork-classify");
        let _g = override_felina_home(&tmp);

        // Modify agent-side to produce "edited" status.
        let agent_file = tmp.join(".claude").join("skills").join("fork-test").join("SKILL.md");
        fs::write(
            &agent_file,
            "---\nname: fork-test\ndescription: fork-test description\n---\n# fork-test\n\nEdited body.\n",
        )
        .unwrap();

        let canonical_path = tmp.join(".felina").join("skills").join("fork-test").join("SKILL.md");
        let canonical_skill_dir = tmp.join(".felina").join("skills").join("fork-test");
        let meta = read_sync_meta_v2_no_backfill(&canonical_skill_dir);
        let entry = meta.last_sync.get(&key);

        let status = classify_fork_status(&canonical_path, &agent_file, entry);
        assert!(
            matches!(status, DriftStatus::ForkedEdited),
            "forked target with agent-side edits should be ForkedEdited, got: {status:?}"
        );
    }

    #[test]
    fn test_semantic_hash_crlf_vs_lf() {
        let lf = "---\nname: test\n---\n# Hello\n\nWorld\n";
        let crlf = "---\r\nname: test\r\n---\r\n# Hello\r\n\r\nWorld\r\n";
        let mixed = "---\nname: test\r\n---\n# Hello\r\n\nWorld\n";
        let bare_cr = "---\rname: test\r---\r# Hello\r\rWorld\r";

        let hash_lf = semantic_hash(lf);
        let hash_crlf = semantic_hash(crlf);
        let hash_mixed = semantic_hash(mixed);
        let hash_bare_cr = semantic_hash(bare_cr);

        assert_eq!(hash_lf, hash_crlf, "CRLF and LF should produce identical hash");
        assert_eq!(hash_lf, hash_mixed, "mixed line endings should produce identical hash");
        assert_eq!(hash_lf, hash_bare_cr, "bare CR should produce identical hash");
    }

    #[test]
    fn test_sibling_hash_crlf_normalization() {
        let tmp = std::env::temp_dir().join(format!(
            "felina-sibling-crlf-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&tmp).unwrap();

        // SKILL.md required but excluded from sibling hashes
        fs::write(tmp.join("SKILL.md"), "---\nname: test\n---\n# Body\n").unwrap();

        // LF version dir
        let lf_dir = tmp.join("lf");
        fs::create_dir_all(&lf_dir).unwrap();
        fs::write(lf_dir.join("SKILL.md"), "stub").unwrap();
        fs::write(lf_dir.join("helper.sh"), "#!/bin/sh\necho hi\n").unwrap();

        // CRLF version dir
        let crlf_dir = tmp.join("crlf");
        fs::create_dir_all(&crlf_dir).unwrap();
        fs::write(crlf_dir.join("SKILL.md"), "stub").unwrap();
        fs::write(crlf_dir.join("helper.sh"), "#!/bin/sh\r\necho hi\r\n").unwrap();

        let lf_hashes = compute_sibling_hashes(&lf_dir);
        let crlf_hashes = compute_sibling_hashes(&crlf_dir);

        assert_eq!(
            lf_hashes.get("helper.sh"),
            crlf_hashes.get("helper.sh"),
            "text sibling CRLF/LF should produce identical hash"
        );

        // Binary content: raw bytes with 0x0D 0x0A should NOT be normalized
        let bin_dir_a = tmp.join("bin_a");
        fs::create_dir_all(&bin_dir_a).unwrap();
        fs::write(bin_dir_a.join("SKILL.md"), "stub").unwrap();
        fs::write(bin_dir_a.join("icon.bin"), &[0x89, 0x50, 0x0D, 0x0A, 0x1A, 0x0A]).unwrap();

        let bin_dir_b = tmp.join("bin_b");
        fs::create_dir_all(&bin_dir_b).unwrap();
        fs::write(bin_dir_b.join("SKILL.md"), "stub").unwrap();
        fs::write(bin_dir_b.join("icon.bin"), &[0x89, 0x50, 0x0D, 0x0A, 0x1A, 0x0A]).unwrap();

        let hash_a = compute_sibling_hashes(&bin_dir_a);
        let hash_b = compute_sibling_hashes(&bin_dir_b);
        assert_eq!(
            hash_a.get("icon.bin"),
            hash_b.get("icon.bin"),
            "binary sibling should produce identical hash from identical bytes"
        );

        // Binary with different bytes should differ
        let bin_dir_c = tmp.join("bin_c");
        fs::create_dir_all(&bin_dir_c).unwrap();
        fs::write(bin_dir_c.join("SKILL.md"), "stub").unwrap();
        fs::write(bin_dir_c.join("icon.bin"), &[0x89, 0x50, 0x0A, 0x0A, 0x1A, 0x0A]).unwrap();
        let hash_c = compute_sibling_hashes(&bin_dir_c);
        assert_ne!(
            hash_a.get("icon.bin"),
            hash_c.get("icon.bin"),
            "binary with different bytes should produce different hash"
        );

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn stale_baseline_no_drift_when_canonical_matches_agent() {
        let tmp = tempfile::TempDir::new().unwrap();
        let canonical_dir = tmp.path().join("canonical");
        let agent_dir = tmp.path().join("agent");
        fs::create_dir_all(&canonical_dir).unwrap();
        fs::create_dir_all(&agent_dir).unwrap();

        let body = "---\nname: my-skill\n---\n# Body\n";
        fs::write(canonical_dir.join("SKILL.md"), body).unwrap();
        fs::write(agent_dir.join("SKILL.md"), body).unwrap();

        // Both canonical and agent have same sibling content (H2)
        fs::write(canonical_dir.join("scripts/tool.py"), "v2 content").unwrap_or_else(|_| {});
        fs::create_dir_all(canonical_dir.join("scripts")).unwrap();
        fs::write(canonical_dir.join("scripts/tool.py"), "v2 content").unwrap();
        fs::create_dir_all(agent_dir.join("scripts")).unwrap();
        fs::write(agent_dir.join("scripts/tool.py"), "v2 content").unwrap();

        let canonical_sibs = compute_sibling_hashes(&canonical_dir);
        let agent_sibs = compute_sibling_hashes(&agent_dir);
        assert_eq!(canonical_sibs, agent_sibs, "canonical and agent siblings should match");

        // Recorded baseline has old hash (H1) — stale
        let mut stale_baseline = std::collections::BTreeMap::new();
        stale_baseline.insert("scripts/tool.py".to_string(), "old_hash_H1".to_string());

        let pushed_hash = semantic_hash(body);
        // With three-way comparison, this should NOT be Drifted
        assert_eq!(
            check_drift(
                &agent_dir.join("SKILL.md"),
                Some(&pushed_hash),
                None,
                &Some(stale_baseline),
                Some(&canonical_sibs),
            ),
            DriftStatus::Synced,
            "stale baseline should not cause drift when canonical == agent siblings"
        );
    }

    #[test]
    fn real_agent_drift_still_detected_with_canonical() {
        let tmp = tempfile::TempDir::new().unwrap();
        let canonical_dir = tmp.path().join("canonical");
        let agent_dir = tmp.path().join("agent");
        fs::create_dir_all(&canonical_dir).unwrap();
        fs::create_dir_all(&agent_dir).unwrap();

        let body = "---\nname: my-skill\n---\n# Body\n";
        fs::write(canonical_dir.join("SKILL.md"), body).unwrap();
        fs::write(agent_dir.join("SKILL.md"), body).unwrap();

        // Canonical has H1, agent has H2 — real drift
        fs::create_dir_all(canonical_dir.join("references")).unwrap();
        fs::write(canonical_dir.join("references/guide.md"), "canonical content").unwrap();
        fs::create_dir_all(agent_dir.join("references")).unwrap();
        fs::write(agent_dir.join("references/guide.md"), "modified by agent").unwrap();

        let canonical_sibs = compute_sibling_hashes(&canonical_dir);
        let recorded_baseline = canonical_sibs.clone();

        let pushed_hash = semantic_hash(body);
        assert_eq!(
            check_drift(
                &agent_dir.join("SKILL.md"),
                Some(&pushed_hash),
                None,
                &Some(recorded_baseline),
                Some(&canonical_sibs),
            ),
            DriftStatus::Drifted,
            "real agent-side modification should still be detected as drift"
        );
    }

    #[test]
    fn agent_added_sibling_not_in_canonical_still_drifts() {
        let tmp = tempfile::TempDir::new().unwrap();
        let canonical_dir = tmp.path().join("canonical");
        let agent_dir = tmp.path().join("agent");
        fs::create_dir_all(&canonical_dir).unwrap();
        fs::create_dir_all(&agent_dir).unwrap();

        let body = "---\nname: my-skill\n---\n# Body\n";
        fs::write(canonical_dir.join("SKILL.md"), body).unwrap();
        fs::write(agent_dir.join("SKILL.md"), body).unwrap();

        // Agent has a file canonical doesn't
        fs::create_dir_all(agent_dir.join("notes")).unwrap();
        fs::write(agent_dir.join("notes/local.md"), "local notes").unwrap();

        let canonical_sibs = compute_sibling_hashes(&canonical_dir);
        let recorded_baseline = canonical_sibs.clone();

        let pushed_hash = semantic_hash(body);
        assert_eq!(
            check_drift(
                &agent_dir.join("SKILL.md"),
                Some(&pushed_hash),
                None,
                &Some(recorded_baseline),
                Some(&canonical_sibs),
            ),
            DriftStatus::Drifted,
            "agent-added sibling not in canonical should be detected as drift"
        );
    }

    // Problem B: a skill stuck dirty=true whose preview resolves to only
    // NoOp/Skipped items is effectively in sync — preview must self-heal the
    // stale flag so the user can clear it without a commit path that the
    // frontend never invokes when there is nothing to write.
    #[test]
    fn preview_clears_stuck_dirty_when_all_noop_or_skipped() {
        let tmp = smoke_tempdir("preview-heal-noop");
        let _g = override_felina_home(&tmp);
        make_canonical("heal-noop", &["anthropic", "codex"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("heal-noop");
        let project = tmp.to_string_lossy().to_string();
        // anthropic Manual (pushable → NoOp after push), codex Forked (Skipped).
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![
                    SkillTarget {
                        agent: "anthropic".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Manual,
                    },
                    SkillTarget {
                        agent: "codex".to_string(),
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Forked,
                    },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        // Push: writes the Manual target + records last_sync; the Forked target
        // is skipped. The next preview therefore yields NoOp + Skipped only.
        let results = skill_sync_one("heal-noop".into()).expect("sync");
        assert!(results.iter().all(|r| r.success), "{results:#?}");

        // Re-flag dirty to simulate a skill stuck dirty despite being in sync.
        let mut meta =
            crate::commands::canonical_skills::read_sync_meta_v2_no_backfill(&canonical_skill_dir);
        meta.dirty = true;
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();

        let preview = skill_sync_preview("heal-noop".into()).expect("preview");
        assert!(
            preview.items.iter().all(|i| matches!(
                i.operation,
                SkillSyncPreviewOperation::NoOp | SkillSyncPreviewOperation::Skipped
            )),
            "expected all NoOp/Skipped, got {:#?}",
            preview.items
        );

        let after =
            crate::commands::canonical_skills::read_sync_meta_v2_no_backfill(&canonical_skill_dir);
        assert!(
            !after.dirty,
            "preview should self-heal stuck dirty to false when nothing to sync"
        );
    }

    // Problem B regression guard: when the preview contains a pending write
    // (here, an Overwrite because the canonical was edited after the last push),
    // preview must NOT clear dirty — the skill genuinely has unsynced content.
    #[test]
    fn preview_keeps_dirty_when_pending_write_exists() {
        let tmp = smoke_tempdir("preview-heal-pending");
        let _g = override_felina_home(&tmp);
        make_canonical("heal-pending", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("heal-pending");
        let project = tmp.to_string_lossy().to_string();
        write_sync_meta_v2(
            &canonical_skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: "anthropic".to_string(),
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Manual,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
                directory_hash: None,
            },
        )
        .unwrap();

        // Push to establish last_sync + the on-disk target copy.
        let results = skill_sync_one("heal-pending".into()).expect("sync");
        assert!(results.iter().all(|r| r.success), "{results:#?}");

        // Edit the canonical so rendered output now differs from the pushed
        // copy → preview yields Overwrite (a pending write).
        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String("heal-pending".into()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String("heal-pending description".into()),
        );
        fm.insert(
            serde_yaml::Value::String("agents".into()),
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String("anthropic".into())]),
        );
        canonical_skills_write(
            "heal-pending".into(),
            serde_yaml::Value::Mapping(fm),
            "# heal-pending\n\nEDITED body — now differs from the pushed copy.\n".into(),
            None,
        )
        .expect("edit canonical");

        // Simulate stuck dirty (canonical_skills_write already flips it, but be
        // explicit so the test does not depend on that side effect).
        let mut meta =
            crate::commands::canonical_skills::read_sync_meta_v2_no_backfill(&canonical_skill_dir);
        meta.dirty = true;
        write_sync_meta_v2(&canonical_skill_dir, &meta).unwrap();

        let preview = skill_sync_preview("heal-pending".into()).expect("preview");
        assert!(
            preview
                .items
                .iter()
                .any(|i| matches!(i.operation, SkillSyncPreviewOperation::Overwrite)),
            "expected an Overwrite item, got {:#?}",
            preview.items
        );

        let after =
            crate::commands::canonical_skills::read_sync_meta_v2_no_backfill(&canonical_skill_dir);
        assert!(
            after.dirty,
            "preview must NOT clear dirty when a pending write exists"
        );
    }
}
