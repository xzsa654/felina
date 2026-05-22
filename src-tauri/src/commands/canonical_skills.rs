//! Canonical skill main-file storage layer.
//!
//! `~/.felina/skills/<name>/SKILL.md` (global) and
//! `<project>/.felina/skills/<name>/SKILL.md` (project) are the source of
//! truth for skills the user edits. Agent-native skill dirs (`.claude/skills`,
//! `.agents/skills`, `.gemini/skills`) are fan-out *outputs* — see
//! `commands::fan_out`.
//!
//! Decisions referenced (see design.md):
//! - Decision 1: `.felina/skills/` prefix.
//! - Decision 2: required fields strongly typed; remainder as `serde_yaml::Value`
//!   passthrough so adding optional fields never touches this struct.

use crate::paths;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Agent ids supported by the multi-agent skills foundation.
/// Wire format is lowercase: `"anthropic" | "codex" | "gemini"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentId {
    Anthropic,
    Codex,
    Gemini,
}

/// Skill scope discriminator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SkillScope {
    Global,
    Project,
}

/// A parsed canonical skill main file. Wire shape:
/// ```json
/// { "name": "...", "description": "...", "agents": ["anthropic"],
///   "frontmatterExtras": { ... }, "body": "...",
///   "dirty": false, "lastSynced": "2026-05-21T..." | null }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalSkill {
    pub name: String,
    pub description: String,
    pub agents: Vec<AgentId>,
    /// Optional frontmatter fields preserved verbatim. Per-agent renderers
    /// pick what they need out of here; unknown fields stay round-trippable.
    pub frontmatter_extras: serde_yaml::Value,
    /// Raw markdown body, never reparsed.
    pub body: String,
    /// True when canonical content changed since the last successful push.
    pub dirty: bool,
    /// ISO-8601 timestamp of the last successful push, if any (display only;
    /// derived from sync-meta v1 legacy field or newest `last_sync[*].at`).
    pub last_synced: Option<String>,
    /// Per-skill target list (sync-meta v2). Empty for new skills before
    /// the first push, or for skills whose sidecar is still v1 and has not
    /// been touched by a target-editor commit yet.
    #[serde(default)]
    pub targets: Vec<SkillTarget>,
    /// Per-target push provenance (sync-meta v2). Keyed by `target_key()`.
    #[serde(default)]
    pub last_sync: BTreeMap<String, LastSyncEntry>,
}

/// Resolve the canonical skills directory for a scope.
pub fn canonical_skills_dir_for_scope(
    scope: SkillScope,
    project_path: Option<&str>,
) -> Result<PathBuf, String> {
    match scope {
        SkillScope::Global => Ok(paths::felina_global_skills_dir()),
        SkillScope::Project => {
            let pp = project_path.ok_or("project_path required for project scope")?;
            Ok(paths::felina_project_skills_dir(pp))
        }
    }
}

/// Split a SKILL.md text into `(frontmatter_yaml, body)`.
///
/// Recognised shapes:
/// - `---\n<yaml>\n---\n<body>` — standard YAML frontmatter
/// - `---\r\n<yaml>\r\n---\r\n<body>` — CRLF (Windows)
/// - text with no leading `---` — entire content treated as body
fn split_frontmatter(raw: &str) -> (String, String) {
    // Tolerate optional BOM + leading whitespace before the opening fence.
    let trimmed = raw.trim_start_matches('\u{feff}');
    let trimmed = trimmed.trim_start_matches(['\n', '\r']);

    let Some(rest) = trimmed.strip_prefix("---") else {
        return (String::new(), raw.to_string());
    };
    // Opening `---` must be its own line.
    let rest = match rest.strip_prefix("\r\n").or_else(|| rest.strip_prefix('\n')) {
        Some(r) => r,
        None => return (String::new(), raw.to_string()),
    };

    // Find the closing fence. It must sit on its own line.
    // Search for "\n---" then verify what follows is line-end or EOF.
    for (i, _) in rest.match_indices("\n---") {
        let after_fence_idx = i + 4; // past "\n---"
        let after = &rest[after_fence_idx..];
        let body_start = match after.chars().next() {
            Some('\n') => Some(after_fence_idx + 1),
            Some('\r') if after.starts_with("\r\n") => Some(after_fence_idx + 2),
            Some(_) => continue, // not a fence-only line; keep looking
            None => Some(after_fence_idx),
        };
        if let Some(body_idx) = body_start {
            let fm = rest[..i].to_string();
            let body = rest[body_idx..].to_string();
            return (fm, body);
        }
    }

    // Unterminated frontmatter: be permissive — treat entire content as body
    // so the caller can still surface the broken skill rather than crash.
    (String::new(), raw.to_string())
}

/// Parse a SKILL.md string into a `CanonicalSkill`. Required fields
/// (`name`, `description`, `agents`) must be present; everything else lands
/// in `frontmatter_extras`. `dirty` defaults to `false` and `last_synced`
/// to `None` — callers overlay sync-meta state from the per-skill sidecar
/// JSON.
pub fn parse_skill_md(raw: &str) -> Result<CanonicalSkill, String> {
    let (fm_text, body) = split_frontmatter(raw);
    if fm_text.is_empty() {
        return Err("missing or unterminated YAML frontmatter".into());
    }

    let mut value: serde_yaml::Value = serde_yaml::from_str(&fm_text)
        .map_err(|e| format!("frontmatter YAML parse failed: {e}"))?;

    let map = value
        .as_mapping_mut()
        .ok_or_else(|| "frontmatter root must be a YAML mapping".to_string())?;

    // Pluck out required fields, removing them from the map so the rest can
    // pass through as `frontmatter_extras` verbatim.
    let name = take_required_string(map, "name")?;
    let description = take_required_string(map, "description")?;
    let agents = take_required_agents(map)?;

    Ok(CanonicalSkill {
        name,
        description,
        agents,
        frontmatter_extras: value, // map mutations reflected here
        body,
        dirty: false,
        last_synced: None,
        targets: Vec::new(),
        last_sync: BTreeMap::new(),
    })
}

