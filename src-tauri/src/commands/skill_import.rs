//! Initial skill import: detect existing agent-native skills and pull
//! them into canonical. Detection is intentionally cheap (count
//! subdirs, no content reads); the wizard step (`skill_import_scan`)
//! does the deeper read with conflict diff.
//!
//! Divergence from `skill_package::import_entries` (hub-install-import-parity-and-preview
//! audit): this module does not decode tar/zip archives. It walks
//! filesystem-resident agent-native skill directories and reclassifies
//! fields between Claude / Codex / Gemini schemas. The shared package
//! helper covers archive-format-agnostic validation + write, which is not
//! the contract this importer needs. No call site here is migrated to
//! `import_entries` because none of them ingest a packaged archive.

use crate::commands::agent_paths::{agent_paths_get, AgentPathPair};
use crate::commands::canonical_skills::{
    canonical_skills_dir, parse_skill_md, read_sync_meta_v2_no_backfill, split_frontmatter,
    write_sync_meta_v2, AgentId, SkillScope, SkillTarget, TargetMode,
};
use crate::commands::fan_out::{build_diff_hunks, expand_user_path, resolve_pair, DiffHunk};
use crate::paths::normalize_display_path;
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
    /// Full per-source candidates for this grouped skill name.
    pub candidates: Vec<ImportCandidate>,
    /// Human-readable note for the wizard row.
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictInfo {
    pub canonical_path: String,
    pub canonical_body_preview: String,
    pub diff_summary: String,
    /// Line-level diff between canonical (old) and project source (new). Built
    /// at scan time so the Link confirmation can render an inline diff without
    /// a second round-trip. Skipped on deserialize because frontend never
    /// sends it back through `ImportSelection`.
    #[serde(default, skip_deserializing)]
    pub hunks: Vec<DiffHunk>,
}

/// One user choice for the apply step.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSelection {
    pub candidate: ImportCandidate,
    pub resolution: ImportResolution,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ImportResolution {
    OverwriteCanonical,
    Skip,
    Rename {
        new_name: String,
    },
    SelectSource {
        source_index: usize,
        #[serde(default)]
        new_name: Option<String>,
    },
}

const BODY_PREVIEW_BYTES: usize = 240;

// ---------------------------------------------------------------------------
// Quick scan — count only, never read SKILL.md contents.
// ---------------------------------------------------------------------------

/// Count agent-native skill subdirectories for each known location.
///
/// For Gemini, we probe BOTH the spec-default path and the Antigravity CLI
/// path (`~/.gemini/antigravity-cli/skills/`) and sum them — users may
/// have skills in either tree.
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

    let anthropic = skill_names_at_pair(scope, project_path.as_deref(), cfg.pair_for("anthropic").unwrap())?;
    let codex = skill_names_at_pair(scope, project_path.as_deref(), cfg.pair_for("codex").unwrap())?;
    let mut gemini = skill_names_at_pair(scope, project_path.as_deref(), cfg.pair_for("gemini").unwrap())?;
    if scope == SkillScope::Global {
        for extra in cfg.extra_global_paths("gemini", |p| expand_user_path(p)) {
            gemini.extend(skill_names_at(&extra));
        }
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
    for (agent, pair) in cfg.agents.iter().map(|(k, v)| (k.clone(), v)) {
        let dir = resolve_pair(scope, project_path.as_deref(), pair)?;
        collect_candidates_in(&dir, agent, &canonical_dir, &mut out);
    }
    if scope == SkillScope::Global {
        for extra in cfg.extra_global_paths("gemini", |p| expand_user_path(p)) {
            collect_candidates_in(&extra, "gemini".to_string(), &canonical_dir, &mut out);
        }
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
            let canonical_raw = fs::read_to_string(&canonical_path).unwrap_or_default();
            Some(ConflictInfo {
                canonical_path: normalize_display_path(&canonical_path.to_string_lossy()),
                canonical_body_preview: body_preview_from(&canonical_raw),
                diff_summary: summarise_diff_raw(&raw, &canonical_raw),
                hunks: build_diff_hunks(&canonical_raw, &raw),
            })
        } else {
            None
        };

        let validation_error = validate_source_frontmatter(&raw).err();

        out.push(ImportCandidate {
            source_path: normalize_display_path(&skill_md.to_string_lossy()),
            source_agent: agent.clone(),
            skill_name: dir_name,
            body_preview,
            conflict,
            deferred: None,
            validation_error,
        });
    }
}

