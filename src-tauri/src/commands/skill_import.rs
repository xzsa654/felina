//! Initial skill import: detect existing agent-native skills and pull
//! them into canonical. Detection is intentionally cheap (count
//! subdirs, no content reads); the wizard step (`skill_import_scan`)
//! does the deeper read with conflict diff.

use crate::commands::agent_paths::{agent_paths_get, AgentPathPair};
use crate::commands::canonical_skills::{
    canonical_skills_dir, parse_skill_md, read_sync_meta_v2_no_backfill, split_frontmatter,
    write_sync_meta_v2, AgentId, SkillScope, SkillTarget, TargetMode,
};
use crate::commands::fan_out::{expand_user_path, resolve_pair};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Tally produced by `skill_import_scan_quick` — just counts per agent so
/// the import banner can show "Detected N skills" without paying for
/// content reads.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportScanQuick {
    pub anthropic: u32,
    pub codex: u32,
    pub gemini: u32,
    /// Sum across all agents. Banner threshold check.
    pub total: u32,
}

/// One importable candidate. Mirrors `ImportCandidate` in `types/skills.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportCandidate {
    pub source_path: String,
    pub source_agent: AgentId,
    pub skill_name: String,
    pub body_preview: String,
    pub conflict: Option<ConflictInfo>,
    /// Set when the same skill name was found in more than one agent location.
    /// Such skills are NOT importable in this version — choosing which source
    /// wins / unioning agents / per-agent customization is handled by the
    /// upcoming target-control change. The wizard greys these out. `None`
    /// means a clean single-source skill that imports normally.
    pub deferred: Option<DeferredMultiSource>,
    /// Set when the source file has malformed frontmatter (bad YAML, non-mapping
    /// root, nested frontmatter). Blocked candidates cannot be imported.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_error: Option<String>,
}

/// Why a candidate is deferred: it appears in multiple agent source folders.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeferredMultiSource {
    /// Distinct agents whose folders contained this skill name.
    pub agents: Vec<AgentId>,
    /// Human-readable note for the wizard row.
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub canonical_path: String,
    pub canonical_body_preview: String,
    pub diff_summary: String,
}

/// One user choice for the apply step.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSelection {
    pub candidate: ImportCandidate,
    pub resolution: ImportResolution,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ImportResolution {
    KeepCanonical,
    OverwriteCanonical,
    Skip,
    Rename { new_name: String },
}

const BODY_PREVIEW_BYTES: usize = 240;

// ---------------------------------------------------------------------------
// Quick scan — count only, never read SKILL.md contents.
// ---------------------------------------------------------------------------

/// Count agent-native skill subdirectories for each known location.
///
/// For Gemini, we probe BOTH the spec-default path and the Antigravity CLI
/// path (`~/.gemini/antigravity/skills/`) and sum them — gemini-cli's
/// June 18 2026 consumer sunset means users may have skills in either tree.
/// Derive the scan scope from an optional project path: `None` means scan
/// global agent dirs; `Some(path)` means scan that project's agent dirs.
/// Canonical destination is always global; scope-of-write is determined
/// later from the same `project_path` when adding the `SkillTarget`.
fn scan_scope(project_path: Option<&str>) -> SkillScope {
    if project_path.is_some() {
        SkillScope::Project
    } else {
        SkillScope::Global
    }
}

#[tauri::command]
pub fn skill_import_scan_quick(project_path: Option<String>) -> Result<ImportScanQuick, String> {
    let cfg = agent_paths_get()?;
    let mut out = ImportScanQuick::default();
    let scope = scan_scope(project_path.as_deref());

    let anthropic = skill_names_at_pair(scope, project_path.as_deref(), &cfg.anthropic)?;
    let codex = skill_names_at_pair(scope, project_path.as_deref(), &cfg.codex)?;
    // Gemini: spec-default + Antigravity fallback (distinct names across both).
    let mut gemini = skill_names_at_pair(scope, project_path.as_deref(), &cfg.gemini)?;
    if scope == SkillScope::Global {
        let antigravity = expand_user_path("~/.gemini/antigravity/skills");
        gemini.extend(skill_names_at(&antigravity));
    }

    // Per-agent counts are distinct names within that agent's location(s).
    out.anthropic = distinct_count(&anthropic);
    out.codex = distinct_count(&codex);
    out.gemini = distinct_count(&gemini);

    // Total is the count of UNIQUE skill names across all agents — a skill
    // present in both .claude and .agents is one importable skill, not two.
    // (Was a naive per-folder sum, which double-counted shared skills.)
    let mut union: std::collections::HashSet<&String> = std::collections::HashSet::new();
    union.extend(anthropic.iter());
    union.extend(codex.iter());
    union.extend(gemini.iter());
    out.total = union.len() as u32;
    Ok(out)
}

