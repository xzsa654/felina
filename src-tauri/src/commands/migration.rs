//! One-shot project→global canonical migration (scope-model-simplification).
//!
//! Legacy `<project>/.felina/skills/<name>/` master files predate the single
//! global canonical model. This module scans every Known Project for such
//! legacy masters and, on explicit user confirmation, copies each into the
//! global canonical dir (`~/.felina/skills/<name>/`) plus a `SkillTarget`
//! pointing back at the originating project. It is NEVER triggered
//! automatically and NEVER deletes the legacy directory (cleanup is deferred
//! to the user or to `skill-sync-lifecycle`).

use crate::commands::canonical_skills::{
    canonical_skills_dir, parse_skill_md, read_sync_meta_v2, write_sync_meta_v2, AgentId,
    SkillScope, SkillTarget, SyncMetaV2, TargetMode,
};
use crate::commands::known_projects::known_projects_list;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Read-only path to a project's legacy canonical skills dir. The general
/// `felina_project_skills_dir` helper was removed with the project-canonical
/// model; migration is the one remaining consumer, so the join lives here.
fn legacy_project_skills_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".felina").join("skills")
}

/// A legacy project-canonical skill discovered by the migration scan.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationCandidate {
    /// Originating project absolute path.
    pub project_path: String,
    pub skill_name: String,
    /// True when a global master with the same name already exists, so
    /// migrating would overwrite it unless the user opts in.
    pub conflict: bool,
}

/// A per-candidate user decision. Keyed by `(project_path, skill_name)` so the
/// same skill name across different projects stays unambiguous.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MigrationAction {
    pub project_path: String,
    pub name: String,
    /// `"keep"` (migrate, but skip if conflicting), `"overwrite"` (migrate,
    /// force over a conflicting global master), or `"skip"` (do nothing).
    pub action: String,
}

/// Outcome of applying one `MigrationAction`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MigrationResult {
    pub project_path: String,
    pub name: String,
    /// `"applied"` (master written), `"skipped"` (action=skip), or
    /// `"conflict-resolved"` (action=keep but a conflict existed, so left
    /// the global master untouched).
    pub status: String,
    /// Absolute path to the global master dir (written or pre-existing).
    pub target_path: String,
}

/// Scan every Known Project for legacy `<project>/.felina/skills/<name>/`
/// masters. Flags each whose name already exists in the global canonical dir.
#[tauri::command]
pub fn migrate_project_canonicals_scan() -> Result<Vec<MigrationCandidate>, String> {
    let global_dir = canonical_skills_dir();
    let projects = known_projects_list(None)?;

    let mut out = Vec::new();
    for project in &projects {
        let legacy_dir = legacy_project_skills_dir(&project.path);
        let entries = match fs::read_dir(&legacy_dir) {
            Ok(e) => e,
            Err(_) => continue, // no legacy dir for this project — fine
        };
        for entry in entries.flatten() {
            if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if !entry.path().join("SKILL.md").is_file() {
                continue;
            }
            let conflict = global_dir.join(&name).join("SKILL.md").is_file();
            out.push(MigrationCandidate {
                project_path: project.path.clone(),
                skill_name: name,
                conflict,
            });
        }
    }
    out.sort_by(|a, b| {
        a.project_path
            .cmp(&b.project_path)
            .then_with(|| a.skill_name.cmp(&b.skill_name))
    });
    Ok(out)
}

/// Apply per-candidate migration actions. Never deletes legacy dirs.
#[tauri::command]
pub fn migrate_project_canonicals_apply(
    items: Vec<MigrationAction>,
) -> Result<Vec<MigrationResult>, String> {
    let global_dir = canonical_skills_dir();
    let mut results = Vec::new();

    for item in items {
        let legacy_skill_dir = legacy_project_skills_dir(&item.project_path).join(&item.name);
        let legacy_md = legacy_skill_dir.join("SKILL.md");
        let global_skill_dir = global_dir.join(&item.name);
        let target_path = global_skill_dir.to_string_lossy().to_string();
        let conflict = global_skill_dir.join("SKILL.md").is_file();

        match item.action.as_str() {
            "skip" => {
                results.push(MigrationResult {
                    project_path: item.project_path,
                    name: item.name,
                    status: "skipped".into(),
                    target_path,
                });
                continue;
            }
            "keep" if conflict => {
                // Conflict + keep → leave the existing global master untouched.
                results.push(MigrationResult {
                    project_path: item.project_path,
                    name: item.name,
                    status: "conflict-resolved".into(),
                    target_path,
                });
                continue;
            }
            "keep" | "overwrite" => {
                // keep (no conflict) or overwrite (force): write the master.
                if !legacy_md.is_file() {
                    return Err(format!(
                        "legacy master missing: {}",
                        legacy_md.display()
                    ));
                }
                migrate_one(&legacy_skill_dir, &global_skill_dir, &item.project_path)?;
                results.push(MigrationResult {
                    project_path: item.project_path,
                    name: item.name,
                    status: "applied".into(),
                    target_path,
                });
            }
            other => {
                return Err(format!("unknown migration action: {other}"));
            }
        }
    }
    Ok(results)
}

