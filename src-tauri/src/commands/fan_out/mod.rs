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
    canonical_skills_dir, parse_skill_md, read_sync_meta_v2, target_key,
    write_sync_meta_v2, AgentId, CanonicalSkill, LastSyncEntry, SkillScope, TargetMode,
};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};

pub mod anthropic;
pub mod codex;
pub mod gemini;

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

/// One render-and-write pass for a single agent.
pub trait FanOutRenderer {
    /// The agent this renderer handles. Useful for debugging / future
    /// renderer-driven dispatch; current dispatch in [`skill_sync_one`]
    /// already knows the agent from the canonical `agents` field.
    #[allow(dead_code)]
    fn agent_id(&self) -> AgentId;

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
    agent: AgentId,
) -> &'a super::agent_paths::AgentPathPair {
    match agent {
        AgentId::Anthropic => &cfg.anthropic,
        AgentId::Codex => &cfg.codex,
        AgentId::Gemini => &cfg.gemini,
    }
}

fn renderer_for(agent: AgentId) -> Box<dyn FanOutRenderer> {
    match agent {
        AgentId::Anthropic => Box::new(anthropic::AnthropicRenderer),
        AgentId::Codex => Box::new(codex::CodexRenderer),
        AgentId::Gemini => Box::new(gemini::GeminiRenderer),
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

        let renderer = renderer_for(target.agent);
        let pair = pair_for(&cfg, target.agent);
        let target_dir =
            match renderer.resolve_target_dir(target.scope, target.project.as_deref(), pair) {
                Ok(d) => d,
                Err(e) => {
                    results.push(SyncResult {
                        agent: target.agent,
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
        let render_result = renderer.render(&skill, &target_dir);
        let final_result = match render_result {
            Ok(()) => copy_bundled_siblings(&canonical_skill_dir, &target_skill_dir),
            Err(e) => Err(e),
        };

        match final_result {
            Ok(()) => {
                // Record per-target last_sync entry: hash the rendered
                // SKILL.md so future drift checks can compare hash equality.
                let rendered =
                    fs::read_to_string(target_skill_dir.join("SKILL.md")).unwrap_or_default();
                let key = target_key(&target);
                meta.last_sync.insert(
                    key.clone(),
                    LastSyncEntry {
                        pushed_hash: sha256_hex(&rendered),
                        base_snapshot: None,
                        at: attempted_at.clone(),
                    },
                );
                written_keys.push(key);
                results.push(SyncResult {
                    agent: target.agent,
                    scope: target.scope,
                    target_path: target_skill_dir.to_string_lossy().to_string(),
                    success: true,
                    error: None,
                    at: attempted_at.clone(),
                });
            }
            Err(e) => results.push(SyncResult {
                agent: target.agent,
                scope: target.scope,
                target_path: target_skill_dir.to_string_lossy().to_string(),
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

fn sha256_hex(data: &str) -> String {
    let mut h = Sha256::new();
    h.update(data.as_bytes());
    format!("{:x}", h.finalize())
}

/// Sync every canonical skill in the global canonical dir. Skips broken skills.
#[tauri::command]
pub fn skill_sync_all() -> Result<Vec<SyncResult>, String> {
    let entries = super::canonical_skills::canonical_skills_list()?;
    let mut out = Vec::new();
    for entry in entries {
        if let super::canonical_skills::SkillListEntry::Ok { canonical_id, skill } = entry {
            // Re-use skill_sync_one for consistent semantics (meta update etc).
            match skill_sync_one(canonical_id) {
                Ok(mut r) => out.append(&mut r),
                Err(e) => {
                    // Pre-render failure (e.g. missing file): surface as a
                    // single result tagged to the first agent so the UI has
                    // somewhere to render the error. Scope is Global because
                    // canonical now lives there exclusively.
                    let agent = skill.agents.first().copied().unwrap_or(AgentId::Anthropic);
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
    let pair = pair_for(&cfg, agent);
    let target_dir = resolve_pair(scope, project.as_deref(), pair)?;
    let dir = target_dir.join(&skill_name);
    let exists = dir.is_dir();
    Ok(TargetDirInfo {
        path: dir.to_string_lossy().to_string(),
        exists,
    })
}

/// Best-effort ISO-8601 UTC timestamp without pulling chrono. Format:
/// `YYYY-MM-DDTHH:MM:SSZ` derived from `SystemTime`.
fn current_iso8601() -> String {
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
            return home.join(rest);
        }
    }
    if p == "~" {
        return dirs::home_dir().unwrap_or_else(|| PathBuf::from(p));
    }
    PathBuf::from(p)
}

/// Resolve a path pair into a concrete target directory using the same rule
/// for every agent: `global` scope → expand-user on `pair.global`;
/// `project` scope → join `pair.project_relative` onto `project_path`.
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
        canonical_skills_list, canonical_skills_write, write_sync_meta_v2,
        SkillListEntry, SkillScope, SkillTarget, SyncMetaV2, TargetMode,
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
                    SkillTarget { agent: AgentId::Anthropic, scope: SkillScope::Project, project: Some(project.clone()), enabled: true, mode: TargetMode::Tracked },
                    SkillTarget { agent: AgentId::Codex,     scope: SkillScope::Project, project: Some(project.clone()), enabled: true, mode: TargetMode::Tracked },
                    SkillTarget { agent: AgentId::Gemini,    scope: SkillScope::Project, project: Some(project.clone()), enabled: true, mode: TargetMode::Tracked },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
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

        let target_roots = [
            tmp.join(".claude").join("skills").join("smoke-fanout"),
            tmp.join(".agents").join("skills").join("smoke-fanout"),
            tmp.join(".gemini").join("skills").join("smoke-fanout"),
        ];
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
        // targets: one disabled (anthropic), one detached (codex), one
        // tracked enabled (gemini). Only gemini should be written.
        let tmp = smoke_tempdir("skip");
        let _g = override_felina_home(&tmp);
        make_canonical("skip-targets", &["anthropic"]);

        let canonical_skill_dir = tmp.join(".felina").join("skills").join("skip-targets");
        let project = tmp.to_string_lossy().to_string();

        let sidecar = serde_json::json!({
            "version": 2,
            "targets": [
                { "agent": "anthropic", "scope": "project", "project": project, "enabled": false, "mode": "tracked" },
                { "agent": "codex",     "scope": "project", "project": project, "enabled": true,  "mode": "detached" },
                { "agent": "gemini",    "scope": "project", "project": project, "enabled": true,  "mode": "tracked" }
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

        // Only gemini should produce a SyncResult.
        assert_eq!(results.len(), 1, "expected one result, got {results:#?}");
        assert_eq!(results[0].agent, AgentId::Gemini);
        assert!(
            results[0].success,
            "gemini push failed: {:?}",
            results[0].error
        );

        // Target dirs: anthropic + codex must NOT exist on disk.
        assert!(
            !tmp.join(".claude")
                .join("skills")
                .join("skip-targets")
                .exists(),
            "anthropic (disabled) target was written",
        );
        assert!(
            !tmp.join(".agents")
                .join("skills")
                .join("skip-targets")
                .exists(),
            "codex (detached) target was written",
        );
        assert!(
            tmp.join(".gemini")
                .join("skills")
                .join("skip-targets")
                .join("SKILL.md")
                .is_file(),
            "gemini (tracked enabled) target NOT written",
        );

        // last_sync should ONLY have the gemini entry.
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
        let gemini_key = format!("gemini:project:{}", project);
        assert!(
            last_sync.contains_key(&gemini_key),
            "missing key {gemini_key} in {last_sync:?}"
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
                    SkillTarget { agent: AgentId::Anthropic, scope: SkillScope::Project, project: Some(project.clone()), enabled: true, mode: TargetMode::Tracked },
                    SkillTarget { agent: AgentId::Gemini,    scope: SkillScope::Project, project: Some(project.clone()), enabled: true, mode: TargetMode::Tracked },
                ],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
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
            SkillListEntry::Ok { skill, .. } => assert!(skill.dirty, "expected dirty=true before push"),
            other => panic!("expected Ok entry, got {other:?}"),
        }

        let results = skill_sync_one("smoke-dirty".into()).expect("sync");
        assert!(results.iter().all(|r| r.success), "push failed: {results:#?}");

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
        assert!(parse_skill_md(broken_content).is_err(), "fixture must be unparseable");

        // Give it a tracked target so, absent the guard, push would write.
        let project = tmp.to_string_lossy().to_string();
        write_sync_meta_v2(
            &broken_dir,
            &SyncMetaV2 {
                version: 2,
                targets: vec![SkillTarget {
                    agent: AgentId::Anthropic,
                    scope: SkillScope::Project,
                    project: Some(project),
                    enabled: true,
                    mode: TargetMode::Tracked,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
            },
        )
        .unwrap();

        // sync_one must error (parse gate), not push.
        let one = skill_sync_one("broken-push".into());
        assert!(one.is_err(), "broken skill must not push via sync_one: {one:?}");

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
                    agent: AgentId::Anthropic,
                    scope: SkillScope::Project,
                    project: Some(project.clone()),
                    enabled: true,
                    mode: TargetMode::Tracked,
                }],
                last_sync: std::collections::BTreeMap::new(),
                dirty: true,
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
            AgentId::Anthropic,
            SkillScope::Project,
            Some(project.clone()),
        )
        .expect("resolve");
        assert!(!before.exists, "destination should not exist before push");
        assert!(
            before.path.replace('\\', "/").ends_with(".claude/skills/smoke-nested"),
            "path must use canonical identity: {}",
            before.path,
        );

        // Create the destination; existence flips true.
        let dest = tmp.join(".claude").join("skills").join("smoke-nested");
        fs::create_dir_all(&dest).unwrap();
        let after = skill_target_dir_resolve(
            "smoke-nested".into(),
            AgentId::Anthropic,
            SkillScope::Project,
            Some(project),
        )
        .expect("resolve");
        assert!(after.exists, "destination should exist after creation");
    }
}