fn take_required_string(
    map: &mut serde_yaml::Mapping,
    key: &str,
) -> Result<String, String> {
    let v = map
        .remove(serde_yaml::Value::String(key.to_string()))
        .ok_or_else(|| format!("missing required frontmatter field: {key}"))?;
    match v {
        serde_yaml::Value::String(s) => Ok(s),
        other => Err(format!(
            "frontmatter field `{key}` must be a string (got {})",
            type_label(&other)
        )),
    }
}

fn take_required_agents(map: &mut serde_yaml::Mapping) -> Result<Vec<AgentId>, String> {
    let v = map
        .remove(serde_yaml::Value::String("agents".to_string()))
        .ok_or_else(|| "missing required frontmatter field: agents".to_string())?;
    let seq = match v {
        serde_yaml::Value::Sequence(s) => s,
        other => {
            return Err(format!(
                "frontmatter field `agents` must be a list (got {})",
                type_label(&other)
            ));
        }
    };
    let mut out = Vec::with_capacity(seq.len());
    for entry in seq {
        let s = match entry {
            serde_yaml::Value::String(s) => s,
            other => {
                return Err(format!(
                    "agents list entries must be strings (got {})",
                    type_label(&other)
                ));
            }
        };
        let id = match s.as_str() {
            "anthropic" => AgentId::Anthropic,
            "codex" => AgentId::Codex,
            "gemini" => AgentId::Gemini,
            unknown => return Err(format!("unknown agent id: {unknown}")),
        };
        if !out.contains(&id) {
            out.push(id);
        }
    }
    Ok(out)
}

/// Tagged-union list entry returned by `canonical_skills_list`. A skill
/// with unparseable frontmatter is surfaced as `Broken` so the UI list can
/// still render it without aborting the entire scan.
#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SkillListEntry {
    Ok {
        skill: CanonicalSkill,
    },
    Broken {
        /// Directory name (best-available identifier when frontmatter is unreadable).
        name: String,
        /// Absolute path to the broken SKILL.md (for the "open raw file" link).
        path: String,
        error: String,
    },
}

/// Sidecar JSON that persists `dirty` + `last_synced` across app restarts —
/// schema v1, retained only for reading existing sidecars before backfill.
/// New writes use `SyncMetaV2`.
#[derive(Debug, Default, Serialize, Deserialize)]
struct SyncMetaV1 {
    #[serde(default)]
    dirty: bool,
    #[serde(default)]
    last_synced: Option<String>,
}

/// Per-skill target list mode. See design.md Decision "sync-meta schema v2".
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TargetMode {
    /// Push overwrites the agent-side file.
    Tracked,
    /// Target skipped by push (kept in list for visibility / re-enable).
    Detached,
    /// Reserved for Phase 2 overlay customization. NOT rendered by this capability.
    Forked,
}

/// A single fan-out target entry in the per-skill target list.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillTarget {
    pub agent: AgentId,
    pub scope: SkillScope,
    /// Required when `scope == Project`; absolute project root path.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
    pub enabled: bool,
    pub mode: TargetMode,
}

/// Per-target push provenance, recorded after a successful render+write.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LastSyncEntry {
    /// SHA-256 hex of the rendered SKILL.md content at last successful push.
    pub pushed_hash: String,
    /// Reserved for Phase 2 fork resolution; unset in this capability.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub base_snapshot: Option<String>,
    /// ISO-8601 timestamp of the last successful push for this target.
    pub at: String,
}

/// Sidecar schema v2. Stored at `<skill_dir>/.felina-sync-meta.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncMetaV2 {
    /// Schema version. Always `2` when written by this code.
    pub version: u32,
    #[serde(default)]
    pub targets: Vec<SkillTarget>,
    /// Per-target push state, keyed by `target_key()`.
    #[serde(default)]
    pub last_sync: BTreeMap<String, LastSyncEntry>,
    #[serde(default)]
    pub dirty: bool,
}

impl Default for SyncMetaV2 {
    fn default() -> Self {
        Self {
            version: 2,
            targets: Vec::new(),
            last_sync: BTreeMap::new(),
            dirty: false,
        }
    }
}

const SYNC_META_FILENAME: &str = ".felina-sync-meta.json";

fn agent_str(a: AgentId) -> &'static str {
    match a {
        AgentId::Anthropic => "anthropic",
        AgentId::Codex => "codex",
        AgentId::Gemini => "gemini",
    }
}

/// Stable per-target identifier for keying `SyncMetaV2.last_sync`.
/// Format: `<agent>:<global|project>:<project_path>` (project path omitted
/// for global scope).
pub fn target_key(t: &SkillTarget) -> String {
    match t.scope {
        SkillScope::Global => format!("{}:global", agent_str(t.agent)),
        SkillScope::Project => format!(
            "{}:project:{}",
            agent_str(t.agent),
            t.project.as_deref().unwrap_or(""),
        ),
    }
}

