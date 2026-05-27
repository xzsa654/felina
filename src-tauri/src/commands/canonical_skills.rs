//! Canonical skill main-file storage layer.
//!
//! `~/.felina/skills/<name>/SKILL.md` is the single source of truth for skills
//! the user edits. (Project-scoped canonical storage was removed by
//! `scope-model-simplification`; see that change for the migration command
//! that moves legacy `<project>/.felina/skills/` masters into global.)
//! Agent-native skill dirs (`.claude/skills`, `.agents/skills`,
//! `.gemini/skills`) are fan-out *outputs* — see `commands::fan_out`.
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

/// Push-destination discriminator for `SkillTarget`.
///
/// **Only valid as `SkillTarget.scope`.** Canonical master files live
/// exclusively under `~/.felina/skills/` after `scope-model-simplification`;
/// the enum no longer participates in canonical-storage routing. `Project`
/// here means "fan-out push goes to a particular project's agent directory".
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
    /// Stable canonical directory identity used for app actions.
    #[serde(default)]
    pub canonical_id: String,
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

/// Canonical skills directory. After `scope-model-simplification` this is
/// always `~/.felina/skills/`; project-scoped canonical storage was removed.
pub fn canonical_skills_dir() -> PathBuf {
    paths::felina_global_skills_dir()
}

/// Split a SKILL.md text into `(frontmatter_yaml, body)`.
///
/// Recognised shapes:
/// - `---\n<yaml>\n---\n<body>` — standard YAML frontmatter
/// - `---\r\n<yaml>\r\n---\r\n<body>` — CRLF (Windows)
/// - text with no leading `---` — entire content treated as body
pub(crate) fn split_frontmatter(raw: &str) -> (String, String) {
    // Tolerate optional BOM + leading whitespace before the opening fence.
    let trimmed = raw.trim_start_matches('\u{feff}');
    let trimmed = trimmed.trim_start_matches(['\n', '\r']);

    let Some(rest) = trimmed.strip_prefix("---") else {
        return (String::new(), raw.to_string());
    };
    // Opening `---` must be its own line.
    let rest = match rest
        .strip_prefix("\r\n")
        .or_else(|| rest.strip_prefix('\n'))
    {
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
        canonical_id: String::new(),
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

fn take_required_string(map: &mut serde_yaml::Mapping, key: &str) -> Result<String, String> {
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
        canonical_id: String,
        skill: CanonicalSkill,
    },
    Broken {
        canonical_id: String,
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
/// `agents` frontmatter field (one tracked enabled global target per agent).
/// Used both for v1 backfill and for the "no sidecar yet" case. Canonical is
/// always global after `scope-model-simplification`, so targets default to
/// `scope=Global, project=None`; the user can add project targets via the
/// target editor.
fn backfill_from_skill(skill: &CanonicalSkill, dirty: bool) -> SyncMetaV2 {
    let targets = skill
        .agents
        .iter()
        .map(|&agent| SkillTarget {
            agent,
            scope: SkillScope::Global,
            project: None,
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
) -> (SyncMetaV2, Option<String>) {
    let path = skill_dir.join(SYNC_META_FILENAME);
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        // No sidecar yet → treat as a fresh skill that has never been pushed.
        Err(_) => return (backfill_from_skill(skill, false), None),
    };

    // Probe the JSON: native v2 is identified by `version: 2`. Anything
    // missing `version` / `targets` is v1 (or corrupt — same fallback).
    let probe: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return (backfill_from_skill(skill, false), None),
    };

    if probe.get("version").and_then(|v| v.as_u64()) == Some(2) && probe.get("targets").is_some() {
        if let Ok(meta) = serde_json::from_str::<SyncMetaV2>(&raw) {
            return (meta, None);
        }
        // v2 markers present but parse failed → fall through to v1/backfill
        // rather than panicking the UI list.
    }

    // v1 sidecar: backfill targets, preserve dirty + last_synced.
    let v1: SyncMetaV1 = serde_json::from_str(&raw).unwrap_or_default();
    let meta = backfill_from_skill(skill, v1.dirty);
    (meta, v1.last_synced)
}

/// Read the on-disk v2 sidecar WITHOUT backfilling from the skill's `agents`
/// field. Returns `SyncMetaV2::default()` (empty targets) when the sidecar is
/// absent, legacy v1, or corrupt.
///
/// Use this (not `read_sync_meta_v2`) when composing a target list explicitly
/// — import / future scope moves — so a freshly written skill does NOT inherit
/// a synthetic global target per `agents` entry (which would otherwise appear
/// alongside the intended target, e.g. "global + projectA" after importing
/// projectA's copy).
pub(crate) fn read_sync_meta_v2_no_backfill(skill_dir: &Path) -> SyncMetaV2 {
    let path = skill_dir.join(SYNC_META_FILENAME);
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str::<SyncMetaV2>(&raw).unwrap_or_default(),
        Err(_) => SyncMetaV2::default(),
    }
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
            let meta = SyncMetaV2::default();
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
        let has_pushable = meta
            .targets
            .iter()
            .any(|t| t.enabled && !matches!(t.mode, TargetMode::Detached | TargetMode::Forked));
        meta.dirty = has_pushable;
        let _ = write_sync_meta_v2(skill_dir, &meta);
    } else {
        // v1 or corrupt — preserve v1 shape (last_synced lives on) and
        // just flip dirty=true. Full v2 upgrade happens at the next push.
        let v1: SyncMetaV1 = serde_json::from_str(&raw).unwrap_or_default();
        let updated = SyncMetaV1 {
            dirty: true,
            last_synced: v1.last_synced,
        };
        if let Ok(json) = serde_json::to_string_pretty(&updated) {
            let _ = fs::write(&path, json);
        }
    }
}

/// Pick the most-recent `at` timestamp across a per-target last_sync map,
/// for surfacing a single `CanonicalSkill.last_synced` value to the UI.
/// ISO-8601 UTC strings (`...Z`) compare lexicographically as time order.
fn pick_latest_at(last_sync: &BTreeMap<String, LastSyncEntry>) -> Option<String> {
    last_sync.values().map(|e| e.at.clone()).max()
}

/// List canonical skills in the single global canonical dir
/// (`~/.felina/skills/`). A missing canonical directory returns an empty Vec
/// — never an error. Broken skills (parse failures) are returned as
/// `SkillListEntry::Broken`.
#[tauri::command]
pub fn canonical_skills_list() -> Result<Vec<SkillListEntry>, String> {
    let dir = canonical_skills_dir();
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let entries =
        fs::read_dir(&dir).map_err(|e| format!("failed to read canonical skills dir: {e}"))?;

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
                    canonical_id: dir_name.clone(),
                    name: dir_name,
                    path: skill_md.to_string_lossy().to_string(),
                    error: format!("read failed: {e}"),
                });
                continue;
            }
        };

        match parse_skill_md(&raw) {
            Ok(mut skill) => {
                skill.canonical_id = dir_name.clone();
                let (meta, legacy_last) = read_sync_meta_v2(&skill_dir, &skill);
                skill.dirty = meta.dirty;
                skill.last_synced = legacy_last.or_else(|| pick_latest_at(&meta.last_sync));
                skill.targets = meta.targets;
                skill.last_sync = meta.last_sync;
                out.push(SkillListEntry::Ok {
                    canonical_id: dir_name,
                    skill,
                });
            }
            Err(e) => {
                out.push(SkillListEntry::Broken {
                    canonical_id: dir_name.clone(),
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
        SkillListEntry::Ok { skill, .. } => &skill.name,
        SkillListEntry::Broken { name, .. } => name,
    }
}

/// Read one canonical skill by its directory name. Returns Err when the
/// SKILL.md is missing or its frontmatter can't be parsed — matches the
/// spec's "Frontmatter fails to parse" scenario.
#[tauri::command]
pub fn canonical_skills_read(name: String) -> Result<CanonicalSkill, String> {
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&name);
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("skill not found: {name}"));
    }
    let raw = fs::read_to_string(&skill_md).map_err(|e| format!("failed to read SKILL.md: {e}"))?;
    let mut skill = parse_skill_md(&raw)?;
    skill.canonical_id = name.clone();
    let (meta, legacy_last) = read_sync_meta_v2(&skill_dir, &skill);
    skill.dirty = meta.dirty;
    skill.last_synced = legacy_last.or_else(|| pick_latest_at(&meta.last_sync));
    skill.targets = meta.targets;
    skill.last_sync = meta.last_sync;
    Ok(skill)
}