fn distinct_count(names: &[String]) -> u32 {
    names.iter().collect::<std::collections::HashSet<_>>().len() as u32
}

fn skill_names_at_pair(
    scope: SkillScope,
    project_path: Option<&str>,
    pair: &AgentPathPair,
) -> Result<Vec<String>, String> {
    let dir = resolve_pair(scope, project_path, pair)?;
    Ok(skill_names_at(&dir))
}

/// Directory names under `dir` that contain a `SKILL.md`.
fn skill_names_at(dir: &Path) -> Vec<String> {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return Vec::new(), // missing dir is fine — empty
    };
    let mut names = Vec::new();
    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        if entry.path().join("SKILL.md").is_file() {
            names.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    names
}

#[cfg(test)]
fn count_skill_subdirs_at(dir: &Path) -> u32 {
    skill_names_at(dir).len() as u32
}

// ---------------------------------------------------------------------------
// Detailed scan — reads body previews and detects conflicts.
// ---------------------------------------------------------------------------

/// Walk every known agent-native skills directory and return one
/// `ImportCandidate` per skill found. Body previews are clipped to keep
/// the wizard payload small.
#[tauri::command]
pub fn skill_import_scan(project_path: Option<String>) -> Result<Vec<ImportCandidate>, String> {
    let cfg = agent_paths_get()?;
    let canonical_dir = canonical_skills_dir();
    let scope = scan_scope(project_path.as_deref());

    let mut out = Vec::new();
    for (agent, pair) in [
        (AgentId::Anthropic, &cfg.anthropic),
        (AgentId::Codex, &cfg.codex),
        (AgentId::Gemini, &cfg.gemini),
    ] {
        let dir = resolve_pair(scope, project_path.as_deref(), pair)?;
        collect_candidates_in(&dir, agent, &canonical_dir, &mut out);
    }
    // Antigravity Gemini extra path (global only).
    if scope == SkillScope::Global {
        let antigravity = expand_user_path("~/.gemini/antigravity/skills");
        collect_candidates_in(&antigravity, AgentId::Gemini, &canonical_dir, &mut out);
    }

    // Collapse to one row per skill name; mark multi-source names deferred.
    // group_by_name returns names in sorted (BTreeMap) order already.
    Ok(group_by_name(out))
}

/// Check whether the body immediately begins with another `---` frontmatter
/// block — the signature of a corrupted double-frontmatter file.
fn body_has_nested_frontmatter(body: &str) -> bool {
    let trimmed = body.trim_start_matches(['\n', '\r']);
    let Some(rest) = trimmed.strip_prefix("---") else {
        return false;
    };
    // The `---` must be followed by a line ending (not just trailing content).
    let rest = match rest
        .strip_prefix("\r\n")
        .or_else(|| rest.strip_prefix('\n'))
    {
        Some(r) => r,
        None => return false,
    };
    rest.contains("\n---")
}

/// Validate a source `SKILL.md` without writing anything. Returns `Ok(())`
/// when the file is importable (possibly after field repair), `Err(reason)`
/// when it must be blocked.
fn validate_source_frontmatter(raw: &str) -> Result<(), String> {
    let (fm_text, body) = split_frontmatter(raw);
    if fm_text.is_empty() {
        return Err("missing or unterminated YAML frontmatter".into());
    }
    let value: serde_yaml::Value =
        serde_yaml::from_str(&fm_text).map_err(|e| format!("malformed YAML: {e}"))?;
    if !value.is_mapping() {
        return Err("frontmatter root must be a YAML mapping".into());
    }
    if body_has_nested_frontmatter(&body) {
        return Err("nested or repeated frontmatter detected".into());
    }
    Ok(())
}