/// Build a v2 sync-meta whose target list is derived from a canonical skill's
/// `agents` frontmatter field (one tracked enabled target per agent at the
/// skill's own scope/project). Used both for v1 backfill and for the
/// "no sidecar yet" case.
fn backfill_from_skill(
    skill: &CanonicalSkill,
    scope: SkillScope,
    project_path: Option<&str>,
    dirty: bool,
) -> SyncMetaV2 {
    let project = match scope {
        SkillScope::Project => project_path.map(|s| s.to_string()),
        SkillScope::Global => None,
    };
    let targets = skill
        .agents
        .iter()
        .map(|&agent| SkillTarget {
            agent,
            scope,
            project: project.clone(),
            enabled: true,
            mode: TargetMode::Tracked,
        })
        .collect();
    SyncMetaV2 {
        version: 2,
        targets,
        last_sync: BTreeMap::new(),
        dirty,
    }
}

/// Read the sync-meta sidecar in canonical v2 shape. Transparently backfills
/// v1 sidecars (lacking `version` / `targets`) so callers never see a v1
/// shape.
///
/// Returns `(SyncMetaV2, legacy_last_synced)`. `legacy_last_synced` carries
/// the v1 sidecar's `last_synced` value (so `CanonicalSkill.last_synced` can
/// still be displayed) and is `None` for native v2 sidecars.
pub(crate) fn read_sync_meta_v2(
    skill_dir: &Path,
    skill: &CanonicalSkill,
    scope: SkillScope,
    project_path: Option<&str>,
) -> (SyncMetaV2, Option<String>) {
    let path = skill_dir.join(SYNC_META_FILENAME);
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        // No sidecar yet → treat as a fresh skill that has never been pushed.
        Err(_) => return (backfill_from_skill(skill, scope, project_path, false), None),
    };

    // Probe the JSON: native v2 is identified by `version: 2`. Anything
    // missing `version` / `targets` is v1 (or corrupt — same fallback).
    let probe: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return (backfill_from_skill(skill, scope, project_path, false), None),
    };

    if probe.get("version").and_then(|v| v.as_u64()) == Some(2)
        && probe.get("targets").is_some()
    {
        if let Ok(meta) = serde_json::from_str::<SyncMetaV2>(&raw) {
            // v2 + non-empty targets → use as-is.
            if !meta.targets.is_empty() {
                return (meta, None);
            }
            // v2 + empty targets is the "fresh sidecar / not yet backfilled"
            // state produced by mark_sync_meta_dirty without skill context.
            // Backfill from the canonical's agents but preserve any
            // already-recorded last_sync entries and dirty flag.
            let mut result = backfill_from_skill(skill, scope, project_path, meta.dirty);
            result.last_sync = meta.last_sync;
            return (result, None);
        }
        // v2 markers present but parse failed → fall through to v1/backfill
        // rather than panicking the UI list.
    }

    // v1 sidecar: backfill targets, preserve dirty + last_synced.
    let v1: SyncMetaV1 = serde_json::from_str(&raw).unwrap_or_default();
    let meta = backfill_from_skill(skill, scope, project_path, v1.dirty);
    (meta, v1.last_synced)
}

/// Write a v2 sync-meta sidecar. Overwrites the existing file completely
/// (no field-level merge — callers compose the desired SyncMetaV2 first).
pub(crate) fn write_sync_meta_v2(skill_dir: &Path, meta: &SyncMetaV2) -> Result<(), String> {
    let path = skill_dir.join(SYNC_META_FILENAME);
    let json = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("failed to serialize sync-meta v2: {e}"))?;
    fs::write(&path, json).map_err(|e| format!("failed to write sync-meta v2: {e}"))
}

/// Mark the skill dirty in its sync-meta sidecar. Flips dirty=true while preserving the on-disk
/// sidecar's shape: a v2 sidecar stays v2 (targets + last_sync survive),
/// a v1 sidecar stays v1 (last_synced survives — v1→v2 upgrade is deferred
/// to fan-out push), and a missing sidecar produces a fresh v2 default.
fn mark_sync_meta_dirty(skill_dir: &Path) {
    let path = skill_dir.join(SYNC_META_FILENAME);
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => {
            let meta = SyncMetaV2 { dirty: true, ..SyncMetaV2::default() };
            let _ = write_sync_meta_v2(skill_dir, &meta);
            return;
        }
    };

    let is_v2 = serde_json::from_str::<serde_json::Value>(&raw)
        .ok()
        .and_then(|v| {
            v.get("version")
                .and_then(|n| n.as_u64())
                .map(|n| n == 2 && v.get("targets").is_some())
        })
        .unwrap_or(false);

    if is_v2 {
        let mut meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap_or_default();
        meta.dirty = true;
        let _ = write_sync_meta_v2(skill_dir, &meta);
    } else {
        // v1 or corrupt — preserve v1 shape (last_synced lives on) and
        // just flip dirty=true. Full v2 upgrade happens at the next push.
        let v1: SyncMetaV1 = serde_json::from_str(&raw).unwrap_or_default();
        let updated = SyncMetaV1 { dirty: true, last_synced: v1.last_synced };
        if let Ok(json) = serde_json::to_string_pretty(&updated) {
            let _ = fs::write(&path, json);
        }
    }
}