/// Read the raw `SKILL.md` text of a canonical skill by name, regardless of
/// whether its frontmatter parses. Used by the editor's raw repair mode to
/// open a `Broken` skill — `canonical_skills_read` cannot be reused because it
/// errors on parse failure. Errors only when the file is missing or unreadable.
#[tauri::command]
pub fn canonical_skills_read_raw(name: String) -> Result<String, String> {
    validate_skill_name(&name)?;
    let skill_md = canonical_skills_dir().join(&name).join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("skill not found: {name}"));
    }
    fs::read_to_string(&skill_md).map_err(|e| format!("failed to read SKILL.md: {e}"))
}

/// Result of a raw `SKILL.md` write. Carries normalization info so the
/// frontend can show an advisory when the YAML `name` was corrected.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteRawResult {
    /// Set when the YAML `name` was normalized to the canonical directory
    /// identity. Contains the original (pre-normalization) parsed `name`.
    pub normalized_from: Option<String>,
}

/// Write raw `SKILL.md` text for a canonical skill by name (editor raw-mode
/// save). After writing, if the content parses and its frontmatter `name`
/// differs from the canonical directory identity, the `name` is rewritten to
/// match the directory. Returns normalization info so the UI can show an
/// advisory. Marks the skill dirty so a now-valid skill becomes pushable.
#[tauri::command]
pub fn canonical_skills_write_raw(name: String, content: String) -> Result<WriteRawResult, String> {
    validate_skill_name(&name)?;
    let skill_dir = canonical_skills_dir().join(&name);
    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("failed to create canonical skill dir: {e}"))?;
    let skill_md = skill_dir.join("SKILL.md");
    fs::write(&skill_md, &content).map_err(|e| format!("failed to write SKILL.md: {e}"))?;

    let mut normalized_from: Option<String> = None;
    if let Ok(skill) = parse_skill_md(&content) {
        if skill.name != name {
            normalized_from = Some(skill.name);
            let (fm_text, body) = split_frontmatter(&content);
            if !fm_text.is_empty() {
                if let Ok(mut value) = serde_yaml::from_str::<serde_yaml::Value>(&fm_text) {
                    if let Some(map) = value.as_mapping_mut() {
                        map.insert(
                            serde_yaml::Value::String("name".into()),
                            serde_yaml::Value::String(name.clone()),
                        );
                        if let Ok(fm_yaml) = serde_yaml::to_string(&value) {
                            let fm_trimmed = fm_yaml.trim_end_matches('\n');
                            let body_normalized = if body.ends_with('\n') || body.is_empty() {
                                body
                            } else {
                                format!("{body}\n")
                            };
                            let out = format!("---\n{fm_trimmed}\n---\n{body_normalized}");
                            let _ = fs::write(&skill_md, out);
                        }
                    }
                }
            }
        }
    }

    mark_sync_meta_dirty(&skill_dir);
    Ok(WriteRawResult { normalized_from })
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
/// The `name` parameter is the canonical directory identity. If the
/// frontmatter mapping's `name` field differs, it is silently normalized
/// to match the directory — the directory identity is authoritative after
/// creation.
#[tauri::command]
pub fn canonical_skills_write(
    name: String,
    frontmatter: serde_yaml::Value,
    body: String,
) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&name);
    fs::create_dir_all(&skill_dir)
        .map_err(|e| format!("failed to create canonical skill dir: {e}"))?;

    let mut fm = frontmatter;
    if let serde_yaml::Value::Mapping(ref mut map) = fm {
        map.insert(
            serde_yaml::Value::String("name".into()),
            serde_yaml::Value::String(name.clone()),
        );
    }

    let fm_yaml =
        serde_yaml::to_string(&fm).map_err(|e| format!("failed to serialize frontmatter: {e}"))?;
    let fm_trimmed = fm_yaml.trim_end_matches('\n');
    let body_normalized = if body.ends_with('\n') {
        body
    } else {
        format!("{body}\n")
    };
    let out = format!("---\n{fm_trimmed}\n---\n{body_normalized}");
    fs::write(skill_dir.join("SKILL.md"), out)
        .map_err(|e| format!("failed to write SKILL.md: {e}"))?;
    mark_sync_meta_dirty(&skill_dir);
    Ok(())
}

/// Overwrite a skill's target list in its sync-meta sidecar. Prunes
/// `last_sync` entries whose key no longer matches any target in the new
/// list; preserves entries for targets that remain. Flips `dirty=true`.
#[tauri::command]
pub fn skill_targets_set(skill_name: String, targets: Vec<SkillTarget>) -> Result<(), String> {
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&skill_name);
    if !skill_dir.is_dir() {
        return Err(format!("skill not found: {skill_name}"));
    }
    let valid_keys: std::collections::HashSet<String> = targets.iter().map(target_key).collect();
    let path = skill_dir.join(SYNC_META_FILENAME);
    let mut meta = match fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<SyncMetaV2>(&raw).ok())
    {
        Some(m) => m,
        None => SyncMetaV2::default(),
    };
    meta.last_sync.retain(|k, _| valid_keys.contains(k));
    meta.targets = targets;
    meta.dirty = meta
        .targets
        .iter()
        .any(|t| t.enabled && !matches!(t.mode, TargetMode::Detached | TargetMode::Forked));
    write_sync_meta_v2(&skill_dir, &meta)
}

#[tauri::command]
pub fn skill_target_remove_with_policy(
    skill_name: String,
    target: SkillTarget,
    policy: TargetRemovalPolicy,
) -> Result<SkillTargetRemovalResult, String> {
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&skill_name);
    if !skill_dir.is_dir() {
        return Err(format!("skill not found: {skill_name}"));
    }
    let key = target_key(&target);
    if matches!(policy, TargetRemovalPolicy::Cancel) {
        return Ok(SkillTargetRemovalResult {
            policy,
            target_key: key,
            target_removed: false,
            delete_result: None,
        });
    }

    let mut meta = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME))
        .ok()
        .and_then(|raw| serde_json::from_str::<SyncMetaV2>(&raw).ok())
        .unwrap_or_default();
    let Some(existing_target) = meta
        .targets
        .iter()
        .find(|existing| target_key(existing) == key)
        .cloned()
    else {
        return Err("target not found".into());
    };

    let delete_result = if matches!(policy, TargetRemovalPolicy::RemoveTargetAndDeleteFile) {
        let delete_result =
            resolve_target_skill_dir(&skill_name, &existing_target).map(delete_skill_dir_result)?;
        if !delete_result.success {
            return Ok(SkillTargetRemovalResult {
                policy,
                target_key: key,
                target_removed: false,
                delete_result: Some(delete_result),
            });
        }
        Some(delete_result)
    } else {
        None
    };

    meta.targets.retain(|existing| target_key(existing) != key);
    meta.last_sync.remove(&key);
    meta.dirty = meta
        .targets
        .iter()
        .any(|t| t.enabled && matches!(t.mode, TargetMode::Tracked));
    write_sync_meta_v2(&skill_dir, &meta)?;

    Ok(SkillTargetRemovalResult {
        policy,
        target_key: key,
        target_removed: true,
        delete_result,
    })
}

#[tauri::command]
pub fn skill_target_repoint(
    skill_name: String,
    target: SkillTarget,
    new_project: String,
) -> Result<SkillTargetRepointResult, String> {
    if !matches!(target.scope, SkillScope::Project) {
        return Err("only project-scoped targets can be repointed".into());
    }
    let normalized_project = super::known_projects::normalize_path(&new_project);
    if normalized_project.is_empty() {
        return Err("new project path must not be empty".into());
    }

    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&skill_name);
    if !skill_dir.is_dir() {
        return Err(format!("skill not found: {skill_name}"));
    }

    let old_key = target_key(&target);
    let mut meta = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME))
        .ok()
        .and_then(|raw| serde_json::from_str::<SyncMetaV2>(&raw).ok())
        .unwrap_or_default();
    let Some(index) = meta
        .targets
        .iter()
        .position(|existing| target_key(existing) == old_key)
    else {
        return Err("target not found".into());
    };

    let mut updated = meta.targets[index].clone();
    updated.project = Some(normalized_project);
    let new_key = target_key(&updated);
    meta.targets[index] = updated.clone();
    meta.last_sync.remove(&old_key);
    meta.last_sync.remove(&new_key);
    meta.dirty = true;
    write_sync_meta_v2(&skill_dir, &meta)?;

    Ok(SkillTargetRepointResult {
        old_target_key: old_key,
        new_target_key: new_key,
        target: updated,
        dirty: true,
    })
}