fn collect_candidates_in(
    dir: &Path,
    agent: AgentId,
    canonical_dir: &Path,
    out: &mut Vec<ImportCandidate>,
) {
    // Defence: refuse to read from a path that contains `..` segments — even
    // though `agent_paths_set` rejects these, a stale-on-disk settings file
    // or future bug shouldn't let a renderer wander up the tree.
    if dir
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        let skill_md = entry.path().join("SKILL.md");
        if !skill_md.is_file() {
            continue;
        }
        let raw = match fs::read_to_string(&skill_md) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let body_preview = body_preview_from(&raw);

        // Conflict detection: same-named canonical SKILL.md already exists?
        let canonical_path = canonical_dir.join(&dir_name).join("SKILL.md");
        let conflict = if canonical_path.is_file() {
            let canonical_body = fs::read_to_string(&canonical_path)
                .ok()
                .map(|s| body_preview_from(&s))
                .unwrap_or_default();
            Some(ConflictInfo {
                canonical_path: canonical_path.to_string_lossy().to_string(),
                canonical_body_preview: canonical_body,
                diff_summary: summarise_diff(&raw, &canonical_path),
            })
        } else {
            None
        };

        let validation_error = validate_source_frontmatter(&raw).err();

        out.push(ImportCandidate {
            source_path: skill_md.to_string_lossy().to_string(),
            source_agent: agent,
            skill_name: dir_name,
            body_preview,
            conflict,
            deferred: None,
            validation_error,
        });
    }
}

fn agent_label(a: AgentId) -> &'static str {
    match a {
        AgentId::Anthropic => "anthropic",
        AgentId::Codex => "codex",
        AgentId::Gemini => "gemini",
    }
}

/// Collapse per-source candidates into one row per skill name. A name found
/// in exactly one source stays importable (`deferred = None`). A name found
/// in two or more sources becomes a single deferred row — picking which
/// source wins / unioning agents / per-agent customization is the upcoming
/// target-control change's job, so this version refuses to silently produce
/// a wrong agent tag.
fn group_by_name(raw: Vec<ImportCandidate>) -> Vec<ImportCandidate> {
    use std::collections::BTreeMap;
    let mut groups: BTreeMap<String, Vec<ImportCandidate>> = BTreeMap::new();
    for c in raw {
        groups.entry(c.skill_name.clone()).or_default().push(c);
    }

    let mut out = Vec::new();
    for (_name, group) in groups {
        if group.len() == 1 {
            out.push(group.into_iter().next().expect("len==1"));
            continue;
        }
        // Multi-source → defer. Distinct agents, preserving first-seen order.
        let mut agents: Vec<AgentId> = Vec::new();
        for c in &group {
            if !agents.contains(&c.source_agent) {
                agents.push(c.source_agent);
            }
        }
        let labels: Vec<&str> = agents.iter().map(|a| agent_label(*a)).collect();
        let reason = format!(
            "Found in {} locations ({}). Multi-source import is handled by the upcoming target-control change.",
            group.len(),
            labels.join(", "),
        );
        // Representative row carries the first source's preview/path; it is
        // greyed out and never imported, so which source it shows is cosmetic.
        let mut rep = group.into_iter().next().expect("len>=2");
        rep.deferred = Some(DeferredMultiSource { agents, reason });
        out.push(rep);
    }
    out
}

fn body_preview_from(raw: &str) -> String {
    // Strip frontmatter for preview: just show the body.
    let body = strip_frontmatter_for_preview(raw);
    let trimmed: String = body.chars().take(BODY_PREVIEW_BYTES).collect();
    trimmed
}

fn strip_frontmatter_for_preview(raw: &str) -> &str {
    let trimmed = raw.trim_start_matches('\u{feff}');
    let trimmed = trimmed.trim_start_matches(['\n', '\r']);
    if let Some(rest) = trimmed.strip_prefix("---") {
        if let Some(rest) = rest
            .strip_prefix("\r\n")
            .or_else(|| rest.strip_prefix('\n'))
        {
            if let Some(idx) = rest.find("\n---") {
                let after = &rest[idx + 4..];
                let body_start = if let Some(stripped) = after.strip_prefix("\r\n") {
                    stripped
                } else if let Some(stripped) = after.strip_prefix('\n') {
                    stripped
                } else {
                    after
                };
                return body_start;
            }
        }
    }
    raw
}

fn summarise_diff(source_raw: &str, canonical_path: &Path) -> String {
    let canonical_raw = fs::read_to_string(canonical_path).unwrap_or_default();
    let src_lines = source_raw.lines().count();
    let dst_lines = canonical_raw.lines().count();
    let src_bytes = source_raw.len();
    let dst_bytes = canonical_raw.len();
    format!(
        "source: {src_lines} lines / {src_bytes} bytes; canonical: {dst_lines} lines / {dst_bytes} bytes"
    )
}

// ---------------------------------------------------------------------------
// Apply — execute user-chosen resolutions and write to canonical.
// ---------------------------------------------------------------------------

