//! Per-agent skill-directory configuration.
//!
//! Defaults come from the `agent-skills-schema` capability spec. Users
//! override via Settings → Agent Paths; the override is persisted into
//! `~/.felina/settings.json` under the key `agentPaths`.
//!
//! On Gemini defaults: as of 2026-05-21 Google is sunsetting `gemini-cli`
//! (June 18 2026 for consumer access) in favour of Antigravity CLI, which
//! uses `~/.gemini/antigravity-cli/skills/` global + `.agents/skills/` project.
//! We now ship the Antigravity CLI path as the default.

use crate::paths;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

pub const GEMINI_LEGACY_GLOBAL: &str = "~/.gemini/skills";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentPathPair {
    /// Absolute or `~`-anchored global path.
    pub global: String,
    /// Project-root-relative path (no leading separator).
    pub project_relative: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
}

use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentPathsConfig {
    pub agents: HashMap<String, AgentPathPair>,
}

/// Legacy format: three top-level keys.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LegacyAgentPathsConfig {
    anthropic: AgentPathPair,
    codex: AgentPathPair,
    gemini: AgentPathPair,
}

impl From<LegacyAgentPathsConfig> for AgentPathsConfig {
    fn from(legacy: LegacyAgentPathsConfig) -> Self {
        let mut agents = HashMap::new();
        agents.insert("anthropic".into(), legacy.anthropic);
        agents.insert("codex".into(), legacy.codex);
        agents.insert("gemini".into(), legacy.gemini);
        Self { agents }
    }
}

pub const BUILTIN_AGENT_ORDER: &[&str] = &["anthropic", "codex", "gemini"];

impl AgentPathsConfig {
    pub fn defaults() -> Self {
        let mut agents = HashMap::new();
        agents.insert("anthropic".into(), AgentPathPair {
            global: "~/.claude/skills".into(),
            project_relative: ".claude/skills".into(),
            label: None,
            icon: None,
        });
        agents.insert("codex".into(), AgentPathPair {
            global: "~/.codex/skills".into(),
            project_relative: ".agents/skills".into(),
            label: None,
            icon: None,
        });
        agents.insert("gemini".into(), AgentPathPair {
            global: "~/.gemini/antigravity-cli/skills".into(),
            project_relative: ".agents/skills".into(),
            label: None,
            icon: None,
        });
        Self { agents }
    }

    pub fn pair_for(&self, agent: &str) -> Option<&AgentPathPair> {
        self.agents.get(agent)
    }

    pub fn extra_global_paths(
        &self,
        agent: &str,
        expand: impl Fn(&str) -> PathBuf,
    ) -> Vec<PathBuf> {
        let legacy: &[&str] = match agent {
            "gemini" => &[GEMINI_LEGACY_GLOBAL],
            _ => &[],
        };
        let Some(pair) = self.agents.get(agent) else {
            return Vec::new();
        };
        let configured = expand(&pair.global);
        legacy
            .iter()
            .map(|p| expand(p))
            .filter(|p| *p != configured)
            .collect()
    }
}

/// Settings-file key under which the config is persisted inside the
/// felina settings file.
const SETTINGS_KEY: &str = "agentPaths";

/// Read the persisted config from `~/.felina/settings.json`, overlaying
/// fields onto the schema defaults. Missing file or missing key returns
/// defaults — never an error.
#[tauri::command]
pub fn agent_paths_get() -> Result<AgentPathsConfig, String> {
    let path = paths::felina_global_settings_path();
    if !path.exists() {
        return Ok(AgentPathsConfig::defaults());
    }
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(AgentPathsConfig::defaults()),
    };
    let val: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(AgentPathsConfig::defaults()),
    };
    let Some(slot) = val.get(SETTINGS_KEY) else {
        return Ok(AgentPathsConfig::defaults());
    };
    let stored = serde_json::from_value::<AgentPathsConfig>(slot.clone())
        .or_else(|_| {
            serde_json::from_value::<LegacyAgentPathsConfig>(slot.clone())
                .map(AgentPathsConfig::from)
        })
        .unwrap_or_else(|_| AgentPathsConfig::defaults());
    for (key, pair) in &stored.agents {
        if validate_pair(key, pair).is_err() {
            return Ok(AgentPathsConfig::defaults());
        }
    }
    Ok(stored)
}