#[tauri::command]
pub fn skill_target_read_content(skill_name: String, target_key: String) -> Result<String, String> {
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&skill_name);
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("skill not found: {skill_name}"));
    }
    let raw = fs::read_to_string(&skill_md).map_err(|e| format!("failed to read SKILL.md: {e}"))?;
    let skill = parse_skill_md(&raw)?;
    let (meta, _) = read_sync_meta_v2(&skill_dir, &skill);
    let target = meta
        .targets
        .iter()
        .find(|target| crate::commands::canonical_skills::target_key(target) == target_key)
        .ok_or_else(|| "target not found".to_string())?;
    let target_skill_dir = resolve_target_skill_dir(&skill_name, target)?;
    let target_skill_md = target_skill_dir.join("SKILL.md");
    if !target_skill_md.is_file() {
        return Err(format!(
            "agent-side SKILL.md does not exist or path cannot be resolved: {}",
            target_skill_md.display()
        ));
    }
    fs::read_to_string(&target_skill_md)
        .map_err(|e| format!("failed to read agent-side SKILL.md: {e}"))
}

fn resolve_target_skill_dir(skill_name: &str, target: &SkillTarget) -> Result<PathBuf, String> {
    let cfg = super::agent_paths::agent_paths_get()?;
    let pair = match target.agent {
        AgentId::Anthropic => &cfg.anthropic,
        AgentId::Codex => &cfg.codex,
        AgentId::Gemini => &cfg.gemini,
    };
    super::fan_out::resolve_pair(target.scope, target.project.as_deref(), pair)
        .map(|root| root.join(skill_name))
}