/// Apply each selection. Original agent-native files are never deleted.
///
/// Canonical destination is always `~/.felina/skills/`. When `project_path`
/// is `Some(path)`, each imported skill's sync-meta records a `SkillTarget`
/// with `scope=Project, project=path` so a subsequent push fans out back to
/// that originating project's agent dir. When `project_path` is `None`,
/// the target defaults to `scope=Global`.
#[tauri::command]
pub fn skill_import_apply(
    project_path: Option<String>,
    selections: Vec<ImportSelection>,
) -> Result<(), String> {
    let canonical_dir = canonical_skills_dir();

    for sel in selections {
        // Defence in depth: multi-source skills are never importable in this
        // version. The wizard already greys them out, but refuse here too in
        // case a client sends one directly.
        if sel.candidate.deferred.is_some() {
            continue;
        }
        // Note: a `validation_error` candidate is NOT skipped — it imports as a
        // verbatim broken canonical file (import-as-broken), surfacing as a
        // Broken list entry the user repairs in the editor's raw mode.
        match &sel.resolution {
            ImportResolution::Skip => continue,
            ImportResolution::KeepCanonical => continue, // canonical untouched
            ImportResolution::OverwriteCanonical => {
                write_canonical_from_source(
                    &sel.candidate,
                    &canonical_dir,
                    None,
                    project_path.as_deref(),
                )?;
            }
            ImportResolution::Rename { new_name } => {
                write_canonical_from_source(
                    &sel.candidate,
                    &canonical_dir,
                    Some(new_name.as_str()),
                    project_path.as_deref(),
                )?;
            }
        }
    }
    Ok(())
}

fn write_canonical_from_source(
    candidate: &ImportCandidate,
    canonical_dir: &Path,
    rename_to: Option<&str>,
    project_path: Option<&str>,
) -> Result<(), String> {
    // Normalise the source path: refuse traversal segments. The path came
    // from `skill_import_scan`, but a malicious client could call apply
    // directly with a crafted ImportCandidate.
    let source = PathBuf::from(&candidate.source_path);
    if source
        .components()
        .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(format!(
            "refusing to import from path containing '..': {}",
            candidate.source_path
        ));
    }
    if !source.is_file() {
        return Err(format!("import source missing: {}", candidate.source_path));
    }
    let raw =
        fs::read_to_string(&source).map_err(|e| format!("failed to read import source: {e}"))?;

    // Normalize the source frontmatter when possible (fill missing
    // name/description/agents). When the source cannot be normalized
    // (malformed YAML, non-mapping root, nested/repeated frontmatter), import
    // it verbatim so it surfaces as a Broken canonical skill (import-as-broken)
    // — preserving the user's content and routing it to the editor's raw
    // repair path — instead of discarding it. Anthropic's `name`-optional
    // schema means many real-world Anthropic skills lack a `name` field; the
    // normalize path fills it from the directory name in that case.
    let name = rename_to.unwrap_or(&candidate.skill_name).to_string();
    let content = match ensure_required_fields(&raw, &name, candidate.source_agent) {
        Ok(normalized) => normalized,
        Err(_) => raw.clone(),
    };
    let target_dir = canonical_dir.join(&name);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("failed to create canonical skill dir: {e}"))?;
    fs::write(target_dir.join("SKILL.md"), &content)
        .map_err(|e| format!("failed to write canonical SKILL.md: {e}"))?;

    // Copy bundled siblings (scripts/, references/, assets/, examples/, agents/, etc.)
    // and any loose files alongside SKILL.md. All three vendors document bundled
    // file support; preserving them is what makes the imported skill *complete*
    // rather than a frontmatter-only stub.
    if let Some(source_skill_dir) = source.parent() {
        copy_bundled_siblings(source_skill_dir, &target_dir)?;
    }

    // Record a SkillTarget for the source location so a subsequent push can
    // fan back out to it. The scope of the target mirrors where the import
    // came from: `Some(project_path)` → scope=Project (`project=path`),
    // `None` → scope=Global. Read the existing sidecar WITHOUT backfill so a
    // fresh import gets EXACTLY the source target (not a synthetic global
    // target per `agents` + the source target); an overwrite preserves the
    // existing target list and just adds/keeps the source target.
    let mut meta = read_sync_meta_v2_no_backfill(&target_dir);
    let new_target = match project_path {
        Some(pp) => SkillTarget {
            agent: candidate.source_agent,
            scope: SkillScope::Project,
            project: Some(pp.to_string()),
            enabled: true,
            mode: TargetMode::Tracked,
        },
        None => SkillTarget {
            agent: candidate.source_agent,
            scope: SkillScope::Global,
            project: None,
            enabled: true,
            mode: TargetMode::Tracked,
        },
    };
    let already = meta.targets.iter().any(|t| {
        t.agent == new_target.agent
            && t.scope == new_target.scope
            && t.project == new_target.project
    });
    if !already {
        meta.targets.push(new_target);
    }
    meta.dirty = meta
        .targets
        .iter()
        .any(|t| t.enabled && !matches!(t.mode, TargetMode::Detached | TargetMode::Forked));
    // Bring forward to v2 explicitly when we touch it.
    meta.version = 2;
    write_sync_meta_v2(&target_dir, &meta)?;
    Ok(())
}