/// Validate `config` and persist it. Rejects any pair containing `..`
/// segments or absolute path traversal (project_relative starting with `/`
/// or a drive letter). On reject, the settings file is left untouched.
#[tauri::command]
pub fn agent_paths_set(config: AgentPathsConfig) -> Result<(), String> {
    for (key, pair) in &config.agents {
        validate_agent_key(key)?;
        validate_pair(key, pair)?;
    }

    let path = paths::felina_global_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create settings dir: {e}"))?;
    }

    // Read-modify-write so we don't clobber unrelated keys.
    let mut root: serde_json::Value = if path.exists() {
        let raw =
            fs::read_to_string(&path).map_err(|e| format!("failed to read settings.json: {e}"))?;
        if raw.trim().is_empty() {
            serde_json::Value::Object(serde_json::Map::new())
        } else {
            serde_json::from_str(&raw)
                .map_err(|e| format!("settings.json is not valid JSON: {e}"))?
        }
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    let serialized = serde_json::to_value(&config)
        .map_err(|e| format!("failed to serialize agent paths: {e}"))?;
    match root.as_object_mut() {
        Some(obj) => {
            obj.insert(SETTINGS_KEY.to_string(), serialized);
        }
        None => return Err("settings.json root must be an object".into()),
    }

    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    fs::write(&path, pretty).map_err(|e| format!("failed to write settings.json: {e}"))?;
    Ok(())
}

use crate::commands::canonical_skills::BUILTIN_AGENTS;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovalPreview {
    pub skills: Vec<String>,
    pub target_count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveResult {
    pub skills_affected: u32,
    pub targets_removed: u32,
}

#[tauri::command]
pub fn agent_path_removal_preview(agent_key: String) -> Result<RemovalPreview, String> {
    if BUILTIN_AGENTS.contains(&agent_key.as_str()) {
        return Err(format!("cannot delete built-in agent: {agent_key}"));
    }
    let canonical_dir = crate::commands::canonical_skills::canonical_skills_dir();
    let mut skills = Vec::new();
    let mut target_count: u32 = 0;
    if canonical_dir.is_dir() {
        for entry in fs::read_dir(&canonical_dir).map_err(|e| e.to_string())?.flatten() {
            let meta_path = entry.path().join(".felina-sync-meta.json");
            if !meta_path.is_file() { continue; }
            let raw = fs::read_to_string(&meta_path).unwrap_or_default();
            let meta: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();
            if let Some(targets) = meta.get("targets").and_then(|t| t.as_array()) {
                let count = targets.iter().filter(|t| {
                    t.get("agent").and_then(|a| a.as_str()) == Some(&agent_key)
                }).count() as u32;
                if count > 0 {
                    skills.push(entry.file_name().to_string_lossy().to_string());
                    target_count += count;
                }
            }
        }
    }
    Ok(RemovalPreview { skills, target_count })
}

#[tauri::command]
pub fn agent_path_remove(agent_key: String) -> Result<RemoveResult, String> {
    if BUILTIN_AGENTS.contains(&agent_key.as_str()) {
        return Err(format!("cannot delete built-in agent: {agent_key}"));
    }
    let canonical_dir = crate::commands::canonical_skills::canonical_skills_dir();
    let mut skills_affected: u32 = 0;
    let mut targets_removed: u32 = 0;
    if canonical_dir.is_dir() {
        for entry in fs::read_dir(&canonical_dir).map_err(|e| e.to_string())?.flatten() {
            let meta_path = entry.path().join(".felina-sync-meta.json");
            if !meta_path.is_file() { continue; }
            let raw = fs::read_to_string(&meta_path).unwrap_or_default();
            let mut meta: serde_json::Value = match serde_json::from_str(&raw) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let mut changed = false;
            if let Some(targets) = meta.get_mut("targets").and_then(|t| t.as_array_mut()) {
                let before = targets.len();
                targets.retain(|t| {
                    t.get("agent").and_then(|a| a.as_str()) != Some(&agent_key)
                });
                let removed = (before - targets.len()) as u32;
                if removed > 0 {
                    targets_removed += removed;
                    skills_affected += 1;
                    changed = true;
                }
            }
            if let Some(last_sync) = meta.get_mut("lastSync").and_then(|l| l.as_object_mut()) {
                let keys_to_remove: Vec<String> = last_sync.keys()
                    .filter(|k| k.starts_with(&format!("{}:", agent_key)))
                    .cloned()
                    .collect();
                for k in keys_to_remove {
                    last_sync.remove(&k);
                    changed = true;
                }
            }
            if changed {
                let pretty = serde_json::to_string_pretty(&meta)
                    .map_err(|e| format!("failed to serialize sync-meta: {e}"))?;
                fs::write(&meta_path, pretty)
                    .map_err(|e| format!("failed to write sync-meta: {e}"))?;
            }
        }
    }
    // Remove from config
    let mut cfg = agent_paths_get()?;
    cfg.agents.remove(&agent_key);
    agent_paths_set(cfg)?;
    Ok(RemoveResult { skills_affected, targets_removed })
}

fn validate_agent_key(key: &str) -> Result<(), String> {
    if key.is_empty() {
        return Err("agent key must not be empty".into());
    }
    if !key.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-') {
        return Err(format!("agent key must be kebab-case (a-z, 0-9, -): {key}"));
    }
    if key.contains("..") {
        return Err(format!("agent key must not contain '..': {key}"));
    }
    Ok(())
}