/// Regenerate the v2 sidecar's `targets` to mirror the canonical skill's
/// current `agents` frontmatter list. Preserves `last_sync` entries whose
/// `target_key()` still maps to a target in the new list (so unchanged
/// agents keep their push provenance) and drops orphaned ones. No-op for
/// missing sidecars and for v1 sidecars (the next push backfills v1 → v2
/// from the current agents anyway, so realignment there is redundant).
///
/// This is what enforces the design decision "target 來源等同 agents 欄位"
/// on the write path: without it, ticking a new agent in SkillEditor would
/// be silently ignored by fan-out because the existing v2 targets list
/// remains the old one.
fn align_v2_targets_to_agents(
    skill_dir: &Path,
    agents: &[AgentId],
    scope: SkillScope,
    project_path: Option<&str>,
) {
    let path = skill_dir.join(SYNC_META_FILENAME);
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return,
    };
    let is_v2 = serde_json::from_str::<serde_json::Value>(&raw)
        .ok()
        .and_then(|v| {
            v.get("version")
                .and_then(|n| n.as_u64())
                .map(|n| n == 2 && v.get("targets").is_some())
        })
        .unwrap_or(false);
    if !is_v2 {
        return;
    }
    let mut meta: SyncMetaV2 = match serde_json::from_str(&raw) {
        Ok(m) => m,
        Err(_) => return,
    };
    let project = match scope {
        SkillScope::Project => project_path.map(|s| s.to_string()),
        SkillScope::Global => None,
    };
    let new_targets: Vec<SkillTarget> = agents
        .iter()
        .map(|&a| SkillTarget {
            agent: a,
            scope,
            project: project.clone(),
            enabled: true,
            mode: TargetMode::Tracked,
        })
        .collect();
    let valid_keys: std::collections::HashSet<String> =
        new_targets.iter().map(target_key).collect();
    meta.last_sync.retain(|k, _| valid_keys.contains(k));
    meta.targets = new_targets;
    let _ = write_sync_meta_v2(skill_dir, &meta);
}

/// Pick the most-recent `at` timestamp across a per-target last_sync map,
/// for surfacing a single `CanonicalSkill.last_synced` value to the UI.
/// ISO-8601 UTC strings (`...Z`) compare lexicographically as time order.
fn pick_latest_at(last_sync: &BTreeMap<String, LastSyncEntry>) -> Option<String> {
    last_sync
        .values()
        .map(|e| e.at.clone())
        .max()
}

/// List canonical skills under the given scope. A missing canonical
/// directory returns an empty Vec — never an error.
/// Broken skills (parse failures) are returned as `SkillListEntry::Broken`.
#[tauri::command]
pub fn canonical_skills_list(
    scope: SkillScope,
    project_path: Option<String>,
) -> Result<Vec<SkillListEntry>, String> {
    let dir = canonical_skills_dir_for_scope(scope, project_path.as_deref())?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("failed to read canonical skills dir: {e}"))?;

    let mut out = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|e| format!("failed to read dir entry: {e}"))?;
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !ft.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        let skill_dir = entry.path();
        let skill_md = skill_dir.join("SKILL.md");
        if !skill_md.is_file() {
            // Directory without a SKILL.md isn't a skill — skip silently.
            continue;
        }

        let raw = match fs::read_to_string(&skill_md) {
            Ok(s) => s,
            Err(e) => {
                out.push(SkillListEntry::Broken {
                    name: dir_name,
                    path: skill_md.to_string_lossy().to_string(),
                    error: format!("read failed: {e}"),
                });
                continue;
            }
        };

        match parse_skill_md(&raw) {
            Ok(mut skill) => {
                let (meta, legacy_last) =
                    read_sync_meta_v2(&skill_dir, &skill, scope, project_path.as_deref());
                skill.dirty = meta.dirty;
                skill.last_synced = legacy_last.or_else(|| pick_latest_at(&meta.last_sync));
                skill.targets = meta.targets;
                skill.last_sync = meta.last_sync;
                out.push(SkillListEntry::Ok { skill });
            }
            Err(e) => {
                out.push(SkillListEntry::Broken {
                    name: dir_name,
                    path: skill_md.to_string_lossy().to_string(),
                    error: e,
                });
            }
        }
    }

    out.sort_by(|a, b| entry_name(a).cmp(entry_name(b)));
    Ok(out)
}

fn entry_name(e: &SkillListEntry) -> &str {
    match e {
        SkillListEntry::Ok { skill } => &skill.name,
        SkillListEntry::Broken { name, .. } => name,
    }
}

/// Read one canonical skill by its directory name. Returns Err when the
/// SKILL.md is missing or its frontmatter can't be parsed — matches the
/// spec's "Frontmatter fails to parse" scenario.
#[tauri::command]
pub fn canonical_skills_read(
    scope: SkillScope,
    project_path: Option<String>,
    name: String,
) -> Result<CanonicalSkill, String> {
    let dir = canonical_skills_dir_for_scope(scope, project_path.as_deref())?;
    let skill_dir = dir.join(&name);
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("skill not found: {name}"));
    }
    let raw = fs::read_to_string(&skill_md)
        .map_err(|e| format!("failed to read SKILL.md: {e}"))?;
    let mut skill = parse_skill_md(&raw)?;
    let (meta, legacy_last) =
        read_sync_meta_v2(&skill_dir, &skill, scope, project_path.as_deref());
    skill.dirty = meta.dirty;
    skill.last_synced = legacy_last.or_else(|| pick_latest_at(&meta.last_sync));
    skill.targets = meta.targets;
    skill.last_sync = meta.last_sync;
    Ok(skill)
}

/// Reject skill names that could escape the canonical skills directory.
/// Allowed: ASCII alphanumerics, `-`, `_`. Rejected: empty, leading `.`,
/// any path separator, any `..` segment, any control char. The strict
/// allowlist is intentional — skill names become filesystem directory
/// segments, and a Windows-vs-Unix-inconsistent allowlist is a future bug.
fn validate_skill_name(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("skill name must not be empty".into());
    }
    if name.starts_with('.') {
        return Err("skill name must not start with '.'".into());
    }
    for ch in name.chars() {
        let ok = ch.is_ascii_alphanumeric() || ch == '-' || ch == '_';
        if !ok {
            return Err(format!(
                "skill name contains disallowed character: {ch:?} (allowed: ASCII alnum, '-', '_')"
            ));
        }
    }
    Ok(())
}