/// Recursively copy everything in `src` into `dst`, excluding the SKILL.md
/// (we wrote a normalised version above) and the local sync-meta sidecar.
/// Symlinks are followed only when they resolve inside `src` to avoid an
/// import escaping the skill directory.
fn copy_bundled_siblings(src: &Path, dst: &Path) -> Result<(), String> {
    let entries = match fs::read_dir(src) {
        Ok(e) => e,
        Err(_) => return Ok(()), // nothing to copy
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        // Skip the main file (we render canonical) and our own sidecar.
        if name_str == "SKILL.md" || name_str == ".felina-sync-meta.json" {
            continue;
        }
        let src_path = entry.path();
        let dst_path = dst.join(&name);
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("failed to create bundled dir {}: {e}", dst_path.display()))?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ft.is_file() {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("failed to copy bundled file {}: {e}", dst_path.display()))?;
        }
        // Symlinks: ignored — safer than blindly following.
    }
    Ok(())
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    let entries = fs::read_dir(src)
        .map_err(|e| format!("failed to read bundled dir {}: {e}", src.display()))?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        let src_path = entry.path();
        let dst_path = dst.join(&name);
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if ft.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("failed to create dir {}: {e}", dst_path.display()))?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if ft.is_file() {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("failed to copy {}: {e}", dst_path.display()))?;
        }
    }
    Ok(())
}

/// Build a canonical-compliant SKILL.md from the raw source by injecting
/// the required `name`/`description`/`agents` fields if they're missing.
/// - `name`: filled from the directory name when absent.
/// - `description`: best effort — left blank if absent (user can edit).
/// - `agents`: defaults to `[source_agent]`.
///
/// Rejects malformed YAML, non-mapping roots, and nested/repeated frontmatter.
/// Extra frontmatter is preserved verbatim.
fn ensure_required_fields(raw: &str, name: &str, source_agent: AgentId) -> Result<String, String> {
    // Try to parse as-is first; if it succeeds, we already have everything
    // we need and just re-serialize.
    if let Ok(mut parsed) = parse_skill_md(raw) {
        parsed.name = name.to_string();
        return Ok(reserialize(parsed));
    }

    // Use the shared BOM/LF/CRLF-aware splitter.
    let (fm_text, body) = split_frontmatter(raw);
    if fm_text.is_empty() {
        return Err("missing or unterminated YAML frontmatter".into());
    }

    let value: serde_yaml::Value =
        serde_yaml::from_str(&fm_text).map_err(|e| format!("malformed YAML: {e}"))?;

    let mut map = match value {
        serde_yaml::Value::Mapping(m) => m,
        _ => return Err("frontmatter root must be a YAML mapping".into()),
    };

    if body_has_nested_frontmatter(&body) {
        return Err("nested or repeated frontmatter detected".into());
    }

    let name_key = serde_yaml::Value::String("name".into());
    map.insert(name_key, serde_yaml::Value::String(name.to_string()));
    map.entry(serde_yaml::Value::String("description".into()))
        .or_insert_with(|| serde_yaml::Value::String(String::new()));
    let agent_str = match source_agent {
        AgentId::Anthropic => "anthropic",
        AgentId::Codex => "codex",
        AgentId::Gemini => "gemini",
    };
    map.entry(serde_yaml::Value::String("agents".into()))
        .or_insert_with(|| {
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String(agent_str.into())])
        });

    let fm_yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(map))
        .map_err(|e| format!("frontmatter serialize failed: {e}"))?;
    let body_norm = if body.ends_with('\n') || body.is_empty() {
        body
    } else {
        format!("{body}\n")
    };
    Ok(format!(
        "---\n{}\n---\n{body_norm}",
        fm_yaml.trim_end_matches('\n')
    ))
}