/// Reject path traversal. Rules:
/// - `global`: may start with `~` then a separator, OR an absolute path.
///   Must not contain any `..` component.
/// - `project_relative`: must NOT be empty, must NOT start with a separator,
///   must NOT be absolute, must NOT contain any `..` component.
fn validate_pair(agent_label: &str, pair: &AgentPathPair) -> Result<(), String> {
    if pair.global.trim().is_empty() {
        return Err(format!("{agent_label}.global must not be empty"));
    }
    if pair.project_relative.trim().is_empty() {
        return Err(format!("{agent_label}.projectRelative must not be empty"));
    }
    // Global: no `..` segments, even after normalising separators.
    if contains_parent_segment(&pair.global) {
        return Err(format!(
            "{agent_label}.global must not contain '..' segments: {}",
            pair.global
        ));
    }
    // Project-relative: must be a relative path.
    if is_absolute_like(&pair.project_relative) {
        return Err(format!(
            "{agent_label}.projectRelative must be a relative path (not absolute): {}",
            pair.project_relative
        ));
    }
    if contains_parent_segment(&pair.project_relative) {
        return Err(format!(
            "{agent_label}.projectRelative must not contain '..' segments: {}",
            pair.project_relative
        ));
    }
    Ok(())
}

fn contains_parent_segment(p: &str) -> bool {
    // Normalise both separators so we catch `..\foo` on Linux test runs
    // and `../foo` on Windows.
    let normalised: String = p.chars().map(|c| if c == '\\' { '/' } else { c }).collect();
    Path::new(&normalised)
        .components()
        .any(|c| matches!(c, Component::ParentDir))
}