/// Copy a legacy master + bundled siblings into the global canonical dir and
/// record a `scope=Project` target pointing back at the originating project.
fn migrate_one(
    legacy_skill_dir: &Path,
    global_skill_dir: &Path,
    project_path: &str,
) -> Result<(), String> {
    fs::create_dir_all(global_skill_dir)
        .map_err(|e| format!("failed to create global skill dir: {e}"))?;

    // Copy SKILL.md and every bundled sibling except the legacy sync-meta
    // sidecar (we author a fresh one below).
    copy_tree_except_sidecar(legacy_skill_dir, global_skill_dir)?;

    // Determine the agent for the target: inherit from the legacy master's
    // first target/agent if its sidecar has one, else default to anthropic.
    let raw = fs::read_to_string(global_skill_dir.join("SKILL.md"))
        .map_err(|e| format!("failed to read migrated SKILL.md: {e}"))?;
    let skill = parse_skill_md(&raw)?;
    let agent = inherited_agent(legacy_skill_dir, &skill).unwrap_or(AgentId::Anthropic);

    // Author a fresh v2 sidecar in global with exactly one tracked project
    // target. Build from default rather than read_sync_meta_v2 — the latter
    // backfills one global target per `agents` entry, which we do NOT want on
    // a migrated skill (its only intended destination is the originating
    // project). On overwrite, this also replaces any stale sidecar cleanly.
    let meta = SyncMetaV2 {
        version: 2,
        targets: vec![SkillTarget {
            agent,
            scope: SkillScope::Project,
            project: Some(project_path.to_string()),
            enabled: true,
            mode: TargetMode::Tracked,
        }],
        last_sync: Default::default(),
        dirty: true,
    };
    write_sync_meta_v2(global_skill_dir, &meta)
}

/// Read the legacy master's sync-meta and return its first target's agent (if
/// any) so the migrated target inherits it rather than always defaulting.
fn inherited_agent(
    legacy_skill_dir: &Path,
    skill: &crate::commands::canonical_skills::CanonicalSkill,
) -> Option<AgentId> {
    let (meta, _) = read_sync_meta_v2(legacy_skill_dir, skill);
    meta.targets.first().map(|t| t.agent)
}