/// Write a canonical skill: serialize `frontmatter` (a `serde_yaml::Value`
/// mapping containing `name`/`description`/`agents` plus any extras) and
/// `body` to `<scope_dir>/<name>/SKILL.md`. Creates parents as needed.
///
/// Note: the `name` parameter is the directory name and is validated;
/// callers should ensure the frontmatter's `name` field matches.
#[tauri::command]
pub fn canonical_skills_write(
    scope: SkillScope,
    project_path: Option<String>,
    name: String,
    frontmatter: serde_yaml::Value,
    body: String,
) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = canonical_skills_dir_for_scope(scope, project_path.as_deref())?;
    let skill_dir = dir.join(&name);
    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("failed to create canonical skill dir: {e}"))?;

    let fm_yaml = serde_yaml::to_string(&frontmatter)
        .map_err(|e| format!("failed to serialize frontmatter: {e}"))?;
    // `to_string` already emits trailing `\n`; trim then bracket with fences.
    let fm_trimmed = fm_yaml.trim_end_matches('\n');
    let body_normalized = if body.ends_with('\n') {
        body
    } else {
        format!("{body}\n")
    };
    let out = format!("---\n{fm_trimmed}\n---\n{body_normalized}");
    fs::write(skill_dir.join("SKILL.md"), out)
        .map_err(|e| format!("failed to write SKILL.md: {e}"))?;
    // Freshly-written canonical is by definition out-of-sync with every
    // agent target. Flip sync-meta dirty=true (preserving last_synced) so
    // the per-skill Push button surfaces as "Push" rather than "Re-push".
    mark_sync_meta_dirty(&skill_dir);
    // Keep v2 sidecar targets in lock-step with the canonical's agents
    // frontmatter (design: target 來源等同 agents 欄位). Without this,
    // adding/removing an agent in SkillEditor would not change what
    // fan-out pushes until the next manual sidecar edit.
    let agents: Vec<AgentId> = frontmatter
        .get("agents")
        .cloned()
        .and_then(|v| serde_yaml::from_value::<Vec<AgentId>>(v).ok())
        .unwrap_or_default();
    align_v2_targets_to_agents(&skill_dir, &agents, scope, project_path.as_deref());
    Ok(())
}

/// Delete a canonical skill directory and everything inside it.
#[tauri::command]
pub fn canonical_skills_delete(
    scope: SkillScope,
    project_path: Option<String>,
    name: String,
) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = canonical_skills_dir_for_scope(scope, project_path.as_deref())?;
    let skill_dir = dir.join(&name);
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)
            .map_err(|e| format!("failed to delete canonical skill dir: {e}"))?;
    }
    Ok(())
}