fn is_absolute_like(p: &str) -> bool {
    // Treat any leading `/` or `\` as absolute. Also reject Windows
    // drive-letter prefix (`C:\` etc) regardless of host OS, since the
    // settings file is portable across machines.
    if p.starts_with('/') || p.starts_with('\\') {
        return true;
    }
    let bytes = p.as_bytes();
    if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        let sep = bytes[2];
        if sep == b'/' || sep == b'\\' {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_round_trip() {
        // Serialize and deserialize defaults — guard against schema drift.
        let d = AgentPathsConfig::defaults();
        let json = serde_json::to_string(&d).unwrap();
        let back: AgentPathsConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(d, back);
    }

    #[test]
    fn validate_rejects_traversal() {
        for bad_global in [
            "~/../../etc",
            "../escape",
            "~/.claude/../..",
            "~/.claude/skills/../boom",
        ] {
            let pair = AgentPathPair {
                global: bad_global.into(),
                project_relative: ".claude/skills".into(),
                label: None,
                icon: None,
            };
            assert!(validate_pair("a", &pair).is_err(), "global={bad_global}");
        }
        for bad_project in ["/etc/passwd", "..\\skills", "C:/abs", "..", "../up"] {
            let pair = AgentPathPair {
                global: "~/.claude/skills".into(),
                project_relative: bad_project.into(),
                label: None,
                icon: None,
            };
            assert!(
                validate_pair("a", &pair).is_err(),
                "project_relative={bad_project}"
            );
        }
    }

    #[test]
    fn validate_accepts_well_formed() {
        let pair = AgentPathPair {
            global: "~/.claude/skills".into(),
            project_relative: ".claude/skills".into(),
            label: None,
            icon: None,
        };
        validate_pair("a", &pair).unwrap();

        // Project sub-dir without traversal is fine.
        let nested = AgentPathPair {
            global: "~/.felina/skills".into(),
            project_relative: ".felina/team-shared/skills".into(),
            label: None,
            icon: None,
        };
        validate_pair("a", &nested).unwrap();
    }

    #[test]
    fn test_agent_paths_migration_legacy_format() {
        let legacy = r#"{"anthropic":{"global":"~/.claude/skills","projectRelative":".claude/skills"},"codex":{"global":"~/.codex/skills","projectRelative":".agents/skills"},"gemini":{"global":"~/.gemini/skills","projectRelative":".gemini/skills"}}"#;
        let val: serde_json::Value = serde_json::from_str(legacy).unwrap();
        let cfg = serde_json::from_value::<AgentPathsConfig>(val.clone())
            .or_else(|_| serde_json::from_value::<LegacyAgentPathsConfig>(val).map(AgentPathsConfig::from))
            .unwrap();
        assert_eq!(cfg.agents.len(), 3);
        assert_eq!(cfg.pair_for("anthropic").unwrap().global, "~/.claude/skills");
        assert_eq!(cfg.pair_for("gemini").unwrap().project_relative, ".gemini/skills");
    }

    #[test]
    fn test_agent_paths_new_format() {
        let new = r#"{"agents":{"anthropic":{"global":"~/.claude/skills","projectRelative":".claude/skills"},"codex":{"global":"~/.codex/skills","projectRelative":".agents/skills"},"aider":{"global":"~/.aider/skills","projectRelative":".aider/skills","label":"Aider"}}}"#;
        let cfg: AgentPathsConfig = serde_json::from_str(new).unwrap();
        assert_eq!(cfg.agents.len(), 3);
        assert_eq!(cfg.pair_for("aider").unwrap().global, "~/.aider/skills");
        assert_eq!(cfg.pair_for("aider").unwrap().label.as_deref(), Some("Aider"));
    }

    #[test]
    fn test_agent_path_remove_rejects_builtin() {
        assert!(agent_path_removal_preview("anthropic".into()).is_err());
        assert!(agent_path_removal_preview("codex".into()).is_err());
        assert!(agent_path_removal_preview("gemini".into()).is_err());
        assert!(agent_path_remove("anthropic".into()).is_err());
    }

    #[test]
    fn test_validate_agent_key() {
        assert!(validate_agent_key("anthropic").is_ok());
        assert!(validate_agent_key("my-agent").is_ok());
        assert!(validate_agent_key("agent123").is_ok());
        assert!(validate_agent_key("").is_err());
        assert!(validate_agent_key("My Agent").is_err());
        assert!(validate_agent_key("agent..path").is_err());
        assert!(validate_agent_key("UPPER").is_err());
        assert!(validate_agent_key("agent/path").is_err());
    }
}