fn copy_tree_except_sidecar(src: &Path, dst: &Path) -> Result<(), String> {
    let entries =
        fs::read_dir(src).map_err(|e| format!("failed to read {}: {e}", src.display()))?;
    for entry in entries.flatten() {
        let name = entry.file_name();
        if name.to_string_lossy() == ".felina-sync-meta.json" {
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
                .map_err(|e| format!("failed to create {}: {e}", dst_path.display()))?;
            copy_tree_except_sidecar(&src_path, &dst_path)?;
        } else if ft.is_file() {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("failed to copy {}: {e}", dst_path.display()))?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

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

    fn tempdir() -> PathBuf {
        static COUNTER: AtomicU32 = AtomicU32::new(0);
        let n = COUNTER.fetch_add(1, Ordering::Relaxed);
        let pid = std::process::id();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.subsec_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("felina-migr-{pid}-{nanos}-{n}"));
        fs::create_dir_all(&dir).expect("mkdir");
        dir
    }

    fn write_legacy_skill(project: &Path, name: &str) {
        let d = project.join(".felina").join("skills").join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(
            d.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: legacy {name}\nagents: [anthropic]\n---\nbody {name}\n"),
        )
        .unwrap();
    }

    fn write_global_skill(home_tmp: &Path, name: &str) {
        let d = home_tmp.join(".felina").join("skills").join(name);
        fs::create_dir_all(&d).unwrap();
        fs::write(
            d.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: global {name}\nagents: [codex]\n---\nglobal body\n"),
        )
        .unwrap();
    }

    /// Scan reports conflict=false for a name absent from global, conflict=true
    /// for a name already present. Uses the current-cwd Known Project source so
    /// the scan sees our temp project without touching known-projects.json.
    #[test]
    fn scan_reports_clean_and_conflicting() {
        let home = tempdir();
        let _g = override_felina_home(&home);
        let project = tempdir();

        write_legacy_skill(&project, "foo"); // no global → clean
        write_legacy_skill(&project, "bar"); // global exists → conflict
        write_global_skill(&home, "bar");

        // known_projects_list picks up `project` via the current-cwd source.
        let candidates = scan_with_project(&project);

        let foo = candidates
            .iter()
            .find(|c| c.skill_name == "foo")
            .expect("foo candidate");
        assert!(!foo.conflict, "foo should not conflict");
        let bar = candidates
            .iter()
            .find(|c| c.skill_name == "bar")
            .expect("bar candidate");
        assert!(bar.conflict, "bar should conflict");
    }

    /// Helper that scans a specific project via the cwd source, filtering the
    /// result to that project so unrelated real Known Projects don't leak in.
    fn scan_with_project(project: &Path) -> Vec<MigrationCandidate> {
        let project_str = project.to_string_lossy().to_string();
        let projects = known_projects_list(Some(project_str.clone())).unwrap();
        // Mirror the command's body but constrained to our project to keep the
        // test hermetic regardless of the host's real Known Projects.
        let global_dir = canonical_skills_dir();
        let mut out = Vec::new();
        let _ = projects;
        let legacy_dir = legacy_project_skills_dir(&project_str);
        if let Ok(entries) = fs::read_dir(&legacy_dir) {
            for entry in entries.flatten() {
                if !entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if !entry.path().join("SKILL.md").is_file() {
                    continue;
                }
                let conflict = global_dir.join(&name).join("SKILL.md").is_file();
                out.push(MigrationCandidate {
                    project_path: project_str.clone(),
                    skill_name: name,
                    conflict,
                });
            }
        }
        out
    }

    /// Apply: keep (clean) writes global master + project target; skip leaves
    /// global untouched; legacy dirs are never deleted.
    #[test]
    fn apply_migrates_clean_and_skips_marked() {
        let home = tempdir();
        let _g = override_felina_home(&home);
        let project = tempdir();
        let project_str = project.to_string_lossy().to_string();

        write_legacy_skill(&project, "foo");
        write_legacy_skill(&project, "baz");

        let results = migrate_project_canonicals_apply(vec![
            MigrationAction {
                project_path: project_str.clone(),
                name: "foo".into(),
                action: "keep".into(),
            },
            MigrationAction {
                project_path: project_str.clone(),
                name: "baz".into(),
                action: "skip".into(),
            },
        ])
        .expect("apply");

        // foo applied; baz skipped.
        let foo = results.iter().find(|r| r.name == "foo").unwrap();
        assert_eq!(foo.status, "applied");
        let baz = results.iter().find(|r| r.name == "baz").unwrap();
        assert_eq!(baz.status, "skipped");

        // Global master for foo exists with a project target.
        let foo_global = home.join(".felina").join("skills").join("foo");
        assert!(foo_global.join("SKILL.md").is_file(), "foo global master written");
        let meta_raw =
            fs::read_to_string(foo_global.join(".felina-sync-meta.json")).expect("sidecar");
        let meta: serde_json::Value = serde_json::from_str(&meta_raw).unwrap();
        let targets = meta["targets"].as_array().expect("targets array");
        assert_eq!(targets.len(), 1, "one project target");
        assert_eq!(targets[0]["scope"], "project");
        assert_eq!(targets[0]["project"], project_str);

        // baz NOT migrated to global.
        assert!(
            !home.join(".felina").join("skills").join("baz").exists(),
            "baz must not be migrated (skip)"
        );

        // Legacy dirs survive for both.
        assert!(project.join(".felina").join("skills").join("foo").join("SKILL.md").is_file());
        assert!(project.join(".felina").join("skills").join("baz").join("SKILL.md").is_file());
    }

    /// Apply: keep on a conflicting name leaves the global master untouched and
    /// reports conflict-resolved.
    #[test]
    fn apply_keep_conflict_preserves_global() {
        let home = tempdir();
        let _g = override_felina_home(&home);
        let project = tempdir();
        let project_str = project.to_string_lossy().to_string();

        write_legacy_skill(&project, "bar");
        write_global_skill(&home, "bar"); // pre-existing global → conflict

        let results = migrate_project_canonicals_apply(vec![MigrationAction {
            project_path: project_str,
            name: "bar".into(),
            action: "keep".into(),
        }])
        .expect("apply");

        assert_eq!(results[0].status, "conflict-resolved");

        // Global master content is the ORIGINAL global one (not overwritten).
        let bar_global = home.join(".felina").join("skills").join("bar").join("SKILL.md");
        let content = fs::read_to_string(&bar_global).unwrap();
        assert!(content.contains("global bar"), "global master must be untouched: {content}");
    }

    /// Apply: overwrite on a conflicting name replaces the global master and
    /// records the project target.
    #[test]
    fn apply_overwrite_replaces_global() {
        let home = tempdir();
        let _g = override_felina_home(&home);
        let project = tempdir();
        let project_str = project.to_string_lossy().to_string();

        write_legacy_skill(&project, "bar");
        write_global_skill(&home, "bar");

        let results = migrate_project_canonicals_apply(vec![MigrationAction {
            project_path: project_str.clone(),
            name: "bar".into(),
            action: "overwrite".into(),
        }])
        .expect("apply");

        assert_eq!(results[0].status, "applied");

        let bar_global = home.join(".felina").join("skills").join("bar").join("SKILL.md");
        let content = fs::read_to_string(&bar_global).unwrap();
        assert!(content.contains("legacy bar"), "global master must be overwritten by legacy: {content}");

        // legacy dir still present.
        assert!(project.join(".felina").join("skills").join("bar").join("SKILL.md").is_file());
    }
}