fn agent_label(a: &str) -> &str {
    a
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
        // Multi-source → grouped row. Distinct agents, preserving first-seen order.
        let mut agents: Vec<AgentId> = Vec::new();
        for c in &group {
            if !agents.contains(&c.source_agent) {
                agents.push(c.source_agent.clone());
            }
        }
        let labels: Vec<&str> = agents.iter().map(|a| agent_label(a)).collect();
        let reason = format!(
            "Found in {} locations ({}). Select one source to import as canonical content.",
            group.len(),
            labels.join(", "),
        );
        // Representative row carries the first source's preview/path, while the
        // deferred payload preserves every source so apply can use a selected index.
        let candidates = group.clone();
        let mut rep = group.into_iter().next().expect("len>=2");
        rep.deferred = Some(DeferredMultiSource {
            agents,
            candidates,
            reason,
        });
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

fn summarise_diff_raw(source_raw: &str, canonical_raw: &str) -> String {
    let src_lines = source_raw.lines().count();
    let dst_lines = canonical_raw.lines().count();
    let src_bytes = source_raw.len();
    let dst_bytes = canonical_raw.len();
    format!(
        "source: {src_lines} lines / {src_bytes} bytes; canonical: {dst_lines} lines / {dst_bytes} bytes"
    )
}

// ---------------------------------------------------------------------------
// Project-local skill operations: rename / discard the project-side copy of
// a same-name skill without touching canonical or sync-meta.
// ---------------------------------------------------------------------------

fn validate_skill_name_segment(name: &str) -> Result<(), String> {
    if name.is_empty() {
        return Err("skill name must not be empty".into());
    }
    if name.contains("..") || name.contains('/') || name.contains('\\') {
        return Err("skill name must not contain path separators or '..'".into());
    }
    Ok(())
}

fn resolve_project_agent_skills_dir(
    project_path: &str,
    agent: &str,
) -> Result<PathBuf, String> {
    let cfg = agent_paths_get()?;
    let pair = cfg.pair_for(agent)
        .ok_or_else(|| format!("unknown agent: {agent}"))?;
    resolve_pair(SkillScope::Project, Some(project_path), pair)
}

/// Rewrite the `name` field in a SKILL.md's YAML frontmatter, preserving body
/// and any other frontmatter entries. Returns the new file contents.
fn rewrite_skill_md_name(raw: &str, new_name: &str) -> Result<String, String> {
    let (fm_text, body) = split_frontmatter(raw);
    if fm_text.is_empty() {
        return Err("SKILL.md missing or unterminated YAML frontmatter".into());
    }
    let value: serde_yaml::Value =
        serde_yaml::from_str(&fm_text).map_err(|e| format!("malformed YAML: {e}"))?;
    let mut map = match value {
        serde_yaml::Value::Mapping(m) => m,
        _ => return Err("frontmatter root must be a YAML mapping".into()),
    };
    map.insert(
        serde_yaml::Value::String("name".into()),
        serde_yaml::Value::String(new_name.to_string()),
    );
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

/// Rename a project-local skill directory and sync the SKILL.md `name`
/// frontmatter field. Canonical and sync-meta are NOT touched.
#[tauri::command]
pub fn project_local_skill_rename(
    project_path: String,
    agent: AgentId,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    validate_skill_name_segment(&old_name)?;
    validate_skill_name_segment(&new_name)?;
    if old_name == new_name {
        return Err("new name must differ from old name".into());
    }
    let dir = resolve_project_agent_skills_dir(&project_path, &agent)?;
    let old_dir = dir.join(&old_name);
    let new_dir = dir.join(&new_name);
    if !old_dir.is_dir() {
        return Err(format!(
            "source skill directory not found: {}",
            old_dir.display()
        ));
    }
    if new_dir.exists() {
        return Err(format!(
            "target name already exists: {}",
            new_dir.display()
        ));
    }
    fs::rename(&old_dir, &new_dir)
        .map_err(|e| format!("failed to rename skill directory: {e}"))?;

    let skill_md = new_dir.join("SKILL.md");
    if skill_md.is_file() {
        let raw = match fs::read_to_string(&skill_md) {
            Ok(s) => s,
            Err(e) => {
                let _ = fs::rename(&new_dir, &old_dir);
                return Err(format!("failed to read SKILL.md after rename: {e}"));
            }
        };
        let updated = match rewrite_skill_md_name(&raw, &new_name) {
            Ok(s) => s,
            Err(e) => {
                let _ = fs::rename(&new_dir, &old_dir);
                return Err(format!("failed to update SKILL.md frontmatter: {e}"));
            }
        };
        if let Err(e) = fs::write(&skill_md, updated) {
            let _ = fs::rename(&new_dir, &old_dir);
            return Err(format!("failed to write SKILL.md: {e}"));
        }
    }
    Ok(())
}

/// Delete a project-local skill directory. Canonical and sync-meta are NOT
/// touched. Missing directory returns Ok (idempotent).
#[tauri::command]
pub fn project_local_skill_delete(
    project_path: String,
    agent: AgentId,
    skill_name: String,
) -> Result<(), String> {
    validate_skill_name_segment(&skill_name)?;
    let dir = resolve_project_agent_skills_dir(&project_path, &agent)?;
    let target = dir.join(&skill_name);
    if !target.exists() {
        return Ok(());
    }
    fs::remove_dir_all(&target)
        .map_err(|e| format!("failed to delete skill directory: {e}"))?;
    Ok(())
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
        // Until SelectSource handling runs, legacy resolutions for grouped
        // multi-source rows stay no-op rather than silently importing the
        // representative source.
        if sel.candidate.deferred.is_some()
            && !matches!(sel.resolution, ImportResolution::SelectSource { .. })
        {
            continue;
        }
        // Note: a `validation_error` candidate is NOT skipped — it imports as a
        // verbatim broken canonical file (import-as-broken), surfacing as a
        // Broken list entry the user repairs in the editor's raw mode.
        match &sel.resolution {
            ImportResolution::Skip => continue,
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
            ImportResolution::SelectSource {
                source_index,
                new_name,
            } => {
                let deferred =
                    sel.candidate.deferred.as_ref().ok_or_else(|| {
                        "SelectSource requires a multi-source candidate".to_string()
                    })?;
                let selected = deferred.candidates.get(*source_index).ok_or_else(|| {
                    format!(
                        "source_index {source_index} out of range for {} candidates",
                        deferred.candidates.len()
                    )
                })?;
                write_canonical_from_source(
                    selected,
                    &canonical_dir,
                    new_name.as_deref(),
                    project_path.as_deref(),
                )?;
                write_disabled_targets_for_non_selected_sources(
                    &deferred.candidates,
                    *source_index,
                    new_name.as_deref().unwrap_or(&selected.skill_name),
                    &canonical_dir,
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
    let content = match ensure_required_fields(&raw, &name, &candidate.source_agent) {
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

    // For Codex imports: read agents/openai.yaml from source and merge into
    // the canonical file's x_felina_agent_fields.codex, then remove the
    // copied agents/ dir from canonical (it's an agent-specific output, not
    // canonical content).
    if candidate.source_agent == "codex".to_string() {
        if let Some(source_skill_dir) = source.parent() {
            import_codex_openai_yaml(source_skill_dir, &target_dir);
            let agents_dir = target_dir.join("agents");
            if agents_dir.is_dir() {
                let _ = fs::remove_dir_all(&agents_dir);
            }
        }
    }

    // Record a SkillTarget for the source location so a subsequent push can
    // fan back out to it. The scope of the target mirrors where the import
    // came from: `Some(project_path)` → scope=Project (`project=path`),
    // `None` → scope=Global. Read the existing sidecar WITHOUT backfill so a
    // fresh import gets EXACTLY the source target (not a synthetic global
    // target per `agents` + the source target); an overwrite preserves the
    // existing target list and just adds/keeps the source target.
    let mut meta = read_sync_meta_v2_no_backfill(&target_dir);
    let new_target = import_target_for(candidate, project_path, true);
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

/// Read `agents/openai.yaml` from a Codex source skill dir and merge its
/// contents into the canonical SKILL.md's `x_felina_agent_fields.codex`.
fn import_codex_openai_yaml(source_skill_dir: &Path, canonical_skill_dir: &Path) {
    let yaml_path = source_skill_dir.join("agents").join("openai.yaml");
    let raw = match fs::read_to_string(&yaml_path) {
        Ok(s) => s,
        Err(_) => return,
    };
    let value: serde_yaml::Value = match serde_yaml::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return,
    };
    let serde_yaml::Value::Mapping(root) = value else {
        return;
    };
    // Read the canonical SKILL.md, parse, inject codex agent_fields, rewrite.
    let md_path = canonical_skill_dir.join("SKILL.md");
    let md_raw = match fs::read_to_string(&md_path) {
        Ok(s) => s,
        Err(_) => return,
    };
    let mut skill = match parse_skill_md(&md_raw) {
        Ok(s) => s,
        Err(_) => return,
    };
    // Flatten the openai.yaml structure into dotted keys for codex namespace.
    let mut codex_map = serde_yaml::Mapping::new();
    for (k, v) in &root {
        let serde_yaml::Value::String(ref section) = k else {
            continue;
        };
        if let serde_yaml::Value::Mapping(ref inner) = v {
            for (ik, iv) in inner {
                let serde_yaml::Value::String(ref inner_key) = ik else {
                    continue;
                };
                codex_map.insert(
                    serde_yaml::Value::String(format!("{section}.{inner_key}")),
                    iv.clone(),
                );
            }
        } else {
            codex_map.insert(k.clone(), v.clone());
        }
    }
    if codex_map.is_empty() {
        return;
    }
    skill
        .agent_fields
        .insert("codex".into(), serde_yaml::Value::Mapping(codex_map));
    // Rewrite canonical with agent_fields injected.
    let (fm_text, _) = split_frontmatter(&md_raw);
    if fm_text.is_empty() {
        return;
    }
    let mut fm_value: serde_yaml::Value = match serde_yaml::from_str(&fm_text) {
        Ok(v) => v,
        Err(_) => return,
    };
    if let serde_yaml::Value::Mapping(ref mut map) = fm_value {
        crate::commands::canonical_skills::inject_agent_fields(map, &skill.agent_fields);
    }
    let fm_yaml = match serde_yaml::to_string(&fm_value) {
        Ok(s) => s,
        Err(_) => return,
    };
    let body = &skill.body;
    let body_normalized = if body.ends_with('\n') || body.is_empty() {
        body.to_string()
    } else {
        format!("{body}\n")
    };
    let out = format!(
        "---\n{}\n---\n{body_normalized}",
        fm_yaml.trim_end_matches('\n')
    );
    let _ = fs::write(&md_path, out);
}

fn import_target_for(
    candidate: &ImportCandidate,
    project_path: Option<&str>,
    enabled: bool,
) -> SkillTarget {
    match project_path {
        Some(pp) => SkillTarget {
            agent: candidate.source_agent.clone(),
            scope: SkillScope::Project,
            project: Some(pp.to_string()),
            enabled,
            mode: TargetMode::Manual,
        },
        None => SkillTarget {
            agent: candidate.source_agent.clone(),
            scope: SkillScope::Global,
            project: None,
            enabled,
            mode: TargetMode::Manual,
        },
    }
}

fn write_disabled_targets_for_non_selected_sources(
    candidates: &[ImportCandidate],
    selected_index: usize,
    canonical_name: &str,
    canonical_dir: &Path,
    project_path: Option<&str>,
) -> Result<(), String> {
    let target_dir = canonical_dir.join(canonical_name);
    let mut meta = read_sync_meta_v2_no_backfill(&target_dir);
    for (idx, candidate) in candidates.iter().enumerate() {
        if idx == selected_index {
            continue;
        }
        let disabled = import_target_for(candidate, project_path, false);
        if let Some(existing) = meta.targets.iter_mut().find(|target| {
            target.agent == disabled.agent
                && target.scope == disabled.scope
                && target.project == disabled.project
        }) {
            existing.enabled = false;
            existing.mode = TargetMode::Manual;
        } else {
            meta.targets.push(disabled);
        }
    }
    meta.dirty = meta
        .targets
        .iter()
        .any(|t| t.enabled && !matches!(t.mode, TargetMode::Detached | TargetMode::Forked));
    meta.version = 2;
    write_sync_meta_v2(&target_dir, &meta)
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
fn ensure_required_fields(raw: &str, name: &str, source_agent: &str) -> Result<String, String> {
    // Try to parse as-is first; if it succeeds, we already have everything
    // we need and just re-serialize. `agents` is optional at the parse layer
    // (agents=[] is a valid content-only state), but importing FROM an agent
    // directory means the source agent is known — tag it so the canonical
    // skill fans back out to where it came from.
    if let Ok(mut parsed) = parse_skill_md(raw) {
        parsed.name = name.to_string();
        if parsed.agents.is_empty() {
            parsed.agents = vec![source_agent.to_string()];
        }
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
    let agent_str = source_agent;
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
        .map(|a| serde_yaml::Value::String(a.clone()))
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
    crate::commands::canonical_skills::inject_agent_fields(&mut map, &skill.agent_fields);
    let fm_yaml = serde_yaml::to_string(&serde_yaml::Value::Mapping(map)).unwrap_or_default();
    let body_norm = if skill.body.ends_with('\n') || skill.body.is_empty() {
        skill.body
    } else {
        format!("{}\n", skill.body)
    };
    format!("---\n{}\n---\n{body_norm}", fm_yaml.trim_end_matches('\n'))
}

// ---------------------------------------------------------------------------
// ZIP import scan — extract a user-supplied ZIP to a per-call temp directory
// and surface its skills as ImportCandidates. Replaces the old direct-write
// `skill_library_import` path so all external imports flow through the
// staging dialog's conflict resolution.
// ---------------------------------------------------------------------------

/// Extract `zip_path` into a fresh OS temp directory and return one
/// `ImportCandidate` per top-level directory that contains a `SKILL.md`.
/// Directories without `SKILL.md` are skipped. The canonical `~/.felina/skills/`
/// directory is NOT written; the eventual apply step re-reads from the temp
/// paths embedded in each candidate's `source_path`.
#[tauri::command]
pub fn skill_import_scan_zip(zip_path: String) -> Result<Vec<ImportCandidate>, String> {
    use std::io::Read;

    let file =
        fs::File::open(&zip_path).map_err(|e| format!("failed to open ZIP file: {e}"))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|e| format!("failed to read ZIP archive: {e}"))?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let extract_root = std::env::temp_dir().join(format!(
        "felina-zip-import-{}-{stamp}",
        std::process::id()
    ));
    fs::create_dir_all(&extract_root)
        .map_err(|e| format!("failed to create temp extract dir: {e}"))?;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("ZIP read error: {e}"))?;
        let raw_name = entry.name().to_string();
        let rel = PathBuf::from(&raw_name);
        // Zip Slip defence: refuse absolute paths and traversal segments.
        if rel.is_absolute()
            || rel.components().any(|c| {
                matches!(
                    c,
                    std::path::Component::ParentDir | std::path::Component::Prefix(_)
                )
            })
        {
            continue;
        }
        let dest = extract_root.join(&rel);
        if entry.is_dir() {
            fs::create_dir_all(&dest)
                .map_err(|e| format!("failed to create directory {}: {e}", dest.display()))?;
            continue;
        }
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("failed to create parent {}: {e}", parent.display()))?;
        }
        let mut buf = Vec::new();
        entry
            .read_to_end(&mut buf)
            .map_err(|e| format!("failed to read ZIP entry: {e}"))?;
        fs::write(&dest, &buf).map_err(|e| format!("failed to write {}: {e}", dest.display()))?;
    }

    let canonical_dir = canonical_skills_dir();
    let mut out: Vec<ImportCandidate> = Vec::new();
    collect_zip_candidates_in(&extract_root, &canonical_dir, &mut out);
    Ok(out)
}

/// Mirror of `collect_candidates_in` for ZIP-sourced skills: agent is inferred
/// from the source SKILL.md frontmatter (`agents[0]`, fallback `Anthropic`).
/// No multi-source grouping — a ZIP is a single source.
fn collect_zip_candidates_in(
    dir: &Path,
    canonical_dir: &Path,
    out: &mut Vec<ImportCandidate>,
) {
    let entries = match fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            continue;
        }
        if let Some(cand) = candidate_from_skill_dir(&entry.path(), canonical_dir) {
            out.push(cand);
        }
    }
}

/// Build one `ImportCandidate` from a directory expected to contain a
/// `SKILL.md`. Shared by ZIP-sourced and folder-sourced scans so agent
/// inference, conflict detection, and validation stay on a single path.
/// Returns `None` when the directory has no readable `SKILL.md`.
fn candidate_from_skill_dir(skill_dir: &Path, canonical_dir: &Path) -> Option<ImportCandidate> {
    let skill_md = skill_dir.join("SKILL.md");
    if !skill_md.is_file() {
        return None;
    }
    let raw = fs::read_to_string(&skill_md).ok()?;
    let dir_name = skill_dir.file_name()?.to_string_lossy().to_string();
    let body_preview = body_preview_from(&raw);
    let source_agent = infer_agent_from_frontmatter(&raw).unwrap_or("anthropic".to_string());

    let canonical_path = canonical_dir.join(&dir_name).join("SKILL.md");
    let conflict = if canonical_path.is_file() {
        let canonical_raw = fs::read_to_string(&canonical_path).unwrap_or_default();
        Some(ConflictInfo {
            canonical_path: normalize_display_path(&canonical_path.to_string_lossy()),
            canonical_body_preview: body_preview_from(&canonical_raw),
            diff_summary: summarise_diff_raw(&raw, &canonical_raw),
            hunks: build_diff_hunks(&canonical_raw, &raw),
        })
    } else {
        None
    };
    let validation_error = validate_source_frontmatter(&raw).err();

    Some(ImportCandidate {
        source_path: normalize_display_path(&skill_md.to_string_lossy()),
        source_agent,
        skill_name: dir_name,
        body_preview,
        conflict,
        deferred: None,
        validation_error,
    })
}

/// Scan a user-selected on-disk directory for importable skills. Unlike the
/// ZIP path there is no temp extraction: candidates' `source_path` points at
/// the original location and the apply step reads from there directly.
///
/// Resolution order: (1) the selected directory itself contains `SKILL.md` →
/// exactly one candidate named after that directory; (2) otherwise scan
/// first-level subdirectories only, skipping those without `SKILL.md`;
/// (3) neither yields anything → `Ok(vec![])` ("no skills found", not an
/// error). A missing or non-directory path is an error.
#[tauri::command]
pub fn skill_import_scan_dir(dir_path: String) -> Result<Vec<ImportCandidate>, String> {
    let root = PathBuf::from(&dir_path);
    if !root.is_dir() {
        return Err(format!("not a directory: {dir_path}"));
    }
    let canonical_dir = canonical_skills_dir();
    let mut out: Vec<ImportCandidate> = Vec::new();
    if let Some(cand) = candidate_from_skill_dir(&root, &canonical_dir) {
        out.push(cand);
        return Ok(out);
    }
    collect_zip_candidates_in(&root, &canonical_dir, &mut out);
    Ok(out)
}

fn infer_agent_from_frontmatter(raw: &str) -> Option<AgentId> {
    let (fm_text, _body) = split_frontmatter(raw);
    if fm_text.is_empty() {
        return None;
    }
    let value: serde_yaml::Value = serde_yaml::from_str(&fm_text).ok()?;
    let map = value.as_mapping()?;
    let agents = map.get(serde_yaml::Value::String("agents".into()))?;
    let first = agents.as_sequence()?.first()?;
    Some(first.as_str()?.to_string())
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
        let out = ensure_required_fields(raw, "auto-name", "anthropic").unwrap();
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
            source_path: format!("/fake/{}/{name}/SKILL.md", agent_label(&agent)),
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
            candidate("solo", "anthropic".to_string()),
            candidate("shared", "anthropic".to_string()),
            candidate("shared", "codex".to_string()),
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
        assert_eq!(def.agents, vec!["anthropic".to_string(), "codex".to_string()]);
        assert!(def.reason.contains("2 locations"), "reason: {}", def.reason);
        assert_eq!(
            def.candidates.len(),
            2,
            "multi-source row must preserve all source candidates"
        );
        assert_eq!(def.candidates[0].source_agent, "anthropic".to_string());
        assert_eq!(def.candidates[1].source_agent, "codex".to_string());

        let solo = &grouped[1];
        assert_eq!(solo.skill_name, "solo");
        assert!(
            solo.deferred.is_none(),
            "single-source must stay importable"
        );
    }

    #[test]
    fn group_by_name_preserves_three_source_candidate_previews() {
        let mut anthropic = candidate("shared", "anthropic".to_string());
        anthropic.body_preview = "# Anthropic".into();
        let mut codex = candidate("shared", "codex".to_string());
        codex.body_preview = "# Codex".into();
        let mut gemini = candidate("shared", "gemini".to_string());
        gemini.body_preview = "# Gemini".into();

        let grouped = group_by_name(vec![anthropic, codex, gemini]);
        let deferred = grouped[0].deferred.as_ref().expect("grouped row");

        assert_eq!(deferred.candidates.len(), 3);
        assert_eq!(deferred.candidates[0].body_preview, "# Anthropic");
        assert_eq!(deferred.candidates[1].body_preview, "# Codex");
        assert_eq!(deferred.candidates[2].body_preview, "# Gemini");
    }

    #[test]
    fn import_resolution_deserializes_select_source_camel_case_payload() {
        let raw = r#"{"kind":"selectSource","sourceIndex":1}"#;
        let resolution: ImportResolution = serde_json::from_str(raw).unwrap();

        match resolution {
            ImportResolution::SelectSource {
                source_index,
                new_name,
            } => {
                assert_eq!(source_index, 1);
                assert_eq!(new_name, None);
            }
            other => panic!("expected SelectSource, got {other:?}"),
        }
    }

    #[test]
    fn import_resolution_deserializes_select_source_rename_payload() {
        let raw = r#"{"kind":"selectSource","sourceIndex":1,"newName":"code-review-alt"}"#;
        let resolution: ImportResolution = serde_json::from_str(raw).unwrap();

        match resolution {
            ImportResolution::SelectSource {
                source_index,
                new_name,
            } => {
                assert_eq!(source_index, 1);
                assert_eq!(new_name.as_deref(), Some("code-review-alt"));
            }
            other => panic!("expected SelectSource, got {other:?}"),
        }
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

        let mut c = candidate("shared", "anthropic".to_string());
        c.deferred = Some(DeferredMultiSource {
            agents: vec!["anthropic".to_string(), "codex".to_string()],
            candidates: vec![
                candidate("shared", "anthropic".to_string()),
                candidate("shared", "codex".to_string()),
            ],
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

    #[test]
    fn select_source_imports_selected_candidate_content() {
        let home = unique_tmp("select-source-home");
        let sources = unique_tmp("select-source-src");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let anth_dir = sources.join(".claude").join("skills").join("code-review");
        let codex_dir = sources.join(".agents").join("skills").join("code-review");
        fs::create_dir_all(&anth_dir).unwrap();
        fs::create_dir_all(&codex_dir).unwrap();
        let anthropic_content =
            "---\nname: code-review\ndescription: a\nagents: [anthropic]\n---\n# Code Review - Review pull requests\n";
        let codex_content =
            "---\nname: code-review\ndescription: c\nagents: [codex]\n---\n# Code Review - Analyze code changes\n";
        fs::write(anth_dir.join("SKILL.md"), anthropic_content).unwrap();
        fs::write(codex_dir.join("SKILL.md"), codex_content).unwrap();

        let mut anthropic = candidate("code-review", "anthropic".to_string());
        anthropic.source_path = anth_dir.join("SKILL.md").to_string_lossy().to_string();
        let mut codex = candidate("code-review", "codex".to_string());
        codex.source_path = codex_dir.join("SKILL.md").to_string_lossy().to_string();
        let mut grouped = anthropic.clone();
        grouped.deferred = Some(DeferredMultiSource {
            agents: vec!["anthropic".to_string(), "codex".to_string()],
            candidates: vec![anthropic, codex],
            reason: "x".into(),
        });

        skill_import_apply(
            None,
            vec![ImportSelection {
                candidate: grouped,
                resolution: ImportResolution::SelectSource {
                    source_index: 0,
                    new_name: None,
                },
            }],
        )
        .expect("select source apply");

        let written = fs::read_to_string(
            home.join(".felina")
                .join("skills")
                .join("code-review")
                .join("SKILL.md"),
        )
        .expect("canonical written");
        assert!(written.contains("# Code Review - Review pull requests"));
        assert!(!written.contains("# Code Review - Analyze code changes"));
    }

    #[test]
    fn select_source_creates_disabled_targets_for_non_selected_sources() {
        let home = unique_tmp("select-source-targets-home");
        let sources = unique_tmp("select-source-targets-src");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let mut candidates = Vec::new();
        for (agent, root, body) in [
            ("anthropic".to_string(), ".claude", "anthropic body"),
            ("codex".to_string(), ".agents", "codex body"),
            ("gemini".to_string(), ".gemini", "gemini body"),
        ] {
            let dir = sources.join(root).join("skills").join("my-helper");
            fs::create_dir_all(&dir).unwrap();
            fs::write(
                dir.join("SKILL.md"),
                format!("---\nname: my-helper\ndescription: d\nagents: [{agent:?}]\n---\n{body}\n"),
            )
            .unwrap();
            let mut c = candidate("my-helper", agent);
            c.source_path = dir.join("SKILL.md").to_string_lossy().to_string();
            candidates.push(c);
        }

        let mut grouped = candidates[0].clone();
        grouped.deferred = Some(DeferredMultiSource {
            agents: vec!["anthropic".to_string(), "codex".to_string(), "gemini".to_string()],
            candidates,
            reason: "x".into(),
        });

        skill_import_apply(
            None,
            vec![ImportSelection {
                candidate: grouped,
                resolution: ImportResolution::SelectSource {
                    source_index: 0,
                    new_name: None,
                },
            }],
        )
        .expect("select source apply");

        let meta_raw = fs::read_to_string(
            home.join(".felina")
                .join("skills")
                .join("my-helper")
                .join(".felina-sync-meta.json"),
        )
        .expect("sidecar");
        let meta: serde_json::Value = serde_json::from_str(&meta_raw).unwrap();
        let targets = meta["targets"].as_array().expect("targets array");
        assert_eq!(targets.len(), 3, "selected + two disabled targets");
        assert_eq!(targets[0]["agent"], "anthropic");
        assert_eq!(targets[0]["enabled"], true);
        assert_eq!(targets[1]["agent"], "codex");
        assert_eq!(targets[1]["enabled"], false);
        assert_eq!(targets[1]["mode"], "manual");
        assert_eq!(targets[2]["agent"], "gemini");
        assert_eq!(targets[2]["enabled"], false);
        assert_eq!(targets[2]["mode"], "manual");
    }

    #[test]
    fn select_source_rename_writes_selected_content_under_new_name() {
        let home = unique_tmp("select-source-rename-home");
        let sources = unique_tmp("select-source-rename-src");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let anth_dir = sources.join(".claude").join("skills").join("code-review");
        let codex_dir = sources.join(".agents").join("skills").join("code-review");
        fs::create_dir_all(&anth_dir).unwrap();
        fs::create_dir_all(&codex_dir).unwrap();
        fs::write(
            anth_dir.join("SKILL.md"),
            "---\nname: code-review\ndescription: a\nagents: [anthropic]\n---\nanthropic body\n",
        )
        .unwrap();
        fs::write(
            codex_dir.join("SKILL.md"),
            "---\nname: code-review\ndescription: c\nagents: [codex]\n---\ncodex body\n",
        )
        .unwrap();

        let mut anthropic = candidate("code-review", "anthropic".to_string());
        anthropic.source_path = anth_dir.join("SKILL.md").to_string_lossy().to_string();
        let mut codex = candidate("code-review", "codex".to_string());
        codex.source_path = codex_dir.join("SKILL.md").to_string_lossy().to_string();
        let mut grouped = anthropic.clone();
        grouped.deferred = Some(DeferredMultiSource {
            agents: vec!["anthropic".to_string(), "codex".to_string()],
            candidates: vec![anthropic, codex],
            reason: "x".into(),
        });

        skill_import_apply(
            None,
            vec![ImportSelection {
                candidate: grouped,
                resolution: ImportResolution::SelectSource {
                    source_index: 0,
                    new_name: Some("code-review-alt".into()),
                },
            }],
        )
        .expect("select source rename apply");

        assert!(
            !home
                .join(".felina")
                .join("skills")
                .join("code-review")
                .exists(),
            "rename must not overwrite original canonical identity"
        );
        let renamed = home.join(".felina").join("skills").join("code-review-alt");
        let written = fs::read_to_string(renamed.join("SKILL.md")).expect("renamed canonical");
        assert!(written.contains("anthropic body"));
        assert!(renamed.join(".felina-sync-meta.json").is_file());
    }

    #[test]
    fn select_source_rejects_out_of_range_index() {
        let home = unique_tmp("select-source-range-home");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let mut grouped = candidate("shared", "anthropic".to_string());
        grouped.deferred = Some(DeferredMultiSource {
            agents: vec!["anthropic".to_string()],
            candidates: vec![candidate("shared", "anthropic".to_string())],
            reason: "x".into(),
        });

        let err = skill_import_apply(
            None,
            vec![ImportSelection {
                candidate: grouped,
                resolution: ImportResolution::SelectSource {
                    source_index: 9,
                    new_name: None,
                },
            }],
        )
        .unwrap_err();
        assert!(err.contains("source_index"), "got: {err}");
    }

    /// Task 2.1: BOM + CRLF source with missing `agents` preserves description
    /// and produces no nested frontmatter in the canonical body.
    #[test]
    fn ensure_required_fields_handles_bom_crlf_source() {
        let raw = "\u{feff}---\r\nname: session-start\r\ndescription: Start session context\r\n---\r\n# Body\r\n";
        let out = ensure_required_fields(raw, "session-start", "anthropic").unwrap();
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
        let out = ensure_required_fields(raw, "folder-name", "anthropic").unwrap();
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
        let err = ensure_required_fields(raw, "bad", "anthropic").unwrap_err();
        assert!(
            err.to_lowercase().contains("yaml") || err.contains("parse"),
            "should mention YAML error, got: {err}"
        );
    }

    /// Task 2.2: non-mapping frontmatter root is rejected.
    #[test]
    fn ensure_required_fields_rejects_non_mapping_root() {
        let raw = "---\n- list\n- items\n---\nbody\n";
        let err = ensure_required_fields(raw, "bad", "anthropic").unwrap_err();
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
        let err = ensure_required_fields(raw, "bad", "anthropic").unwrap_err();
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

        let mut c = candidate("bad-skill", "anthropic".to_string());
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

        let mut c = candidate("skill-a", "anthropic".to_string());
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

    /// Import a Claude Code source with `allowed-tools` and `effort` —
    /// after import, parse_skill_md classifies them into agent_fields.anthropic.
    #[test]
    fn import_claude_source_classifies_fields_into_anthropic() {
        let home = unique_tmp("classify-anthropic-home");
        let project = unique_tmp("classify-anthropic-proj");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let src_dir = project.join(".claude").join("skills").join("my-skill");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(
            src_dir.join("SKILL.md"),
            "---\nname: my-skill\ndescription: d\nagents:\n  - anthropic\nallowed-tools: Read Grep\neffort: high\n---\nbody\n",
        )
        .unwrap();

        let mut c = candidate("my-skill", "anthropic".to_string());
        c.source_path = src_dir.join("SKILL.md").to_string_lossy().to_string();
        skill_import_apply(None, vec![ImportSelection {
            candidate: c,
            resolution: ImportResolution::OverwriteCanonical,
        }])
        .expect("import");

        let canonical = fs::read_to_string(
            home.join(".felina").join("skills").join("my-skill").join("SKILL.md"),
        )
        .unwrap();
        let skill = crate::commands::canonical_skills::parse_skill_md(&canonical).unwrap();
        let anth = skill.agent_fields.get("anthropic").unwrap().as_mapping().unwrap();
        assert!(anth.contains_key(serde_yaml::Value::String("allowed-tools".into())));
        assert!(anth.contains_key(serde_yaml::Value::String("effort".into())));
    }

    /// Import a Codex source with agents/openai.yaml — fields are classified
    /// into agent_fields.codex.
    #[test]
    fn import_codex_source_classifies_openai_yaml_into_codex() {
        let home = unique_tmp("classify-codex-home");
        let project = unique_tmp("classify-codex-proj");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let src_dir = project.join(".agents").join("skills").join("helper");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(
            src_dir.join("SKILL.md"),
            "---\nname: helper\ndescription: d\n---\nbody\n",
        )
        .unwrap();
        let agents_dir = src_dir.join("agents");
        fs::create_dir_all(&agents_dir).unwrap();
        fs::write(
            agents_dir.join("openai.yaml"),
            "interface:\n  display_name: Helper Tool\n  short_description: A helper\npolicy:\n  allow_implicit_invocation: false\n",
        )
        .unwrap();

        let mut c = candidate("helper", "codex".to_string());
        c.source_path = src_dir.join("SKILL.md").to_string_lossy().to_string();
        skill_import_apply(None, vec![ImportSelection {
            candidate: c,
            resolution: ImportResolution::OverwriteCanonical,
        }])
        .expect("import");

        let canonical = fs::read_to_string(
            home.join(".felina").join("skills").join("helper").join("SKILL.md"),
        )
        .unwrap();
        let skill = crate::commands::canonical_skills::parse_skill_md(&canonical).unwrap();
        let codex = skill.agent_fields.get("codex").unwrap().as_mapping().unwrap();
        assert!(codex.contains_key(serde_yaml::Value::String("interface.display_name".into())));
        assert!(codex.contains_key(serde_yaml::Value::String("policy.allow_implicit_invocation".into())));
    }

    // ------------------------------------------------------------------
    // project_local_skill_rename / project_local_skill_delete
    // ------------------------------------------------------------------

    fn setup_project_skill(
        project: &Path,
        agent_subdir: &str,
        skill_name: &str,
        body: &str,
    ) -> PathBuf {
        let dir = project.join(agent_subdir).join("skills").join(skill_name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: {skill_name}\ndescription: d\nagents: [anthropic]\n---\n{body}\n"),
        )
        .unwrap();
        dir
    }

    fn felina_home_guard(tmp: &Path) -> impl Drop {
        crate::paths::set_felina_home_override_for_test(Some(tmp.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        G
    }

    #[test]
    fn rewrite_skill_md_name_updates_name_field_preserves_body() {
        let raw = "---\nname: old\ndescription: hi\nagents: [anthropic]\n---\n# Body content\nmore\n";
        let out = rewrite_skill_md_name(raw, "new-name").unwrap();
        assert!(out.contains("name: new-name"));
        assert!(!out.contains("name: old"));
        assert!(out.contains("# Body content"));
        assert!(out.contains("description: hi"));
    }

    #[test]
    fn rewrite_skill_md_name_rejects_missing_frontmatter() {
        let err = rewrite_skill_md_name("no frontmatter here", "new").unwrap_err();
        assert!(err.contains("frontmatter"));
    }

    #[test]
    fn project_local_rename_happy_path_updates_dir_and_frontmatter() {
        let tmp = unique_tmp("plrename-happy");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        fs::create_dir_all(&project).unwrap();
        setup_project_skill(&project, ".claude", "old-skill", "body");

        project_local_skill_rename(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "old-skill".into(),
            "new-skill".into(),
        )
        .expect("rename");

        let old_dir = project.join(".claude/skills/old-skill");
        let new_dir = project.join(".claude/skills/new-skill");
        assert!(!old_dir.exists());
        assert!(new_dir.is_dir());
        let md = fs::read_to_string(new_dir.join("SKILL.md")).unwrap();
        assert!(md.contains("name: new-skill"), "frontmatter updated: {md}");
        assert!(!md.contains("name: old-skill"));
    }

    #[test]
    fn project_local_rename_rejects_collision() {
        let tmp = unique_tmp("plrename-collision");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        fs::create_dir_all(&project).unwrap();
        setup_project_skill(&project, ".claude", "alpha", "a");
        setup_project_skill(&project, ".claude", "beta", "b");

        let err = project_local_skill_rename(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "alpha".into(),
            "beta".into(),
        )
        .unwrap_err();
        assert!(err.contains("already exists"), "got: {err}");
        // No mutation: alpha still there.
        assert!(project.join(".claude/skills/alpha").is_dir());
    }

    #[test]
    fn project_local_rename_rejects_traversal_and_empty() {
        for bad in ["", "..", "../escape", "a/b", "a\\b"] {
            let err = project_local_skill_rename(
                "/tmp/x".into(),
                "anthropic".to_string(),
                "ok".into(),
                bad.into(),
            )
            .unwrap_err();
            assert!(
                err.contains("empty") || err.contains("separator") || err.contains("'..'"),
                "input {bad:?} → {err}"
            );
        }
    }

    #[test]
    fn project_local_rename_missing_source_returns_err() {
        let tmp = unique_tmp("plrename-missing");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        fs::create_dir_all(project.join(".claude/skills")).unwrap();
        let err = project_local_skill_rename(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "ghost".into(),
            "new".into(),
        )
        .unwrap_err();
        assert!(err.contains("not found"), "got: {err}");
    }

    #[test]
    fn project_local_rename_rolls_back_on_malformed_frontmatter() {
        let tmp = unique_tmp("plrename-rollback");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        let dir = project.join(".claude/skills/broken");
        fs::create_dir_all(&dir).unwrap();
        // No frontmatter at all → rewrite_skill_md_name returns Err → rollback.
        fs::write(dir.join("SKILL.md"), "no frontmatter body").unwrap();

        let err = project_local_skill_rename(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "broken".into(),
            "fixed".into(),
        )
        .unwrap_err();
        assert!(err.contains("frontmatter"), "got: {err}");
        // Rollback restored original dir.
        assert!(project.join(".claude/skills/broken").is_dir());
        assert!(!project.join(".claude/skills/fixed").exists());
    }

    #[test]
    fn project_local_delete_happy_path_removes_directory() {
        let tmp = unique_tmp("pldelete-happy");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        fs::create_dir_all(&project).unwrap();
        setup_project_skill(&project, ".claude", "doomed", "x");

        project_local_skill_delete(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "doomed".into(),
        )
        .expect("delete");
        assert!(!project.join(".claude/skills/doomed").exists());
    }

    #[test]
    fn project_local_delete_missing_dir_is_idempotent() {
        let tmp = unique_tmp("pldelete-idempotent");
        let _g = felina_home_guard(&tmp);
        let project = tmp.join("proj");
        fs::create_dir_all(project.join(".claude/skills")).unwrap();

        project_local_skill_delete(
            project.to_string_lossy().to_string(),
            "anthropic".to_string(),
            "never-existed".into(),
        )
        .expect("idempotent");
    }

    #[test]
    fn project_local_delete_rejects_traversal() {
        for bad in ["", "..", "../etc", "a/b", "a\\b"] {
            let err = project_local_skill_delete(
                "/tmp/x".into(),
                "anthropic".to_string(),
                bad.into(),
            )
            .unwrap_err();
            assert!(
                err.contains("empty") || err.contains("separator") || err.contains("'..'"),
                "input {bad:?} → {err}"
            );
        }
    }

    /// Import a Gemini source — no synthetic optional fields created.
    #[test]
    fn import_gemini_source_creates_no_synthetic_fields() {
        let home = unique_tmp("classify-gemini-home");
        let project = unique_tmp("classify-gemini-proj");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let src_dir = project.join(".gemini").join("skills").join("gem-skill");
        fs::create_dir_all(&src_dir).unwrap();
        fs::write(
            src_dir.join("SKILL.md"),
            "---\nname: gem-skill\ndescription: d\nagents:\n  - gemini\n---\nbody\n",
        )
        .unwrap();

        let mut c = candidate("gem-skill", "gemini".to_string());
        c.source_path = src_dir.join("SKILL.md").to_string_lossy().to_string();
        skill_import_apply(None, vec![ImportSelection {
            candidate: c,
            resolution: ImportResolution::OverwriteCanonical,
        }])
        .expect("import");

        let canonical = fs::read_to_string(
            home.join(".felina").join("skills").join("gem-skill").join("SKILL.md"),
        )
        .unwrap();
        let skill = crate::commands::canonical_skills::parse_skill_md(&canonical).unwrap();
        assert!(skill.agent_fields.is_empty(), "gemini import should not create agent_fields");
    }

    /// `skill_import_scan_zip` extracts a ZIP to a temp directory and returns
    /// candidates only for top-level dirs that contain `SKILL.md`. Canonical
    /// is NOT written and dirs without `SKILL.md` are skipped.
    #[test]
    fn skill_import_scan_zip_extracts_and_skips_invalid_dirs() {
        use std::io::Write;
        let home = unique_tmp("zip-scan-home");
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        struct G;
        impl Drop for G {
            fn drop(&mut self) {
                crate::paths::set_felina_home_override_for_test(None);
            }
        }
        let _g = G;

        let tmp = unique_tmp("zip-scan-src");
        let zip_path = tmp.join("payload.zip");
        let file = fs::File::create(&zip_path).unwrap();
        let mut zw = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default();
        zw.start_file("good-skill/SKILL.md", opts).unwrap();
        zw.write_all(b"---\nname: good-skill\ndescription: hi\nagents: [gemini]\n---\n# Body\n")
            .unwrap();
        zw.start_file("bad-dir/README.md", opts).unwrap();
        zw.write_all(b"# Not a skill").unwrap();
        zw.finish().unwrap();

        let out = skill_import_scan_zip(zip_path.to_string_lossy().to_string()).expect("scan");
        assert_eq!(out.len(), 1, "only good-skill is a valid candidate, got {out:#?}");
        let cand = &out[0];
        assert_eq!(cand.skill_name, "good-skill");
        assert_eq!(cand.source_agent, "gemini".to_string(), "agent inferred from frontmatter");
        assert!(cand.conflict.is_none(), "no canonical conflict yet");
        // Canonical must NOT have been written.
        assert!(
            !home.join(".felina").join("skills").join("good-skill").exists(),
            "scan must not write canonical"
        );
    }

    /// `collect_candidates_in` SHALL normalize `source_path` and
    /// `conflict.canonical_path` for display: no backslashes, no trailing
    /// slash, original case preserved.
    #[test]
    fn collect_candidates_normalizes_source_and_conflict_paths_for_display() {
        let tmp = unique_tmp("normalize-display");
        let source_dir = tmp.join("MixedCase").join(".claude").join("skills").join("MySkill");
        fs::create_dir_all(&source_dir).expect("mkdir source");
        let source_skill = source_dir.join("SKILL.md");
        fs::write(
            &source_skill,
            "---\nname: MySkill\ndescription: d\nagents: [anthropic]\n---\nbody\n",
        )
        .expect("write source");

        let canonical_dir = tmp.join("Felina").join("skills");
        let canonical_skill_dir = canonical_dir.join("MySkill");
        fs::create_dir_all(&canonical_skill_dir).expect("mkdir canonical");
        fs::write(
            canonical_skill_dir.join("SKILL.md"),
            "---\nname: MySkill\ndescription: existing\nagents: [anthropic]\n---\nother\n",
        )
        .expect("write canonical");

        let agent_skills_root = tmp.join("MixedCase").join(".claude").join("skills");
        let mut out = Vec::new();
        collect_candidates_in(&agent_skills_root, "anthropic".to_string(), &canonical_dir, &mut out);

        assert_eq!(out.len(), 1, "expected one candidate, got {out:?}");
        let cand = &out[0];
        assert!(
            !cand.source_path.contains('\\'),
            "source_path must not contain backslashes: {}",
            cand.source_path
        );
        assert!(
            cand.source_path.contains("MixedCase") && cand.source_path.contains("MySkill"),
            "case must be preserved: {}",
            cand.source_path
        );
        let conflict = cand.conflict.as_ref().expect("expected conflict against canonical");
        assert!(
            !conflict.canonical_path.contains('\\'),
            "canonical_path must not contain backslashes: {}",
            conflict.canonical_path
        );
        assert!(
            conflict.canonical_path.contains("Felina") && conflict.canonical_path.contains("MySkill"),
            "canonical_path case must be preserved: {}",
            conflict.canonical_path
        );
    }

    /// Guard that points `canonical_skills_dir()` at a temp home for the
    /// duration of a test, mirroring the zip-scan test setup.
    struct FelinaHomeGuard;
    impl Drop for FelinaHomeGuard {
        fn drop(&mut self) {
            crate::paths::set_felina_home_override_for_test(None);
        }
    }
    fn override_felina_home(label: &str) -> (PathBuf, FelinaHomeGuard) {
        let home = unique_tmp(label);
        crate::paths::set_felina_home_override_for_test(Some(home.join(".felina")));
        (home, FelinaHomeGuard)
    }

    /// `skill_import_scan_dir` resolution rule 1: the selected directory
    /// itself contains a `SKILL.md` → exactly one candidate named after
    /// the selected directory.
    #[test]
    fn skill_import_scan_dir_selected_dir_is_itself_a_skill() {
        let (_home, _g) = override_felina_home("scan-dir-self-home");
        let tmp = unique_tmp("scan-dir-self");
        let skill_dir = tmp.join("my-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: my-skill\ndescription: d\nagents: [gemini]\n---\nbody\n",
        )
        .unwrap();

        let out = skill_import_scan_dir(skill_dir.to_string_lossy().to_string()).expect("scan");
        assert_eq!(out.len(), 1, "exactly one candidate, got {out:#?}");
        assert_eq!(out[0].skill_name, "my-skill", "named after selected directory");
        assert_eq!(out[0].source_agent, "gemini".to_string(), "agent inferred from frontmatter");
        assert!(out[0].conflict.is_none());
    }

    /// Resolution rule 2: selected directory is a parent — scan first-level
    /// subdirectories only; entries without `SKILL.md` are skipped.
    /// Mirrors the spec example: alpha/SKILL.md, beta/SKILL.md, notes/readme.txt,
    /// stray.md → candidates alpha and beta only.
    #[test]
    fn skill_import_scan_dir_parent_collects_first_level_skill_subdirs() {
        let (_home, _g) = override_felina_home("scan-dir-parent-home");
        let tmp = unique_tmp("scan-dir-parent");
        for name in ["alpha", "beta"] {
            let d = tmp.join(name);
            fs::create_dir_all(&d).unwrap();
            fs::write(
                d.join("SKILL.md"),
                format!("---\nname: {name}\ndescription: d\nagents: [anthropic]\n---\nbody\n"),
            )
            .unwrap();
        }
        fs::create_dir_all(tmp.join("notes")).unwrap();
        fs::write(tmp.join("notes").join("readme.txt"), "not a skill").unwrap();
        fs::write(tmp.join("stray.md"), "loose file").unwrap();
        // Nested skill below first level must NOT be picked up.
        let nested = tmp.join("notes").join("deep");
        fs::create_dir_all(&nested).unwrap();
        fs::write(
            nested.join("SKILL.md"),
            "---\nname: deep\ndescription: d\nagents: [anthropic]\n---\nbody\n",
        )
        .unwrap();

        let out = skill_import_scan_dir(tmp.to_string_lossy().to_string()).expect("scan");
        let mut names: Vec<_> = out.iter().map(|c| c.skill_name.clone()).collect();
        names.sort();
        assert_eq!(names, ["alpha", "beta"], "got {out:#?}");
    }

    /// Resolution rule 3: no SKILL.md anywhere at the allowed depths →
    /// Ok with an empty list, not an error.
    #[test]
    fn skill_import_scan_dir_no_skills_returns_empty_ok() {
        let (_home, _g) = override_felina_home("scan-dir-empty-home");
        let tmp = unique_tmp("scan-dir-empty");
        fs::create_dir_all(tmp.join("nothing-here")).unwrap();

        let out = skill_import_scan_dir(tmp.to_string_lossy().to_string()).expect("scan");
        assert!(out.is_empty(), "expected empty, got {out:#?}");
    }

    /// Nonexistent path or a file (not a directory) → Err string.
    #[test]
    fn skill_import_scan_dir_rejects_missing_or_non_directory_path() {
        let (_home, _g) = override_felina_home("scan-dir-bad-home");
        let tmp = unique_tmp("scan-dir-bad");

        let missing = tmp.join("no-such-dir");
        assert!(skill_import_scan_dir(missing.to_string_lossy().to_string()).is_err());

        let file_path = tmp.join("a-file.txt");
        fs::write(&file_path, "x").unwrap();
        assert!(skill_import_scan_dir(file_path.to_string_lossy().to_string()).is_err());
    }

    /// Same-named canonical skill → candidate carries ConflictInfo, on the
    /// same path as zip / agent-directory candidates.
    #[test]
    fn skill_import_scan_dir_detects_canonical_conflict() {
        let (home, _g) = override_felina_home("scan-dir-conflict-home");
        let canonical = home.join(".felina").join("skills").join("dup-skill");
        fs::create_dir_all(&canonical).unwrap();
        fs::write(
            canonical.join("SKILL.md"),
            "---\nname: dup-skill\ndescription: existing\nagents: [anthropic]\n---\nold\n",
        )
        .unwrap();

        let tmp = unique_tmp("scan-dir-conflict");
        let skill_dir = tmp.join("dup-skill");
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: dup-skill\ndescription: incoming\nagents: [anthropic]\n---\nnew\n",
        )
        .unwrap();

        let out = skill_import_scan_dir(skill_dir.to_string_lossy().to_string()).expect("scan");
        assert_eq!(out.len(), 1);
        assert!(out[0].conflict.is_some(), "expected conflict info, got {out:#?}");
    }
}