fn type_label(v: &serde_yaml::Value) -> &'static str {
    match v {
        serde_yaml::Value::Null => "null",
        serde_yaml::Value::Bool(_) => "bool",
        serde_yaml::Value::Number(_) => "number",
        serde_yaml::Value::String(_) => "string",
        serde_yaml::Value::Sequence(_) => "sequence",
        serde_yaml::Value::Mapping(_) => "mapping",
        serde_yaml::Value::Tagged(_) => "tagged",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = "---\n\
name: search-helper\n\
description: Search the web\n\
agents:\n\
  - anthropic\n\
  - gemini\n\
effort: high\n\
custom_field:\n\
  nested: yes\n\
---\n\
# Body\n\
\n\
Hello.\n";

    #[test]
    fn parses_required_fields() {
        let s = parse_skill_md(SAMPLE).unwrap();
        assert_eq!(s.name, "search-helper");
        assert_eq!(s.description, "Search the web");
        assert_eq!(s.agents, vec![AgentId::Anthropic, AgentId::Gemini]);
        assert!(s.body.starts_with("# Body"));
        assert!(!s.dirty);
        assert!(s.last_synced.is_none());
    }

    #[test]
    fn preserves_extras_passthrough() {
        let s = parse_skill_md(SAMPLE).unwrap();
        let extras = s.frontmatter_extras.as_mapping().unwrap();
        // `effort` and `custom_field` survive untouched; `name`/`description`/`agents` removed.
        assert!(extras.contains_key(serde_yaml::Value::String("effort".into())));
        assert!(extras.contains_key(serde_yaml::Value::String("custom_field".into())));
        assert!(!extras.contains_key(serde_yaml::Value::String("name".into())));
    }

    #[test]
    fn rejects_missing_required() {
        let bad = "---\nname: x\ndescription: y\n---\nbody\n";
        let err = parse_skill_md(bad).unwrap_err();
        assert!(err.contains("agents"), "err was: {err}");
    }

    #[test]
    fn rejects_unknown_agent() {
        let bad = "---\nname: x\ndescription: y\nagents:\n  - bogus\n---\nbody\n";
        let err = parse_skill_md(bad).unwrap_err();
        assert!(err.contains("bogus"), "err was: {err}");
    }

    #[test]
    fn handles_crlf_frontmatter() {
        let crlf = "---\r\nname: x\r\ndescription: y\r\nagents:\r\n  - codex\r\n---\r\nbody\r\n";
        let s = parse_skill_md(crlf).unwrap();
        assert_eq!(s.agents, vec![AgentId::Codex]);
        assert_eq!(s.body.trim_end(), "body");
    }

    #[test]
    fn rejects_no_frontmatter() {
        let err = parse_skill_md("just a body").unwrap_err();
        assert!(err.contains("frontmatter"), "err was: {err}");
    }

    // ---------------------------------------------------------------------
    // List / read tests — exercise project-scope paths against a tempdir.
    // ---------------------------------------------------------------------

    use std::sync::atomic::{AtomicU32, Ordering};

    /// Create a fresh tempdir for use as a fake project root. Unique per
    /// call so parallel tests don't collide.
    fn tempdir() -> PathBuf {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("felina-test-{pid}-{nanos}-{n}"));
        fs::create_dir_all(&dir).expect("mkdir tempdir");
        dir
    }

    fn write_skill(skills_root: &Path, name: &str, body: &str) {
        let d = skills_root.join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("SKILL.md"), body).unwrap();
    }

    #[test]
    fn list_returns_empty_for_missing_dir() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();
        let entries =
            canonical_skills_list(SkillScope::Project, Some(project)).unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn list_distinguishes_ok_and_broken() {
        let tmp = tempdir();
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        // Two well-formed skills, one broken (truncated frontmatter).
        write_skill(
            &skills_root,
            "alpha",
            "---\nname: alpha\ndescription: a\nagents: [anthropic]\n---\nbody-a\n",
        );
        write_skill(
            &skills_root,
            "beta",
            "---\nname: beta\ndescription: b\nagents: [codex]\n---\nbody-b\n",
        );
        write_skill(
            &skills_root,
            "broken",
            "---\nname: broken\n# missing description + agents\n---\nbody\n",
        );

        let project = tmp.to_string_lossy().to_string();
        let entries =
            canonical_skills_list(SkillScope::Project, Some(project)).unwrap();
        assert_eq!(entries.len(), 3, "expected 3 entries, got {entries:#?}");

        // Sorted alphabetically by name. alpha + beta = Ok, broken = Broken.
        match &entries[0] {
            SkillListEntry::Ok { skill } => assert_eq!(skill.name, "alpha"),
            other => panic!("expected Ok(alpha), got {other:?}"),
        }
        match &entries[1] {
            SkillListEntry::Ok { skill } => assert_eq!(skill.name, "beta"),
            other => panic!("expected Ok(beta), got {other:?}"),
        }
        match &entries[2] {
            SkillListEntry::Broken { name, error, .. } => {
                assert_eq!(name, "broken");
                assert!(!error.is_empty());
            }
            other => panic!("expected Broken(broken), got {other:?}"),
        }
    }

    #[test]
    fn read_returns_err_for_broken_frontmatter() {
        let tmp = tempdir();
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "bad",
            "---\nname: bad\nagents: [anthropic]\n---\nbody\n", // missing description
        );

        let project = tmp.to_string_lossy().to_string();
        let err = canonical_skills_read(SkillScope::Project, Some(project), "bad".into())
            .unwrap_err();
        assert!(err.contains("description"), "err was: {err}");
    }

    #[test]
    fn write_creates_dir_and_round_trips_through_read() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String("foo".into()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String("Foo helper".into()),
        );
        fm.insert(
            serde_yaml::Value::String("agents".into()),
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String("anthropic".into())]),
        );
        fm.insert(
            serde_yaml::Value::String("effort".into()),
            serde_yaml::Value::String("high".into()),
        );

        canonical_skills_write(
            SkillScope::Project,
            Some(project.clone()),
            "foo".into(),
            serde_yaml::Value::Mapping(fm),
            "Foo body".into(),
        )
        .expect("write");

        // Directory should be created automatically.
        assert!(tmp.join(".felina").join("skills").join("foo").join("SKILL.md").is_file());

        let skill = canonical_skills_read(
            SkillScope::Project,
            Some(project),
            "foo".into(),
        )
        .expect("read back");
        assert_eq!(skill.name, "foo");
        assert_eq!(skill.description, "Foo helper");
        assert_eq!(skill.agents, vec![AgentId::Anthropic]);
        assert!(skill.body.contains("Foo body"));
        // `effort` survives as an extra.
        assert!(skill
            .frontmatter_extras
            .as_mapping()
            .unwrap()
            .contains_key(serde_yaml::Value::String("effort".into())));
    }

    #[test]
    fn write_rejects_path_traversal_names() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();
        let empty_fm = serde_yaml::Value::Mapping(serde_yaml::Mapping::new());

        for bad in [
            "..",
            "../escape",
            "foo/bar",
            "foo\\bar",
            ".hidden",
            "",
            "with space",
            "with;semi",
        ] {
            let err = canonical_skills_write(
                SkillScope::Project,
                Some(project.clone()),
                bad.into(),
                empty_fm.clone(),
                String::new(),
            )
            .unwrap_err();
            assert!(
                err.contains("skill name") || err.contains("disallowed"),
                "bad={bad:?} err={err}"
            );
        }
    }

    #[test]
    fn delete_removes_skill_dir() {
        let tmp = tempdir();
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "doomed",
            "---\nname: doomed\ndescription: x\nagents: [anthropic]\n---\nbody\n",
        );
        assert!(skills_root.join("doomed").is_dir());

        let project = tmp.to_string_lossy().to_string();
        canonical_skills_delete(SkillScope::Project, Some(project), "doomed".into())
            .expect("delete");
        assert!(!skills_root.join("doomed").exists());
    }

    #[test]
    fn read_returns_err_for_missing_skill() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();
        let err = canonical_skills_read(
            SkillScope::Project,
            Some(project),
            "nope".into(),
        )
        .unwrap_err();
        assert!(err.contains("not found"), "err was: {err}");
    }

    // ---------------------------------------------------------------------
    // sync-meta schema v2 tests (path-bug-and-target-model change)
    // ---------------------------------------------------------------------

    fn skill_with_agents(name: &str, agents: Vec<AgentId>) -> CanonicalSkill {
        CanonicalSkill {
            name: name.to_string(),
            description: "x".into(),
            agents,
            frontmatter_extras: serde_yaml::Value::Mapping(Default::default()),
            body: String::new(),
            dirty: false,
            last_synced: None,
            targets: Vec::new(),
            last_sync: BTreeMap::new(),
        }
    }

    #[test]
    fn v2_sidecar_round_trips() {
        let tmp = tempdir();
        let skill_dir = tmp.join("foo");
        fs::create_dir_all(&skill_dir).unwrap();

        let mut last_sync = std::collections::BTreeMap::new();
        last_sync.insert(
            "anthropic:project:C:/proj".to_string(),
            LastSyncEntry {
                pushed_hash: "abc123".into(),
                base_snapshot: None,
                at: "2026-05-22T05:00:00Z".into(),
            },
        );
        last_sync.insert(
            "codex:project:C:/proj".to_string(),
            LastSyncEntry {
                pushed_hash: "def456".into(),
                base_snapshot: None,
                at: "2026-05-22T05:01:00Z".into(),
            },
        );

        let original = SyncMetaV2 {
            version: 2,
            targets: vec![
                SkillTarget {
                    agent: AgentId::Anthropic,
                    scope: SkillScope::Project,
                    project: Some("C:/proj".into()),
                    enabled: true,
                    mode: TargetMode::Tracked,
                },
                SkillTarget {
                    agent: AgentId::Codex,
                    scope: SkillScope::Project,
                    project: Some("C:/proj".into()),
                    enabled: true,
                    mode: TargetMode::Tracked,
                },
            ],
            last_sync,
            dirty: false,
        };

        write_sync_meta_v2(&skill_dir, &original).expect("write v2");

        // Sidecar JSON is on disk with version: 2.
        let on_disk = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap();
        assert!(on_disk.contains("\"version\": 2"), "JSON: {on_disk}");

        // Read back via the v2 reader (no v1 sidecar → not a backfill).
        let skill = skill_with_agents("foo", vec![AgentId::Anthropic, AgentId::Codex]);
        let (round, legacy) = read_sync_meta_v2(
            &skill_dir,
            &skill,
            SkillScope::Project,
            Some("C:/proj"),
        );
        assert_eq!(round.version, 2);
        assert_eq!(round.targets.len(), 2);
        assert_eq!(round.last_sync.len(), 2);
        assert_eq!(
            round.last_sync.get("anthropic:project:C:/proj").map(|e| e.pushed_hash.as_str()),
            Some("abc123"),
        );
        assert_eq!(round.dirty, false);
        assert!(legacy.is_none(), "native v2 read MUST NOT report a legacy last_synced");
    }

    #[test]
    fn legacy_v1_sidecar_backfilled_at_read_time() {
        let tmp = tempdir();
        let skill_dir = tmp.join("legacy");
        fs::create_dir_all(&skill_dir).unwrap();

        // Pre-existing v1 sidecar: no `version`, no `targets`, dirty=false,
        // last_synced from a prior push.
        fs::write(
            skill_dir.join(SYNC_META_FILENAME),
            r#"{"dirty":false,"last_synced":"2026-05-22T01:00:00Z"}"#,
        )
        .unwrap();

        let skill = skill_with_agents("legacy", vec![AgentId::Anthropic, AgentId::Codex]);
        let (meta, legacy) = read_sync_meta_v2(
            &skill_dir,
            &skill,
            SkillScope::Project,
            Some("C:/proj-root"),
        );

        assert_eq!(meta.version, 2);
        assert_eq!(meta.dirty, false, "v1 dirty preserved");
        assert_eq!(
            legacy.as_deref(),
            Some("2026-05-22T01:00:00Z"),
            "v1 last_synced surfaced for caller (CanonicalSkill.last_synced display)",
        );

        // Backfilled targets: one per agent × scope/project, tracked + enabled.
        assert_eq!(meta.targets.len(), 2, "two backfilled targets");
        let agents: Vec<AgentId> = meta.targets.iter().map(|t| t.agent).collect();
        assert!(agents.contains(&AgentId::Anthropic));
        assert!(agents.contains(&AgentId::Codex));
        for t in &meta.targets {
            assert_eq!(t.scope, SkillScope::Project);
            assert_eq!(t.project.as_deref(), Some("C:/proj-root"));
            assert!(t.enabled);
            assert!(matches!(t.mode, TargetMode::Tracked));
        }

        // last_sync is empty on backfill (no real per-target push history).
        assert!(meta.last_sync.is_empty());
    }

    #[test]
    fn mark_dirty_preserves_v2_targets() {
        let tmp = tempdir();
        let skill_dir = tmp.join("preserve");
        fs::create_dir_all(&skill_dir).unwrap();

        let mut last_sync = std::collections::BTreeMap::new();
        last_sync.insert(
            "gemini:global".to_string(),
            LastSyncEntry {
                pushed_hash: "preserved-hash".into(),
                base_snapshot: None,
                at: "2026-05-22T06:00:00Z".into(),
            },
        );

        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: AgentId::Gemini,
                    scope: SkillScope::Global,
                    project: None,
                    enabled: true,
                    mode: TargetMode::Tracked,
                }],
                last_sync,
                dirty: false,
            },
        )
        .unwrap();

        // Flip dirty via the existing helper.
        mark_sync_meta_dirty(&skill_dir);

        // Read back: dirty=true, but targets and last_sync survive.
        let skill = skill_with_agents("preserve", vec![AgentId::Gemini]);
        let (meta, _legacy) = read_sync_meta_v2(
            &skill_dir,
            &skill,
            SkillScope::Global,
            None,
        );
        assert!(meta.dirty, "mark_sync_meta_dirty must flip dirty=true");
        assert_eq!(meta.targets.len(), 1, "targets must survive mark_dirty");
        assert_eq!(meta.targets[0].agent, AgentId::Gemini);
        assert_eq!(
            meta.last_sync.get("gemini:global").map(|e| e.pushed_hash.as_str()),
            Some("preserved-hash"),
            "last_sync must survive mark_dirty",
        );
    }

    /// Regression for the agents/targets drift bug: when a user adds an
    /// agent in SkillEditor and saves, the sidecar's `targets` must
    /// regenerate to match the new `agents` list (preserving any existing
    /// `last_sync` entries for unchanged targets). Without this, fan-out
    /// continues pushing only the old target set and the newly-checked
    /// agent silently never gets a SKILL.md.
    #[test]
    fn write_aligns_v2_targets_when_agents_change() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();

        // First write with agents=[anthropic].
        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "aligned".into());
        fm.insert("description".into(), "x".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );
        canonical_skills_write(
            SkillScope::Project,
            Some(project.clone()),
            "aligned".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Simulate a successful push: rewrite sidecar with v2 + lastSync.
        let skill_dir = tmp.join(".felina").join("skills").join("aligned");
        let mut last_sync = BTreeMap::new();
        last_sync.insert(
            format!("anthropic:project:{project}"),
            LastSyncEntry {
                pushed_hash: "hash-anthropic".into(),
                base_snapshot: None,
                at: "2026-05-22T01:00:00Z".into(),
            },
        );
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: AgentId::Anthropic,
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Tracked,
                }],
                last_sync,
                dirty: false,
            },
        )
        .unwrap();

        // Second write: user ticks codex in SkillEditor.
        let mut fm2 = serde_yaml::Mapping::new();
        fm2.insert("name".into(), "aligned".into());
        fm2.insert("description".into(), "x".into());
        fm2.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "codex".into()]),
        );
        canonical_skills_write(
            SkillScope::Project,
            Some(project.clone()),
            "aligned".into(),
            serde_yaml::Value::Mapping(fm2),
            "edited".into(),
        )
        .unwrap();

        let raw = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap();
        let meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap();
        assert_eq!(meta.version, 2);
        assert_eq!(
            meta.targets.len(),
            2,
            "targets must regenerate to match new agents list, got: {:?}",
            meta.targets,
        );
        let in_targets: Vec<AgentId> = meta.targets.iter().map(|t| t.agent).collect();
        assert!(in_targets.contains(&AgentId::Anthropic));
        assert!(in_targets.contains(&AgentId::Codex));

        let anthropic_key = format!("anthropic:project:{project}");
        assert!(
            meta.last_sync.contains_key(&anthropic_key),
            "lastSync entry for the unchanged anthropic target must be preserved",
        );

        assert!(meta.dirty, "edited canonical must be dirty=true");
    }

    /// Smoke regression (task 8.4 / handoff UI #3a): a freshly-written
    /// canonical surfaces as `dirty=true` in the list and read paths, so
    /// the per-skill Push button shows "Push" not "Re-push". On overwrite
    /// of an already-synced skill, `last_synced` is preserved while
    /// `dirty` flips back to true.
    #[test]
    fn write_marks_canonical_dirty_in_sync_meta() {
        let tmp = tempdir();
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String("fresh".into()),
        );
        fm.insert(
            serde_yaml::Value::String("description".into()),
            serde_yaml::Value::String("a fresh skill".into()),
        );
        fm.insert(
            serde_yaml::Value::String("agents".into()),
            serde_yaml::Value::Sequence(vec![serde_yaml::Value::String("anthropic".into())]),
        );

        // First write: new skill, no prior sync-meta.
        canonical_skills_write(
            SkillScope::Project,
            Some(project.clone()),
            "fresh".into(),
            serde_yaml::Value::Mapping(fm.clone()),
            "body v1".into(),
        )
        .expect("first write");

        let skill = canonical_skills_read(
            SkillScope::Project,
            Some(project.clone()),
            "fresh".into(),
        )
        .expect("read v1");
        assert!(skill.dirty, "fresh canonical must be dirty=true");
        assert!(skill.last_synced.is_none(), "fresh canonical has no last_synced");

        // Simulate a prior successful push by overwriting sync-meta with
        // dirty=false + a recorded timestamp.
        let skill_dir = tmp.join(".felina").join("skills").join("fresh");
        let prior_timestamp = "2026-05-22T01:23:45Z";
        fs::write(
            skill_dir.join(".felina-sync-meta.json"),
            format!("{{\"dirty\":false,\"last_synced\":\"{prior_timestamp}\"}}"),
        )
        .unwrap();

        // Second write: simulate editing canonical. dirty flips back to true;
        // last_synced is preserved (so the UI can still say "last pushed at …").
        canonical_skills_write(
            SkillScope::Project,
            Some(project.clone()),
            "fresh".into(),
            serde_yaml::Value::Mapping(fm),
            "body v2 edited".into(),
        )
        .expect("second write");

        let after = canonical_skills_read(
            SkillScope::Project,
            Some(project),
            "fresh".into(),
        )
        .expect("read v2");
        assert!(after.dirty, "edited canonical must be dirty=true");
        assert_eq!(
            after.last_synced.as_deref(),
            Some(prior_timestamp),
            "last_synced must survive the rewrite"
        );
    }
}