/// An agent-side file that exists on disk but has no corresponding enabled +
/// tracked target in the skill's sync-meta target list.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrphanFile {
    pub path: String,
    pub agent: AgentId,
    pub scope: SkillScope,
    /// Originating project path when `scope == Project`. None for global.
    /// Needed so apply can prune the correct per-target `last_sync` entry.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CanonicalDeletePolicy {
    Cascade,
    Detach,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletePathResult {
    pub path: String,
    pub success: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalSkillDeleteResult {
    pub policy: CanonicalDeletePolicy,
    pub canonical_path: String,
    pub canonical_deleted: bool,
    pub target_results: Vec<DeletePathResult>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TargetRemovalPolicy {
    RemoveTargetOnly,
    RemoveTargetAndDeleteFile,
    Cancel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTargetRemovalResult {
    pub policy: TargetRemovalPolicy,
    pub target_key: String,
    pub target_removed: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub delete_result: Option<DeletePathResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillTargetRepointResult {
    pub old_target_key: String,
    pub new_target_key: String,
    pub target: SkillTarget,
    pub dirty: bool,
}

/// Scan agent directories for orphaned SKILL.md files belonging to this skill.
/// A file is orphaned when the corresponding target is absent from the target
/// list, or its mode is Detached / Forked. Disabled tracked targets still
/// represent known agent-side files and are not orphaned.
///
/// The scope/project pairs scanned are derived from `meta.targets` themselves
/// (plus the always-checked global) — no caller-supplied `project_path` is
/// needed. A target's project path (when scope=Project) is what tells us
/// which project's agent dir to look in.
#[tauri::command]
pub fn skill_prune_orphans_scan(skill_name: String) -> Result<Vec<OrphanFile>, String> {
    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&skill_name);
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Err(format!("skill not found: {skill_name}"));
    }
    let raw = fs::read_to_string(&skill_md).map_err(|e| format!("failed to read SKILL.md: {e}"))?;
    let skill = parse_skill_md(&raw)?;

    let (meta, _) = read_sync_meta_v2(&skill_dir, &skill);
    let cfg = super::agent_paths::agent_paths_get()?;

    let agents = [AgentId::Anthropic, AgentId::Codex, AgentId::Gemini];

    // Always check global; additionally check every project path referenced
    // by any of the skill's targets (regardless of agent / enabled / mode —
    // a once-pushed project still has on-disk files to potentially orphan).
    let mut scopes_to_check: Vec<(SkillScope, Option<String>)> = vec![(SkillScope::Global, None)];
    let mut seen_projects: std::collections::HashSet<String> = std::collections::HashSet::new();
    for t in &meta.targets {
        if let (SkillScope::Project, Some(pp)) = (t.scope, t.project.as_deref()) {
            let key = pp.replace('\\', "/").to_lowercase();
            if seen_projects.insert(key) {
                scopes_to_check.push((SkillScope::Project, Some(pp.to_string())));
            }
        }
    }

    let mut orphans = Vec::new();

    for &agent in &agents {
        let pair = match agent {
            AgentId::Anthropic => &cfg.anthropic,
            AgentId::Codex => &cfg.codex,
            AgentId::Gemini => &cfg.gemini,
        };
        for (check_scope, check_project) in &scopes_to_check {
            let target_dir =
                match super::fan_out::resolve_pair(*check_scope, check_project.as_deref(), pair) {
                    Ok(d) => d,
                    Err(_) => continue,
                };
            let agent_skill_md = target_dir.join(&skill_name).join("SKILL.md");
            if !agent_skill_md.is_file() {
                continue;
            }
            let is_active = meta.targets.iter().any(|t| {
                t.agent == agent
                    && t.scope == *check_scope
                    && matches!(t.mode, TargetMode::Tracked)
                    && match check_scope {
                        SkillScope::Global => true,
                        SkillScope::Project => {
                            let tp = t.project.as_deref().unwrap_or("");
                            let cp = check_project.as_deref().unwrap_or("");
                            tp.replace('\\', "/").to_lowercase()
                                == cp.replace('\\', "/").to_lowercase()
                        }
                    }
            });
            if !is_active {
                orphans.push(OrphanFile {
                    path: target_dir.join(&skill_name).to_string_lossy().to_string(),
                    agent,
                    scope: *check_scope,
                    project: check_project.clone(),
                });
            }
        }
    }

    Ok(orphans)
}

/// Delete confirmed orphan skill directories. Each path is expected to be a
/// skill sub-directory inside an agent-native skill root (e.g.
/// `.claude/skills/<skill-name>`). Errors on individual paths are isolated —
/// a failure to delete one entry does not abort the rest.
#[tauri::command]
pub fn skill_prune_orphans_apply(
    skill_name: String,
    orphans: Vec<OrphanFile>,
) -> Result<(), String> {
    let canonical_dir = canonical_skills_dir();
    let skill_dir = canonical_dir.join(&skill_name);
    if !skill_dir.is_dir() {
        return Err(format!("skill not found: {skill_name}"));
    }

    let mut errors = Vec::new();
    let mut pruned_keys = Vec::new();
    for orphan in &orphans {
        let target = Path::new(&orphan.path);
        if target.exists() {
            if let Err(e) = fs::remove_dir_all(target) {
                errors.push(format!("{}: {e}", orphan.path));
                continue;
            }
        }
        let key = target_key(&SkillTarget {
            agent: orphan.agent,
            scope: orphan.scope,
            project: orphan.project.clone(),
            enabled: false,
            mode: TargetMode::Tracked,
        });
        pruned_keys.push(key);
    }

    if !pruned_keys.is_empty() {
        let meta_path = skill_dir.join(SYNC_META_FILENAME);
        if let Ok(raw) = fs::read_to_string(&meta_path) {
            if let Ok(mut meta) = serde_json::from_str::<SyncMetaV2>(&raw) {
                meta.last_sync.retain(|k, _| !pruned_keys.contains(k));
                let _ = write_sync_meta_v2(&skill_dir, &meta);
            }
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!(
            "some orphans could not be deleted: {}",
            errors.join("; ")
        ))
    }
}

/// Delete a canonical skill directory and everything inside it.
#[tauri::command]
pub fn canonical_skills_delete(name: String) -> Result<(), String> {
    validate_skill_name(&name)?;
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&name);
    if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)
            .map_err(|e| format!("failed to delete canonical skill dir: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn canonical_skills_delete_with_policy(
    name: String,
    policy: CanonicalDeletePolicy,
) -> Result<CanonicalSkillDeleteResult, String> {
    validate_skill_name(&name)?;
    let dir = canonical_skills_dir();
    let skill_dir = dir.join(&name);
    let canonical_path = skill_dir.to_string_lossy().to_string();

    if matches!(policy, CanonicalDeletePolicy::Cancel) {
        return Ok(CanonicalSkillDeleteResult {
            policy,
            canonical_path,
            canonical_deleted: false,
            target_results: Vec::new(),
        });
    }

    let target_results = if matches!(policy, CanonicalDeletePolicy::Cascade) {
        resolve_current_target_skill_dirs(&skill_dir, &name)?
            .into_iter()
            .map(delete_skill_dir_result)
            .collect()
    } else {
        Vec::new()
    };

    let canonical_deleted = if skill_dir.exists() {
        fs::remove_dir_all(&skill_dir)
            .map_err(|e| format!("failed to delete canonical skill dir: {e}"))?;
        true
    } else {
        false
    };

    Ok(CanonicalSkillDeleteResult {
        policy,
        canonical_path,
        canonical_deleted,
        target_results,
    })
}

fn resolve_current_target_skill_dirs(
    skill_dir: &Path,
    skill_name: &str,
) -> Result<Vec<PathBuf>, String> {
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(&skill_md)
        .map_err(|e| format!("failed to read canonical SKILL.md: {e}"))?;
    let mut skill = parse_skill_md(&raw)?;
    skill.name = skill_name.to_string();
    skill.canonical_id = skill_name.to_string();
    let (meta, _legacy) = read_sync_meta_v2(skill_dir, &skill);
    let cfg = super::agent_paths::agent_paths_get()?;
    let mut dirs = Vec::new();
    for target in meta.targets {
        if !target.enabled || target.mode != TargetMode::Tracked {
            continue;
        }
        let pair = match target.agent {
            AgentId::Anthropic => &cfg.anthropic,
            AgentId::Codex => &cfg.codex,
            AgentId::Gemini => &cfg.gemini,
        };
        if let Ok(root) =
            super::fan_out::resolve_pair(target.scope, target.project.as_deref(), pair)
        {
            dirs.push(root.join(skill_name));
        }
    }
    dirs.sort();
    dirs.dedup();
    Ok(dirs)
}

fn delete_skill_dir_result(path: PathBuf) -> DeletePathResult {
    let path_string = path.to_string_lossy().to_string();
    if !path.exists() {
        return DeletePathResult {
            path: path_string,
            success: true,
            error: None,
        };
    }
    match fs::remove_dir_all(&path) {
        Ok(()) => DeletePathResult {
            path: path_string,
            success: true,
            error: None,
        },
        Err(e) => DeletePathResult {
            path: path_string,
            success: false,
            error: Some(e.to_string()),
        },
    }
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

    /// RAII guard: redirects `felina_home()` to `<tmp>/.felina` for the
    /// current test thread, restoring the real `dirs::home_dir()` path on
    /// drop. Use at the top of every test that exercises the canonical
    /// storage layer so the on-disk side-effects land in the tempdir.
    struct FelinaHomeGuard;
    impl Drop for FelinaHomeGuard {
        fn drop(&mut self) {
            crate::paths::set_felina_home_override_for_test(None);
        }
    }
    fn override_felina_home(tmp: &Path) -> FelinaHomeGuard {
        crate::paths::set_felina_home_override_for_test(Some(tmp.join(".felina")));
        FelinaHomeGuard
    }

    #[test]
    fn list_returns_empty_for_missing_dir() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let entries = canonical_skills_list().unwrap();
        assert!(entries.is_empty());
    }

    #[test]
    fn list_distinguishes_ok_and_broken() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
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

        let entries = canonical_skills_list().unwrap();
        assert_eq!(entries.len(), 3, "expected 3 entries, got {entries:#?}");

        // Sorted alphabetically by name. alpha + beta = Ok, broken = Broken.
        match &entries[0] {
            SkillListEntry::Ok {
                canonical_id,
                skill,
            } => {
                assert_eq!(canonical_id, "alpha");
                assert_eq!(skill.canonical_id, "alpha");
                assert_eq!(skill.name, "alpha");
            }
            other => panic!("expected Ok(alpha), got {other:?}"),
        }
        match &entries[1] {
            SkillListEntry::Ok {
                canonical_id,
                skill,
            } => {
                assert_eq!(canonical_id, "beta");
                assert_eq!(skill.canonical_id, "beta");
                assert_eq!(skill.name, "beta");
            }
            other => panic!("expected Ok(beta), got {other:?}"),
        }
        match &entries[2] {
            SkillListEntry::Broken {
                canonical_id,
                name,
                error,
                ..
            } => {
                assert_eq!(canonical_id, "broken");
                assert_eq!(name, "broken");
                assert!(!error.is_empty());
            }
            other => panic!("expected Broken(broken), got {other:?}"),
        }
    }

    #[test]
    fn read_returns_err_for_broken_frontmatter() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "bad",
            "---\nname: bad\nagents: [anthropic]\n---\nbody\n", // missing description
        );

        let err = canonical_skills_read("bad".into()).unwrap_err();
        assert!(err.contains("description"), "err was: {err}");
    }

    #[test]
    fn write_creates_dir_and_round_trips_through_read() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

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
            "foo".into(),
            serde_yaml::Value::Mapping(fm),
            "Foo body".into(),
        )
        .expect("write");

        // Directory should be created automatically.
        assert!(tmp
            .join(".felina")
            .join("skills")
            .join("foo")
            .join("SKILL.md")
            .is_file());

        let skill = canonical_skills_read("foo".into()).expect("read back");
        assert_eq!(skill.canonical_id, "foo");
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
        let _g = override_felina_home(&tmp);
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
            let err =
                canonical_skills_write(bad.into(), empty_fm.clone(), String::new()).unwrap_err();
            assert!(
                err.contains("skill name") || err.contains("disallowed"),
                "bad={bad:?} err={err}"
            );
        }
    }

    #[test]
    fn delete_removes_skill_dir() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "doomed",
            "---\nname: doomed\ndescription: x\nagents: [anthropic]\n---\nbody\n",
        );
        assert!(skills_root.join("doomed").is_dir());

        canonical_skills_delete("doomed".into()).expect("delete");
        assert!(!skills_root.join("doomed").exists());
    }

    #[test]
    fn delete_uses_canonical_directory_identity_even_when_name_mismatches() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "folder-name",
            "---\nname: different-name\ndescription: x\nagents: [anthropic]\n---\nbody\n",
        );
        assert!(skills_root.join("folder-name").is_dir());

        let listed = canonical_skills_list().expect("list");
        match &listed[0] {
            SkillListEntry::Ok {
                canonical_id,
                skill,
            } => {
                assert_eq!(canonical_id, "folder-name");
                assert_eq!(skill.name, "different-name");
            }
            other => panic!("expected mismatched Ok entry, got {other:?}"),
        }

        canonical_skills_delete("folder-name".into()).expect("delete by canonical id");
        assert!(!skills_root.join("folder-name").exists());
    }

    #[test]
    fn read_returns_err_for_missing_skill() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let err = canonical_skills_read("nope".into()).unwrap_err();
        assert!(err.contains("not found"), "err was: {err}");
    }

    /// Task 5.1: raw read/write round trip for editor repair. A broken skill's
    /// raw text is readable (where `canonical_skills_read` errors), a corrected
    /// raw write makes it parse, and an unchanged broken round-trip stays broken.
    #[test]
    fn raw_read_write_round_trip_repairs_broken_skill() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        // Plant a broken skill (non-mapping frontmatter root).
        let broken = "---\n- not\n- a mapping\n---\n# Body\n";
        write_skill(&skills_root, "fixme", broken);

        // Structured read errors; raw read succeeds and returns the bytes.
        assert!(canonical_skills_read("fixme".into()).is_err());
        let raw = canonical_skills_read_raw("fixme".into()).expect("raw read");
        assert_eq!(raw, broken);
        assert!(parse_skill_md(&raw).is_err(), "still broken before repair");

        // Unchanged round-trip stays broken.
        canonical_skills_write_raw("fixme".into(), raw.clone()).expect("raw write unchanged");
        assert!(parse_skill_md(&canonical_skills_read_raw("fixme".into()).unwrap()).is_err());

        // Corrected raw write makes it parse and become a normal skill.
        let fixed =
            "---\nname: fixme\ndescription: repaired\nagents:\n  - anthropic\n---\n# Body\n";
        canonical_skills_write_raw("fixme".into(), fixed.into()).expect("raw write fixed");
        let after = canonical_skills_read("fixme".into()).expect("structured read after repair");
        assert_eq!(after.description, "repaired");
        assert_eq!(after.agents, vec![AgentId::Anthropic]);
    }

    // ---------------------------------------------------------------------
    // sync-meta schema v2 tests (path-bug-and-target-model change)
    // ---------------------------------------------------------------------

    fn skill_with_agents(name: &str, agents: Vec<AgentId>) -> CanonicalSkill {
        CanonicalSkill {
            canonical_id: name.to_string(),
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
        let (round, legacy) = read_sync_meta_v2(&skill_dir, &skill);
        assert_eq!(round.version, 2);
        assert_eq!(round.targets.len(), 2);
        assert_eq!(round.last_sync.len(), 2);
        assert_eq!(
            round
                .last_sync
                .get("anthropic:project:C:/proj")
                .map(|e| e.pushed_hash.as_str()),
            Some("abc123"),
        );
        assert_eq!(round.dirty, false);
        assert!(
            legacy.is_none(),
            "native v2 read MUST NOT report a legacy last_synced"
        );
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
        let (meta, legacy) = read_sync_meta_v2(&skill_dir, &skill);

        assert_eq!(meta.version, 2);
        assert_eq!(meta.dirty, false, "v1 dirty preserved");
        assert_eq!(
            legacy.as_deref(),
            Some("2026-05-22T01:00:00Z"),
            "v1 last_synced surfaced for caller (CanonicalSkill.last_synced display)",
        );

        // Backfilled targets: one per agent. Canonical is always global after
        // scope-model-simplification, so backfill defaults to scope=Global +
        // project=None; users add project targets through the editor.
        assert_eq!(meta.targets.len(), 2, "two backfilled targets");
        let agents: Vec<AgentId> = meta.targets.iter().map(|t| t.agent).collect();
        assert!(agents.contains(&AgentId::Anthropic));
        assert!(agents.contains(&AgentId::Codex));
        for t in &meta.targets {
            assert_eq!(t.scope, SkillScope::Global);
            assert!(t.project.is_none());
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
        let (meta, _legacy) = read_sync_meta_v2(&skill_dir, &skill);
        assert!(meta.dirty, "mark_sync_meta_dirty must flip dirty=true");
        assert_eq!(meta.targets.len(), 1, "targets must survive mark_dirty");
        assert_eq!(meta.targets[0].agent, AgentId::Gemini);
        assert_eq!(
            meta.last_sync
                .get("gemini:global")
                .map(|e| e.pushed_hash.as_str()),
            Some("preserved-hash"),
            "last_sync must survive mark_dirty",
        );
    }

    /// After agents-derived alignment was retired (known-projects-and-multi-target),
    /// editing `agents` in SkillEditor MUST NOT regenerate targets. The target
    /// list is now user-driven via the target editor; `canonical_skills_write`
    /// only flips dirty=true.
    #[test]
    fn write_does_not_regenerate_targets_from_agents() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        // First write with agents=[anthropic].
        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "aligned".into());
        fm.insert("description".into(), "x".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );
        canonical_skills_write(
            "aligned".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Simulate a successful push: rewrite sidecar with v2 + one target + lastSync.
        let skill_dir = tmp.join(".felina").join("skills").join("aligned");
        let mut last_sync = BTreeMap::new();
        last_sync.insert(
            "anthropic:global".to_string(),
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

        // Second write: user changes agents to [anthropic, codex].
        let mut fm2 = serde_yaml::Mapping::new();
        fm2.insert("name".into(), "aligned".into());
        fm2.insert("description".into(), "x".into());
        fm2.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "codex".into()]),
        );
        canonical_skills_write(
            "aligned".into(),
            serde_yaml::Value::Mapping(fm2),
            "edited".into(),
        )
        .unwrap();

        let raw = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap();
        let meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap();
        assert_eq!(meta.version, 2);
        // Targets must NOT change — still only the original anthropic target.
        assert_eq!(
            meta.targets.len(),
            1,
            "targets must NOT regenerate from agents; got: {:?}",
            meta.targets,
        );
        assert_eq!(meta.targets[0].agent, AgentId::Anthropic);
        // lastSync for anthropic preserved.
        assert!(meta.last_sync.contains_key("anthropic:global"));
        // Dirty flipped because canonical was edited.
        assert!(meta.dirty);
    }

    #[test]
    fn v2_empty_targets_not_backfilled_from_agents() {
        let tmp = tempdir();
        let skill_dir = tmp.join("empty-v2");
        fs::create_dir_all(&skill_dir).unwrap();

        // v2 sidecar with empty targets (user has not added any target yet).
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![],
                last_sync: BTreeMap::new(),
                dirty: false,
            },
        )
        .unwrap();

        // Skill has agents=[anthropic, codex] in frontmatter.
        let skill = skill_with_agents("empty-v2", vec![AgentId::Anthropic, AgentId::Codex]);
        let (meta, legacy) = read_sync_meta_v2(&skill_dir, &skill);

        assert_eq!(meta.version, 2);
        assert!(
            meta.targets.is_empty(),
            "v2 + empty targets must NOT backfill from agents"
        );
        assert!(legacy.is_none());
    }

    #[test]
    fn new_skill_gets_empty_targets() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "brand-new".into());
        fm.insert("description".into(), "a new skill".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "codex".into()]),
        );

        canonical_skills_write(
            "brand-new".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let skill_dir = tmp.join(".felina").join("skills").join("brand-new");
        let raw = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap();
        let meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap();
        assert_eq!(meta.version, 2);
        assert!(meta.targets.is_empty(), "new skill must have empty targets");
        assert!(!meta.dirty, "no targets → nothing to push → not dirty");
    }

    #[test]
    fn targets_set_overwrites_and_prunes_last_sync() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skill_dir = tmp.join(".felina").join("skills").join("tgt-test");
        fs::create_dir_all(&skill_dir).unwrap();
        write_skill(
            &tmp.join(".felina").join("skills"),
            "tgt-test",
            "---\nname: tgt-test\ndescription: x\nagents: [anthropic]\n---\nbody\n",
        );

        let t_anth = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Global,
            project: None,
            enabled: true,
            mode: TargetMode::Tracked,
        };
        let t_codex = SkillTarget {
            agent: AgentId::Codex,
            scope: SkillScope::Global,
            project: None,
            enabled: true,
            mode: TargetMode::Tracked,
        };

        let mut ls = BTreeMap::new();
        ls.insert(
            target_key(&t_anth),
            LastSyncEntry {
                pushed_hash: "h1".into(),
                base_snapshot: None,
                at: "2026-01-01T00:00:00Z".into(),
            },
        );
        ls.insert(
            target_key(&t_codex),
            LastSyncEntry {
                pushed_hash: "h2".into(),
                base_snapshot: None,
                at: "2026-01-01T00:00:00Z".into(),
            },
        );
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![t_anth.clone(), t_codex.clone()],
                last_sync: ls,
                dirty: false,
            },
        )
        .unwrap();

        skill_targets_set("tgt-test".into(), vec![t_anth.clone()]).unwrap();

        let raw = fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap();
        let meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap();
        assert_eq!(meta.targets.len(), 1);
        assert_eq!(meta.targets[0].agent, AgentId::Anthropic);
        assert!(meta.last_sync.contains_key(&target_key(&t_anth)));
        assert!(!meta.last_sync.contains_key(&target_key(&t_codex)));
        assert!(meta.dirty);
    }

    // -----------------------------------------------------------------
    // Orphan prune scan tests (known-projects-and-multi-target task 5.1)
    // -----------------------------------------------------------------

    #[test]
    fn orphan_scan_detects_removed_target() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        // Create a canonical skill with agents=[anthropic, gemini].
        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "prune-me".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "gemini".into()]),
        );
        canonical_skills_write(
            "prune-me".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Plant agent-side SKILL.md files for both anthropic and gemini.
        let anthropic_dir = tmp.join(".claude").join("skills").join("prune-me");
        let gemini_dir = tmp.join(".gemini").join("skills").join("prune-me");
        fs::create_dir_all(&anthropic_dir).unwrap();
        fs::create_dir_all(&gemini_dir).unwrap();
        fs::write(anthropic_dir.join("SKILL.md"), "rendered").unwrap();
        fs::write(gemini_dir.join("SKILL.md"), "rendered").unwrap();

        // Set targets to only anthropic (tracked enabled, pointing at this
        // project); gemini target is removed so its planted file is an orphan.
        let skill_dir = tmp.join(".felina").join("skills").join("prune-me");
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
                last_sync: BTreeMap::new(),
                dirty: false,
            },
        )
        .unwrap();

        let orphans = skill_prune_orphans_scan("prune-me".into()).unwrap();

        // Gemini file is an orphan; anthropic file is not.
        let gemini_orphans: Vec<_> = orphans
            .iter()
            .filter(|o| o.agent == AgentId::Gemini)
            .collect();
        assert_eq!(
            gemini_orphans.len(),
            1,
            "gemini should be orphaned: {orphans:?}"
        );
        assert!(
            gemini_orphans[0].path.contains("prune-me"),
            "orphan path should contain skill name: {}",
            gemini_orphans[0].path,
        );

        let anthropic_orphans: Vec<_> = orphans
            .iter()
            .filter(|o| o.agent == AgentId::Anthropic)
            .collect();
        assert!(
            anthropic_orphans.is_empty(),
            "anthropic (tracked enabled) should NOT be orphaned: {orphans:?}",
        );
    }

    #[test]
    fn orphan_scan_preserves_disabled_tracked_and_flags_detached() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "flag-test".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "codex".into()]),
        );
        canonical_skills_write(
            "flag-test".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Plant agent-side files for anthropic and codex.
        let anthropic_dir = tmp.join(".claude").join("skills").join("flag-test");
        let codex_dir = tmp.join(".agents").join("skills").join("flag-test");
        fs::create_dir_all(&anthropic_dir).unwrap();
        fs::create_dir_all(&codex_dir).unwrap();
        fs::write(anthropic_dir.join("SKILL.md"), "rendered").unwrap();
        fs::write(codex_dir.join("SKILL.md"), "rendered").unwrap();

        // anthropic = disabled tracked (known, not orphan), codex = detached (orphan).
        let skill_dir = tmp.join(".felina").join("skills").join("flag-test");
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![
                    SkillTarget {
                        agent: AgentId::Anthropic,
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: false,
                        mode: TargetMode::Tracked,
                    },
                    SkillTarget {
                        agent: AgentId::Codex,
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Detached,
                    },
                ],
                last_sync: BTreeMap::new(),
                dirty: false,
            },
        )
        .unwrap();

        let orphans = skill_prune_orphans_scan("flag-test".into()).unwrap();
        let _ = project;

        assert_eq!(
            orphans.len(),
            1,
            "only detached target should be orphaned: {orphans:?}"
        );
        let agents: Vec<AgentId> = orphans.iter().map(|o| o.agent).collect();
        assert!(
            !agents.contains(&AgentId::Anthropic),
            "disabled tracked anthropic should not be orphaned"
        );
        assert!(agents.contains(&AgentId::Codex), "detached codex");
    }

    #[test]
    fn orphan_apply_deletes_confirmed_and_preserves_others() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "apply-test".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "codex".into(), "gemini".into()]),
        );
        canonical_skills_write(
            "apply-test".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Plant agent-side files for all three.
        let anth_dir = tmp.join(".claude").join("skills").join("apply-test");
        let codex_dir = tmp.join(".agents").join("skills").join("apply-test");
        let gemini_dir = tmp.join(".gemini").join("skills").join("apply-test");
        for d in [&anth_dir, &codex_dir, &gemini_dir] {
            fs::create_dir_all(d).unwrap();
            fs::write(d.join("SKILL.md"), "rendered").unwrap();
        }

        // Confirm deletion of codex and gemini dirs only.
        skill_prune_orphans_apply(
            "apply-test".into(),
            vec![
                OrphanFile {
                    path: codex_dir.to_string_lossy().to_string(),
                    agent: AgentId::Codex,
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                },
                OrphanFile {
                    path: gemini_dir.to_string_lossy().to_string(),
                    agent: AgentId::Gemini,
                    scope: SkillScope::Project,
                    project: Some(project),
                },
            ],
        )
        .unwrap();

        assert!(!codex_dir.exists(), "codex dir should be deleted");
        assert!(!gemini_dir.exists(), "gemini dir should be deleted");
        assert!(
            anth_dir.join("SKILL.md").is_file(),
            "anthropic dir (not in confirmed list) must survive",
        );
    }

    #[test]
    fn targets_set_detached_does_not_auto_delete_agent_file() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "no-auto-del".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );
        canonical_skills_write(
            "no-auto-del".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        // Plant the agent-side file.
        let anth_dir = tmp.join(".claude").join("skills").join("no-auto-del");
        fs::create_dir_all(&anth_dir).unwrap();
        fs::write(anth_dir.join("SKILL.md"), "rendered").unwrap();

        // Toggle the target to detached via skill_targets_set.
        skill_targets_set(
            "no-auto-del".into(),
            vec![SkillTarget {
                agent: AgentId::Anthropic,
                scope: SkillScope::Project,
                project: Some(tmp.to_string_lossy().to_string()),
                enabled: true,
                mode: TargetMode::Detached,
            }],
        )
        .unwrap();

        // Agent file must still exist — only explicit prune apply deletes.
        assert!(
            anth_dir.join("SKILL.md").is_file(),
            "detached toggle must NOT auto-delete agent file",
        );
    }

    #[test]
    fn orphan_scan_returns_empty_for_no_agent_files() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "clean".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );
        canonical_skills_write(
            "clean".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let orphans = skill_prune_orphans_scan("clean".into()).unwrap();

        assert!(orphans.is_empty(), "no agent files on disk → no orphans");
    }

    #[test]
    fn skill_target_read_content_reads_agent_side_skill_md() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "code-review".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["codex".into()]),
        );
        canonical_skills_write(
            "code-review".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let target = SkillTarget {
            agent: AgentId::Codex,
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: false,
            mode: TargetMode::Tracked,
        };
        let skill_dir = tmp.join(".felina").join("skills").join("code-review");
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target.clone()],
                last_sync: BTreeMap::new(),
                dirty: false,
            },
        )
        .unwrap();
        let agent_dir = tmp.join(".agents").join("skills").join("code-review");
        fs::create_dir_all(&agent_dir).unwrap();
        fs::write(agent_dir.join("SKILL.md"), "agent-side raw").unwrap();

        let content = skill_target_read_content("code-review".into(), target_key(&target))
            .expect("read agent content");

        assert_eq!(content, "agent-side raw");
    }

    #[test]
    fn skill_target_read_content_reports_missing_agent_file() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let project = tmp.to_string_lossy().to_string();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "code-review".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["codex".into()]),
        );
        canonical_skills_write(
            "code-review".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let target = SkillTarget {
            agent: AgentId::Codex,
            scope: SkillScope::Project,
            project: Some(project),
            enabled: false,
            mode: TargetMode::Tracked,
        };
        let skill_dir = tmp.join(".felina").join("skills").join("code-review");
        write_sync_meta_v2(
            &skill_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![target.clone()],
                last_sync: BTreeMap::new(),
                dirty: false,
            },
        )
        .unwrap();

        let err = skill_target_read_content("code-review".into(), target_key(&target)).unwrap_err();

        assert!(
            err.contains("does not exist") || err.contains("resolve"),
            "got: {err}"
        );
    }

    /// Smoke regression (task 8.4 / handoff UI #3a): a freshly-written
    /// canonical without targets is not pushable and surfaces as `dirty=false`.
    /// On overwrite of an already-synced skill with a pushable target,
    /// `last_synced` is preserved while `dirty` flips back to true.
    #[test]
    fn write_marks_canonical_dirty_in_sync_meta() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

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
            "fresh".into(),
            serde_yaml::Value::Mapping(fm.clone()),
            "body v1".into(),
        )
        .expect("first write");

        let skill = canonical_skills_read("fresh".into()).expect("read v1");
        assert!(
            !skill.dirty,
            "fresh canonical with no targets must be dirty=false"
        );
        assert!(
            skill.last_synced.is_none(),
            "fresh canonical has no last_synced"
        );

        // Add a target so subsequent edits become pushable.
        let skill_dir = tmp.join(".felina").join("skills").join("fresh");
        let target = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Global,
            project: None,
            enabled: true,
            mode: TargetMode::Tracked,
        };
        skill_targets_set("fresh".into(), vec![target]).expect("add target");

        // Simulate a prior successful push by overwriting sync-meta with
        // dirty=false + a recorded timestamp.
        let prior_timestamp = "2026-05-22T01:23:45Z";
        fs::write(
            skill_dir.join(".felina-sync-meta.json"),
            format!("{{\"dirty\":false,\"last_synced\":\"{prior_timestamp}\"}}"),
        )
        .unwrap();

        // Second write: simulate editing canonical. dirty flips back to true
        // because there is now a pushable target; last_synced is preserved.
        canonical_skills_write(
            "fresh".into(),
            serde_yaml::Value::Mapping(fm),
            "body v2 edited".into(),
        )
        .expect("second write");

        let after = canonical_skills_read("fresh".into()).expect("read v2");
        assert!(after.dirty, "edited canonical must be dirty=true");
        assert_eq!(
            after.last_synced.as_deref(),
            Some(prior_timestamp),
            "last_synced must survive the rewrite"
        );
    }

    /// Task 8.1: structured save normalizes frontmatter `name` to the canonical
    /// directory identity. If the caller passes frontmatter with `name: wrong`,
    /// the written SKILL.md must contain `name: dir-name`.
    #[test]
    fn write_normalizes_frontmatter_name_to_directory_identity() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "wrong-name".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );

        canonical_skills_write(
            "dir-name".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .expect("write");

        let skill = canonical_skills_read("dir-name".into()).expect("read back");
        assert_eq!(skill.canonical_id, "dir-name");
        assert_eq!(
            skill.name, "dir-name",
            "frontmatter name must be normalized to the directory identity"
        );
        let raw = canonical_skills_read_raw("dir-name".into()).unwrap();
        assert!(
            raw.contains("name: dir-name"),
            "on-disk YAML must contain the normalized name: {raw}"
        );
        assert!(
            !raw.contains("wrong-name"),
            "on-disk YAML must NOT contain the original mismatched name: {raw}"
        );
    }

    /// Task 8.2: raw repair normalizes YAML `name` to the canonical directory
    /// identity when the content parses, and returns the original name.
    #[test]
    fn write_raw_normalizes_name_on_successful_parse() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        let broken = "---\n- not a mapping\n---\nbody\n";
        write_skill(&skills_root, "smoke-nested", broken);

        let fixed_with_wrong_name =
            "---\nname: real\ndescription: repaired\nagents:\n  - anthropic\n---\n# Body\n";
        let result =
            canonical_skills_write_raw("smoke-nested".into(), fixed_with_wrong_name.into())
                .expect("raw write");

        assert_eq!(
            result.normalized_from.as_deref(),
            Some("real"),
            "must report the original name that was normalized"
        );

        let skill = canonical_skills_read("smoke-nested".into()).expect("read after repair");
        assert_eq!(skill.canonical_id, "smoke-nested");
        assert_eq!(
            skill.name, "smoke-nested",
            "repaired YAML name must be normalized to directory identity"
        );

        let on_disk = canonical_skills_read_raw("smoke-nested".into()).unwrap();
        assert!(
            on_disk.contains("name: smoke-nested"),
            "on-disk must contain normalized name: {on_disk}"
        );
        assert!(
            !on_disk.contains("name: real"),
            "on-disk must NOT contain original mismatched name: {on_disk}"
        );
    }

    /// Task 8.2: raw write that does NOT need normalization returns None.
    #[test]
    fn write_raw_returns_none_when_name_matches() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        let correct = "---\nname: my-skill\ndescription: ok\nagents:\n  - codex\n---\nbody\n";
        write_skill(&skills_root, "my-skill", "placeholder");

        let result =
            canonical_skills_write_raw("my-skill".into(), correct.into()).expect("raw write");
        assert!(
            result.normalized_from.is_none(),
            "no normalization needed: {result:?}"
        );
    }

    /// Task 9.1: target list mutation is keyed on the canonical directory
    /// identity, so `skill_targets_set` succeeds against a skill whose parsed
    /// `frontmatter.name` differs from its directory name — and the parsed name
    /// is NOT a valid lookup key.
    #[test]
    fn targets_set_succeeds_for_name_directory_mismatch() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();
        write_skill(
            &skills_root,
            "folder-id",
            "---\nname: parsed-different\ndescription: x\nagents: [anthropic]\n---\nbody\n",
        );

        let target = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Global,
            project: None,
            enabled: true,
            mode: TargetMode::Tracked,
        };

        // Lookup by canonical directory identity succeeds despite the mismatch.
        skill_targets_set("folder-id".into(), vec![target.clone()])
            .expect("targets_set must succeed keyed on the canonical directory identity");

        let raw =
            fs::read_to_string(skills_root.join("folder-id").join(SYNC_META_FILENAME)).unwrap();
        let meta: SyncMetaV2 = serde_json::from_str(&raw).unwrap();
        assert_eq!(meta.targets.len(), 1);
        assert_eq!(meta.targets[0].agent, AgentId::Anthropic);

        // The parsed frontmatter name is NOT a valid lookup key.
        assert!(
            skill_targets_set("parsed-different".into(), vec![target]).is_err(),
            "parsed frontmatter name must not resolve a skill directory",
        );
    }

    #[test]
    fn canonical_delete_policy_detach_cascade_and_cancel_control_agent_files() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        for name in ["delete-detach", "delete-cascade", "delete-cancel"] {
            let mut fm = serde_yaml::Mapping::new();
            fm.insert("name".into(), name.into());
            fm.insert("description".into(), "test".into());
            fm.insert(
                "agents".into(),
                serde_yaml::Value::Sequence(vec![
                    "anthropic".into(),
                    "codex".into(),
                    "gemini".into(),
                ]),
            );
            canonical_skills_write(name.into(), serde_yaml::Value::Mapping(fm), "body".into())
                .unwrap();
            let project = tmp.to_string_lossy().to_string();
            let disabled_project = tmp.join("disabled-project");
            let detached_project = tmp.join("detached-project");
            skill_targets_set(
                name.into(),
                vec![
                    SkillTarget {
                        agent: AgentId::Anthropic,
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Tracked,
                    },
                    SkillTarget {
                        agent: AgentId::Codex,
                        scope: SkillScope::Project,
                        project: Some(project.clone()),
                        enabled: true,
                        mode: TargetMode::Tracked,
                    },
                    SkillTarget {
                        agent: AgentId::Gemini,
                        scope: SkillScope::Project,
                        project: Some(disabled_project.to_string_lossy().to_string()),
                        enabled: false,
                        mode: TargetMode::Tracked,
                    },
                    SkillTarget {
                        agent: AgentId::Anthropic,
                        scope: SkillScope::Project,
                        project: Some(detached_project.to_string_lossy().to_string()),
                        enabled: true,
                        mode: TargetMode::Detached,
                    },
                ],
            )
            .unwrap();
            for root in [".claude", ".agents", ".gemini"] {
                let dir = tmp.join(root).join("skills").join(name);
                fs::create_dir_all(&dir).unwrap();
                fs::write(dir.join("SKILL.md"), "agent side").unwrap();
            }
            for dir in [
                disabled_project.join(".gemini").join("skills").join(name),
                detached_project.join(".claude").join("skills").join(name),
            ] {
                fs::create_dir_all(&dir).unwrap();
                fs::write(dir.join("SKILL.md"), "agent side").unwrap();
            }
        }

        let detach = canonical_skills_delete_with_policy(
            "delete-detach".into(),
            CanonicalDeletePolicy::Detach,
        )
        .unwrap();
        assert!(detach.canonical_deleted);
        assert!(!tmp
            .join(".felina")
            .join("skills")
            .join("delete-detach")
            .exists());
        assert!(tmp
            .join(".claude")
            .join("skills")
            .join("delete-detach")
            .exists());
        assert!(tmp
            .join(".agents")
            .join("skills")
            .join("delete-detach")
            .exists());

        let cascade = canonical_skills_delete_with_policy(
            "delete-cascade".into(),
            CanonicalDeletePolicy::Cascade,
        )
        .unwrap();
        assert!(cascade.canonical_deleted);
        assert_eq!(cascade.target_results.len(), 2);
        assert!(cascade.target_results.iter().all(|r| r.success));
        assert!(!tmp
            .join(".felina")
            .join("skills")
            .join("delete-cascade")
            .exists());
        assert!(!tmp
            .join(".claude")
            .join("skills")
            .join("delete-cascade")
            .exists());
        assert!(!tmp
            .join(".agents")
            .join("skills")
            .join("delete-cascade")
            .exists());
        assert!(tmp
            .join("disabled-project")
            .join(".gemini")
            .join("skills")
            .join("delete-cascade")
            .exists());
        assert!(tmp
            .join("detached-project")
            .join(".claude")
            .join("skills")
            .join("delete-cascade")
            .exists());

        let cancel = canonical_skills_delete_with_policy(
            "delete-cancel".into(),
            CanonicalDeletePolicy::Cancel,
        )
        .unwrap();
        assert!(!cancel.canonical_deleted);
        assert!(tmp
            .join(".felina")
            .join("skills")
            .join("delete-cancel")
            .exists());
        assert!(tmp
            .join(".claude")
            .join("skills")
            .join("delete-cancel")
            .exists());
        assert!(tmp
            .join(".agents")
            .join("skills")
            .join("delete-cancel")
            .exists());
    }

    #[test]
    fn target_remove_policy_prunes_meta_deletes_only_selected_and_preserves_on_failure() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "target-remove".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into(), "gemini".into(), "codex".into()]),
        );
        canonical_skills_write(
            "target-remove".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let project = tmp.to_string_lossy().to_string();
        let anthropic = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Tracked,
        };
        let gemini = SkillTarget {
            agent: AgentId::Gemini,
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Tracked,
        };
        let codex = SkillTarget {
            agent: AgentId::Codex,
            scope: SkillScope::Project,
            project: Some(project.clone()),
            enabled: true,
            mode: TargetMode::Tracked,
        };
        skill_targets_set(
            "target-remove".into(),
            vec![anthropic.clone(), gemini.clone(), codex.clone()],
        )
        .unwrap();

        let skill_dir = tmp.join(".felina").join("skills").join("target-remove");
        let mut meta: SyncMetaV2 =
            serde_json::from_str(&fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap())
                .unwrap();
        meta.last_sync.insert(
            target_key(&anthropic),
            LastSyncEntry {
                pushed_hash: "a".into(),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
            },
        );
        meta.last_sync.insert(
            target_key(&gemini),
            LastSyncEntry {
                pushed_hash: "g".into(),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
            },
        );
        meta.last_sync.insert(
            target_key(&codex),
            LastSyncEntry {
                pushed_hash: "c".into(),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
            },
        );
        write_sync_meta_v2(&skill_dir, &meta).unwrap();

        let anthropic_dir = tmp.join(".claude").join("skills").join("target-remove");
        let gemini_dir = tmp.join(".gemini").join("skills").join("target-remove");
        let codex_path = tmp.join(".agents").join("skills").join("target-remove");
        fs::create_dir_all(&anthropic_dir).unwrap();
        fs::create_dir_all(&gemini_dir).unwrap();
        fs::create_dir_all(codex_path.parent().unwrap()).unwrap();
        fs::write(anthropic_dir.join("SKILL.md"), "anthropic").unwrap();
        fs::write(gemini_dir.join("SKILL.md"), "gemini").unwrap();
        fs::write(&codex_path, "not a directory").unwrap();

        let cancel = skill_target_remove_with_policy(
            "target-remove".into(),
            anthropic.clone(),
            TargetRemovalPolicy::Cancel,
        )
        .unwrap();
        assert!(!cancel.target_removed);

        let remove_only = skill_target_remove_with_policy(
            "target-remove".into(),
            anthropic.clone(),
            TargetRemovalPolicy::RemoveTargetOnly,
        )
        .unwrap();
        assert!(remove_only.target_removed);
        assert!(
            anthropic_dir.join("SKILL.md").is_file(),
            "remove-only leaves file"
        );

        let delete_file = skill_target_remove_with_policy(
            "target-remove".into(),
            gemini.clone(),
            TargetRemovalPolicy::RemoveTargetAndDeleteFile,
        )
        .unwrap();
        assert!(delete_file.target_removed);
        assert!(
            !gemini_dir.exists(),
            "delete-file removes selected target dir"
        );
        assert!(anthropic_dir.exists(), "other agent dir is not touched");

        let failed = skill_target_remove_with_policy(
            "target-remove".into(),
            codex.clone(),
            TargetRemovalPolicy::RemoveTargetAndDeleteFile,
        )
        .unwrap();
        assert!(!failed.target_removed, "failed delete keeps target row");
        assert!(failed.delete_result.as_ref().is_some_and(|r| !r.success));

        let unexpected_project = tmp.join("unexpected-project");
        let unexpected_dir = unexpected_project
            .join(".claude")
            .join("skills")
            .join("target-remove");
        fs::create_dir_all(&unexpected_dir).unwrap();
        fs::write(unexpected_dir.join("SKILL.md"), "unexpected").unwrap();
        let unexpected = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Project,
            project: Some(unexpected_project.to_string_lossy().to_string()),
            enabled: true,
            mode: TargetMode::Tracked,
        };
        let missing_err = skill_target_remove_with_policy(
            "target-remove".into(),
            unexpected,
            TargetRemovalPolicy::RemoveTargetAndDeleteFile,
        )
        .unwrap_err();
        assert_eq!(missing_err, "target not found");
        assert!(
            unexpected_dir.join("SKILL.md").is_file(),
            "unknown target payload must not delete files"
        );

        let after: SyncMetaV2 =
            serde_json::from_str(&fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap())
                .unwrap();
        assert!(!after
            .targets
            .iter()
            .any(|t| target_key(t) == target_key(&anthropic)));
        assert!(!after
            .targets
            .iter()
            .any(|t| target_key(t) == target_key(&gemini)));
        assert!(after
            .targets
            .iter()
            .any(|t| target_key(t) == target_key(&codex)));
        assert!(!after.last_sync.contains_key(&target_key(&anthropic)));
        assert!(!after.last_sync.contains_key(&target_key(&gemini)));
        assert!(after.last_sync.contains_key(&target_key(&codex)));
    }

    #[test]
    fn target_repoint_updates_project_key_marks_dirty_and_preserves_old_files() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);

        let old_project = tmp.join("old-project");
        let new_project = tmp.join("new-project");
        fs::create_dir_all(
            old_project
                .join(".claude")
                .join("skills")
                .join("repoint-skill"),
        )
        .unwrap();
        fs::create_dir_all(&new_project).unwrap();
        fs::write(
            old_project
                .join(".claude")
                .join("skills")
                .join("repoint-skill")
                .join("SKILL.md"),
            "old file",
        )
        .unwrap();

        let mut fm = serde_yaml::Mapping::new();
        fm.insert("name".into(), "repoint-skill".into());
        fm.insert("description".into(), "test".into());
        fm.insert(
            "agents".into(),
            serde_yaml::Value::Sequence(vec!["anthropic".into()]),
        );
        canonical_skills_write(
            "repoint-skill".into(),
            serde_yaml::Value::Mapping(fm),
            "body".into(),
        )
        .unwrap();

        let target = SkillTarget {
            agent: AgentId::Anthropic,
            scope: SkillScope::Project,
            project: Some(old_project.to_string_lossy().to_string()),
            enabled: true,
            mode: TargetMode::Tracked,
        };
        skill_targets_set("repoint-skill".into(), vec![target.clone()]).unwrap();

        let skill_dir = tmp.join(".felina").join("skills").join("repoint-skill");
        let old_key = target_key(&target);
        let mut meta: SyncMetaV2 =
            serde_json::from_str(&fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap())
                .unwrap();
        meta.last_sync.insert(
            old_key.clone(),
            LastSyncEntry {
                pushed_hash: "old".into(),
                base_snapshot: None,
                at: "2026-05-26T00:00:00Z".into(),
            },
        );
        meta.dirty = false;
        write_sync_meta_v2(&skill_dir, &meta).unwrap();

        let result = skill_target_repoint(
            "repoint-skill".into(),
            target.clone(),
            new_project.to_string_lossy().to_string(),
        )
        .unwrap();

        assert_eq!(result.old_target_key, old_key);
        assert_ne!(result.old_target_key, result.new_target_key);
        assert_eq!(result.target.agent, target.agent);
        assert_eq!(result.target.scope, SkillScope::Project);
        assert_eq!(result.target.enabled, target.enabled);
        assert_eq!(result.target.mode, target.mode);
        assert_eq!(
            result.target.project.as_deref(),
            Some(
                crate::commands::known_projects::normalize_path(&new_project.to_string_lossy())
                    .as_str()
            ),
        );
        assert!(result.dirty);

        let after: SyncMetaV2 =
            serde_json::from_str(&fs::read_to_string(skill_dir.join(SYNC_META_FILENAME)).unwrap())
                .unwrap();
        assert!(!after.last_sync.contains_key(&result.old_target_key));
        assert!(after.dirty);
        assert!(after
            .targets
            .iter()
            .any(|t| target_key(t) == result.new_target_key));
        assert!(
            old_project
                .join(".claude")
                .join("skills")
                .join("repoint-skill")
                .join("SKILL.md")
                .is_file(),
            "repoint must not delete files from the old project path",
        );
    }

    /// Task 8.2: raw write of content that doesn't parse (still broken) does
    /// not crash and returns no normalization info.
    #[test]
    fn write_raw_still_broken_returns_none() {
        let tmp = tempdir();
        let _g = override_felina_home(&tmp);
        let skills_root = tmp.join(".felina").join("skills");
        fs::create_dir_all(&skills_root).unwrap();

        let broken = "---\n- still broken\n---\nbody\n";
        write_skill(&skills_root, "broken-skill", "placeholder");

        let result =
            canonical_skills_write_raw("broken-skill".into(), broken.into()).expect("raw write");
        assert!(
            result.normalized_from.is_none(),
            "broken content has no name to normalize: {result:?}"
        );
        assert!(
            parse_skill_md(&canonical_skills_read_raw("broken-skill".into()).unwrap()).is_err()
        );
    }
}