fn reserialize(skill: crate::commands::canonical_skills::CanonicalSkill) -> String {
    let mut map = serde_yaml::Mapping::new();
    map.insert(
        serde_yaml::Value::String("name".into()),
        serde_yaml::Value::String(skill.name),
    );
    map.insert(
        serde_yaml::Value::String("description".into()),
        serde_yaml::Value::String(skill.description),
    );
    let agents_seq: Vec<serde_yaml::Value> = skill
        .agents
        .iter()
        .map(|a| {
            serde_yaml::Value::String(
                match a {
                    AgentId::Anthropic => "anthropic",
                    AgentId::Codex => "codex",
                    AgentId::Gemini => "gemini",
                }
                .into(),
            )
        })
        .collect();
    map.insert(
        serde_yaml::Value::String("agents".into()),
        serde_yaml::Value::Sequence(agents_seq),
    );
    if let serde_yaml::Value::Mapping(extras) = skill.frontmatter_extras {
        for (k, v) in extras {
            map.insert(k, v);
        }
    }
    let fm_yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(map)).unwrap_or_default();
    let body_norm = if skill.body.ends_with('\n') || skill.body.is_empty() {
        skill.body
    } else {
        format!("{}\n", skill.body)
    };
    format!("---\n{}\n---\n{body_norm}", fm_yaml.trim_end_matches('\n'))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn unique_tmp(label: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!(
            "felina-import-{label}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .subsec_nanos()
        ));
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn count_skill_subdirs_at_handles_missing_dir() {
        assert_eq!(count_skill_subdirs_at(Path::new("/no/such/path/xyz123")), 0);
    }

    #[test]
    fn count_skill_subdirs_at_counts_only_skill_dot_md_dirs() {
        let tmp = unique_tmp("count");
        // Two valid skill dirs + one bare dir + one file.
        for name in ["alpha", "beta"] {
            let d = tmp.join(name);
            fs::create_dir_all(&d).unwrap();
            fs::write(d.join("SKILL.md"), "x").unwrap();
        }
        fs::create_dir_all(tmp.join("not-a-skill")).unwrap();
        fs::write(tmp.join("loose.md"), "x").unwrap();
        assert_eq!(count_skill_subdirs_at(&tmp), 2);
    }

    #[test]
    fn ensure_required_fields_injects_missing_name_description_agents() {
        // Source has only `description` (Anthropic-style without `name`).
        let raw = "---\ndescription: hi\n---\nbody\n";
        let out = ensure_required_fields(raw, "auto-name", AgentId::Anthropic).unwrap();
        assert!(out.contains("name: auto-name"), "got:\n{out}");
        assert!(out.contains("description: hi"));
        assert!(out.contains("agents:"));
        assert!(out.contains("- anthropic"));
        assert!(out.contains("body"));
    }

    #[test]
    fn body_preview_strips_frontmatter() {
        let raw = "---\nname: x\ndescription: y\nagents: [anthropic]\n---\nbody-content here\n";
        let preview = body_preview_from(raw);
        assert!(preview.contains("body-content here"));
        assert!(!preview.contains("name: x"));
    }

    fn candidate(name: &str, agent: AgentId) -> ImportCandidate {
        ImportCandidate {
            source_path: format!("/fake/{}/{name}/SKILL.md", agent_label(agent)),
            source_agent: agent,
            skill_name: name.to_string(),
            body_preview: String::new(),
            conflict: None,
            deferred: None,
            validation_error: None,
        }
    }

    /// Bug 2 core: a skill name found in one agent folder stays importable;
    /// the same name found in 2+ agent folders collapses to one deferred row
    /// (never silently produces a single-agent tag).
    #[test]
    fn group_by_name_defers_multi_source_keeps_single_source() {
        let raw = vec![
            candidate("solo", AgentId::Anthropic),
            candidate("shared", AgentId::Anthropic),
            candidate("shared", AgentId::Codex),
        ];
        let grouped = group_by_name(raw);
        assert_eq!(
            grouped.len(),
            2,
            "expected one row per name, got {grouped:#?}"
        );

        // BTreeMap → sorted: "shared" before "solo".
        let shared = &grouped[0];
        assert_eq!(shared.skill_name, "shared");
        let def = shared.deferred.as_ref().expect("shared must be deferred");
        assert_eq!(def.agents, vec![AgentId::Anthropic, AgentId::Codex]);
        assert!(def.reason.contains("2 locations"), "reason: {}", def.reason);

        let solo = &grouped[1];
        assert_eq!(solo.skill_name, "solo");
        assert!(
            solo.deferred.is_none(),
            "single-source must stay importable"
        );
    }

    /// Bug 1 building block: distinct names dedupe a name that appears in
    /// two agent locations so the banner total counts unique skills.
    #[test]
    fn distinct_count_dedupes_shared_names() {
        let anthropic = vec!["a".to_string(), "shared".to_string()];
        let codex = vec!["shared".to_string()];
        let mut union: std::collections::HashSet<&String> = std::collections::HashSet::new();
        union.extend(anthropic.iter());
        union.extend(codex.iter());
        // a, shared → 2 unique, NOT 3.
        assert_eq!(union.len(), 2);
        assert_eq!(distinct_count(&anthropic), 2);
        assert_eq!(distinct_count(&codex), 1);
    }

    /// Deferred candidates are refused by apply even if a client sends one.
    #[test]
    fn apply_skips_deferred_candidate() {
        let tmp = unique_tmp("apply-deferred");
        crate::paths::set_felina_home_override_for_test(Some(tmp.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let mut c = candidate("shared", AgentId::Anthropic);
        c.deferred = Some(DeferredMultiSource {
            agents: vec![AgentId::Anthropic, AgentId::Codex],
            reason: "x".into(),
        });
        let sel = ImportSelection {
            candidate: c,
            resolution: ImportResolution::OverwriteCanonical,
        };
        // Canonical is now always global; the override redirects ~/.felina
        // to <tmp>/.felina so this writes inside the tempdir. Deferred
        // selections must be a no-op regardless.
        skill_import_apply(Some(tmp.to_string_lossy().to_string()), vec![sel]).expect("apply");
        assert!(
            !tmp.join(".felina").join("skills").join("shared").exists(),
            "deferred candidate must not be written to canonical"
        );
    }

    /// Task 2.1: BOM + CRLF source with missing `agents` preserves description
    /// and produces no nested frontmatter in the canonical body.
    #[test]
    fn ensure_required_fields_handles_bom_crlf_source() {
        let raw = "\u{feff}---\r\nname: session-start\r\ndescription: Start session context\r\n---\r\n# Body\r\n";
        let out = ensure_required_fields(raw, "session-start", AgentId::Anthropic).unwrap();
        assert!(
            out.contains("description: Start session context"),
            "description preserved, got:\n{out}"
        );
        assert!(out.contains("agents:"), "agents injected, got:\n{out}");
        assert!(out.contains("- anthropic"), "anthropic agent, got:\n{out}");
        // Body must not contain a second frontmatter block.
        let parts: Vec<&str> = out.match_indices("---\n").map(|(i, _)| &out[i..]).collect();
        assert!(
            parts.len() <= 3,
            "at most open + close + body content; got {} fences:\n{out}",
            parts.len()
        );
    }

    #[test]
    fn ensure_required_fields_rewrites_mismatched_name_to_directory_identity() {
        let raw = "---\nname: different-name\ndescription: Start session context\nagents:\n  - anthropic\n---\n# Body\n";
        let out = ensure_required_fields(raw, "folder-name", AgentId::Anthropic).unwrap();
        assert!(
            out.contains("name: folder-name"),
            "canonical name should rewrite to directory identity, got:\n{out}"
        );
        assert!(
            !out.contains("name: different-name"),
            "mismatched source name should not survive, got:\n{out}"
        );
    }

    /// Task 2.2: malformed YAML is rejected.
    #[test]
    fn ensure_required_fields_rejects_malformed_yaml() {
        let raw = "---\n: invalid: yaml: [broken\n---\nbody\n";
        let err = ensure_required_fields(raw, "bad", AgentId::Anthropic).unwrap_err();
        assert!(
            err.to_lowercase().contains("yaml") || err.contains("parse"),
            "should mention YAML error, got: {err}"
        );
    }

    /// Task 2.2: non-mapping frontmatter root is rejected.
    #[test]
    fn ensure_required_fields_rejects_non_mapping_root() {
        let raw = "---\n- list\n- items\n---\nbody\n";
        let err = ensure_required_fields(raw, "bad", AgentId::Anthropic).unwrap_err();
        assert!(
            err.contains("mapping"),
            "should mention mapping, got: {err}"
        );
    }

    /// Task 2.3: nested / repeated frontmatter is rejected — no canonical
    /// file should be written from a corrupted double-frontmatter source.
    #[test]
    fn ensure_required_fields_rejects_nested_frontmatter() {
        // Simulate the corruption pattern: outer frontmatter with empty
        // description, body starts with the original frontmatter.
        let raw = "---\ndescription: ''\n---\n---\nname: real\ndescription: real desc\nagents:\n  - anthropic\n---\n# Body\n";
        let err = ensure_required_fields(raw, "bad", AgentId::Anthropic).unwrap_err();
        assert!(
            err.contains("nested") || err.contains("repeated"),
            "should mention nested/repeated, got: {err}"
        );
    }

    /// Task 2.3: validate_source_frontmatter also catches nested frontmatter.
    #[test]
    fn validate_source_rejects_nested_frontmatter() {
        let raw = "---\ndescription: ''\n---\n---\nname: x\n---\nbody\n";
        let err = validate_source_frontmatter(raw).unwrap_err();
        assert!(
            err.contains("nested") || err.contains("repeated"),
            "got: {err}"
        );
    }

    /// Task 2.3: validate_source_frontmatter accepts valid frontmatter.
    #[test]
    fn validate_source_accepts_valid_frontmatter() {
        let raw = "---\nname: ok\ndescription: fine\n---\n# Body\n";
        validate_source_frontmatter(raw).expect("valid source should pass");
    }

    /// Tasks 3.1/3.2: a source whose frontmatter cannot be normalized
    /// (here: non-mapping YAML root) imports as a verbatim broken canonical
    /// file rather than being skipped/blocked. The on-disk bytes equal the
    /// source and `parse_skill_md` rejects it (reads back as Broken). A
    /// pre-set `validation_error` must NOT block the write.
    #[test]
    fn import_malformed_source_writes_verbatim_broken() {
        use crate::commands::canonical_skills::parse_skill_md;
        let home = unique_tmp("broken-home");
        let project = unique_tmp("broken-proj");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        // Non-mapping frontmatter root (a YAML list) — cannot be normalized.
        let source_content = "---\n- not\n- a mapping\n---\n# Body\n";
        let src_dir = project.join(".claude").join("skills").join("bad-skill");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(src_dir.join("SKILL.md"), source_content).unwrap();

        let mut c = candidate("bad-skill", AgentId::Anthropic);
        c.source_path = src_dir.join("SKILL.md").to_string_lossy().to_string();
        // Simulate scan having flagged it — apply must still import as broken.
        c.validation_error = Some("non-mapping root".into());

        skill_import_apply(
            Some(project.to_string_lossy().to_string()),
            vec![ImportSelection {
                candidate: c,
                resolution: ImportResolution::OverwriteCanonical,
            }],
        )
        .expect("apply should not error for a non-normalizable source");

        let written = home
            .join(".felina")
            .join("skills")
            .join("bad-skill")
            .join("SKILL.md");
        let on_disk = fs::read_to_string(&written).expect("verbatim broken file written");
        assert_eq!(
            on_disk, source_content,
            "broken source must be written verbatim"
        );
        assert!(
            parse_skill_md(&on_disk).is_err(),
            "written canonical must read back as Broken (unparseable)"
        );
    }

    /// Regression: importing a skill from a project must produce EXACTLY one
    /// target (the project source) in the global sidecar — not a synthetic
    /// global target (from the skill's `agents` backfill) plus the project
    /// target. Reproduces the "target shows global + projectA" bug.
    #[test]
    fn import_from_project_writes_single_project_target() {
        let home = unique_tmp("import-home");
        let project = unique_tmp("import-proj");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        // Source skill on disk in the project's .claude/skills dir.
        let src_dir = project.join(".claude").join("skills").join("skill-a");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(
            src_dir.join("SKILL.md"),
            "---\nname: skill-a\ndescription: a\nagents: [anthropic]\n---\nbody-a\n",
        )
        .unwrap();

        let mut c = candidate("skill-a", AgentId::Anthropic);
        c.source_path = src_dir.join("SKILL.md").to_string_lossy().to_string();
        let project_str = project.to_string_lossy().to_string();
        skill_import_apply(
            Some(project_str.clone()),
            vec![ImportSelection {
                candidate: c,
                resolution: ImportResolution::OverwriteCanonical,
            }],
        )
        .expect("apply");

        // Global master exists with EXACTLY one project target.
        let meta_raw = fs::read_to_string(
            home.join(".felina")
                .join("skills")
                .join("skill-a")
                .join(".felina-sync-meta.json"),
        )
        .expect("sidecar");
        let meta: serde_json::Value = serde_json::from_str(&meta_raw).unwrap();
        let targets = meta["targets"].as_array().expect("targets array");
        assert_eq!(
            targets.len(),
            1,
            "import must write a single target, got: {targets:?}"
        );
        assert_eq!(targets[0]["scope"], "project");
        assert_eq!(targets[0]["project"], project_str);
        assert_eq!(targets[0]["agent"], "anthropic");
    }
}
