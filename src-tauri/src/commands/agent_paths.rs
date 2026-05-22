//! Per-agent skill-directory configuration.
//!
//! Defaults come from the `agent-skills-schema` capability spec. Users
//! override via Settings → Agent Paths; the override is persisted into
//! `~/.felina/settings.json` under the key `agentPaths`.
//!
//! On Gemini defaults: as of 2026-05-21 Google is sunsetting `gemini-cli`
//! (June 18 2026 for consumer access) in favour of Antigravity CLI, which
//! uses `~/.gemini/antigravity/skills/` global + `.agents/skills/` project.
//! We ship the current `agent-skills-schema` spec defaults (`.gemini/skills/`
//! with `.agents/skills/` alias) and rely on (a) the import scanner probing
//! the Antigravity path additionally (skill_import.rs) and (b) this Settings
//! override to bridge the transition. Spec text can be patched as a
//! follow-up.

use crate::paths;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentPathPair {
    /// Absolute or `~`-anchored global path.
    pub global: String,
    /// Project-root-relative path (no leading separator).
    pub project_relative: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AgentPathsConfig {
    pub anthropic: AgentPathPair,
    pub codex: AgentPathPair,
    pub gemini: AgentPathPair,
}

impl AgentPathsConfig {
    pub fn defaults() -> Self {
        Self {
            anthropic: AgentPathPair {
                global: "~/.claude/skills".into(),
                project_relative: ".claude/skills".into(),
            },
            codex: AgentPathPair {
                global: "~/.agents/skills".into(),
                project_relative: ".agents/skills".into(),
            },
            gemini: AgentPathPair {
                global: "~/.gemini/skills".into(),
                project_relative: ".gemini/skills".into(),
            },
        }
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
    let stored = match serde_json::from_value::<AgentPathsConfig>(slot.clone()) {
        Ok(cfg) => cfg,
        Err(_) => return Ok(AgentPathsConfig::defaults()),
    };
    // Defence in depth: settings.json may have been hand-edited since the
    // last `agent_paths_set` (which DOES validate). Re-validate on read so
    // a traversal smuggled into the file can't reach the fan-out writers.
    if validate_pair("anthropic", &stored.anthropic).is_err()
        || validate_pair("codex", &stored.codex).is_err()
        || validate_pair("gemini", &stored.gemini).is_err()
    {
        return Ok(AgentPathsConfig::defaults());
    }
    Ok(stored)
}

/// Validate `config` and persist it. Rejects any pair containing `..`
/// segments or absolute path traversal (project_relative starting with `/`
/// or a drive letter). On reject, the settings file is left untouched.
#[tauri::command]
pub fn agent_paths_set(config: AgentPathsConfig) -> Result<(), String> {
    validate_pair("anthropic", &config.anthropic)?;
    validate_pair("codex", &config.codex)?;
    validate_pair("gemini", &config.gemini)?;

    let path = paths::felina_global_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create settings dir: {e}"))?;
    }

    // Read-modify-write so we don't clobber unrelated keys.
    let mut root: serde_json::Value = if path.exists() {
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("failed to read settings.json: {e}"))?;
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
    fs::write(&path, pretty)
        .map_err(|e| format!("failed to write settings.json: {e}"))?;
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
        for bad_global in ["~/../../etc", "../escape", "~/.claude/../..", "~/.claude/skills/../boom"] {
            let pair = AgentPathPair {
                global: bad_global.into(),
                project_relative: ".claude/skills".into(),
            };
            assert!(validate_pair("a", &pair).is_err(), "global={bad_global}");
        }
        for bad_project in ["/etc/passwd", "..\\skills", "C:/abs", "..", "../up"] {
            let pair = AgentPathPair {
                global: "~/.claude/skills".into(),
                project_relative: bad_project.into(),
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
        };
        validate_pair("a", &pair).unwrap();

        // Project sub-dir without traversal is fine.
        let nested = AgentPathPair {
            global: "~/.felina/skills".into(),
            project_relative: ".felina/team-shared/skills".into(),
        };
        validate_pair("a", &nested).unwrap();
    }
}
