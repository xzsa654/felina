use std::path::{Path, PathBuf};

pub fn claude_home() -> PathBuf {
    dirs::home_dir()
        .expect("could not resolve home directory")
        .join(".claude")
}

pub fn global_settings_path() -> PathBuf {
    claude_home().join("settings.json")
}

pub fn project_settings_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".claude")
        .join("settings.json")
}

pub fn project_local_settings_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".claude")
        .join("settings.local.json")
}

pub fn project_mcp_json_path(project_path: &str) -> PathBuf {
    PathBuf::from(project_path).join(".mcp.json")
}

pub fn claude_desktop_config_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_default()
        .join("Claude")
        .join("claude_desktop_config.json")
}

pub fn stats_cache_path() -> PathBuf {
    claude_home().join("stats-cache.json")
}

pub fn projects_dir() -> PathBuf {
    claude_home().join("projects")
}

pub fn memory_dir(project_hash: &str) -> PathBuf {
    projects_dir().join(project_hash).join("memory")
}

pub fn global_instructions_path() -> PathBuf {
    claude_home().join("CLAUDE.md")
}

// `global_skills_dir()` was removed in `multi-agent-skills-foundation`:
// canonical skills live under `~/.felina/skills/` now and Anthropic's
// `~/.claude/skills/` is reached via `agent_paths_get()`'s configurable
// `AgentPathPair.global` instead. See `felina_global_skills_dir` below.

pub fn global_agents_dir() -> PathBuf {
    claude_home().join("agents")
}

/// Felina's canonical skills home. Source of truth for skills the user
/// edits and (optionally) git-tracks; agent-native skill dirs are fan-out
/// outputs derived from here. See multi-agent-skills-foundation design
/// decision 1.
pub fn felina_home() -> PathBuf {
    dirs::home_dir()
        .expect("could not resolve home directory")
        .join(".felina")
}

pub fn felina_global_skills_dir() -> PathBuf {
    felina_home().join("skills")
}

pub fn felina_project_skills_dir(project_path: &str) -> PathBuf {
    PathBuf::from(project_path)
        .join(".felina")
        .join("skills")
}

pub fn global_rules_dir() -> PathBuf {
    claude_home().join("rules")
}

pub fn project_hash_to_path(hash: &str) -> String {
    // Authoritative source: Claude Code writes the original `cwd` into every
    // session's `.jsonl`. Reading it there sidesteps the dash-encoding
    // ambiguity entirely (Windows `C:\` → `C--`, and real `-` in folder
    // names collide with the separator). See issue #2.
    if let Some(cwd) = cwd_from_session_file(hash) {
        return cwd;
    }

    // Naive: replace all `-` with `/`
    let naive = hash.replace('-', "/");
    if Path::new(&naive).is_dir() {
        return naive;
    }

    // Smart: try to find a real path by grouping segments
    let segments: Vec<&str> = hash.split('-').filter(|s| !s.is_empty()).collect();
    if let Some(path) = resolve_segments(&segments, 0, "/") {
        return path;
    }

    naive
}

/// Read the first line of any `.jsonl` session file in the project folder
/// and extract `cwd`. Returns None if the folder doesn't exist, has no
/// sessions, or the first line isn't parseable — caller falls back to
/// folder-name decoding.
fn cwd_from_session_file(hash: &str) -> Option<String> {
    let project_dir = projects_dir().join(hash);
    let entries = std::fs::read_dir(&project_dir).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let Some(first_line) = content.lines().next() else { continue };
        let Ok(json) = serde_json::from_str::<serde_json::Value>(first_line) else { continue };
        if let Some(cwd) = json.get("cwd").and_then(|v| v.as_str()) {
            if !cwd.is_empty() {
                return Some(cwd.to_string());
            }
        }
    }
    None
}

fn resolve_segments(segments: &[&str], idx: usize, current: &str) -> Option<String> {
    if idx >= segments.len() {
        return if Path::new(current).is_dir() {
            Some(current.to_string())
        } else {
            None
        };
    }

    // Try joining segments with `-` (longer matches first to prefer real dir names)
    for end in (idx + 1..=segments.len()).rev() {
        let joined = segments[idx..end].join("-");
        let candidate = if current == "/" {
            format!("/{joined}")
        } else {
            format!("{current}/{joined}")
        };

        if Path::new(&candidate).is_dir() {
            if let Some(result) = resolve_segments(segments, end, &candidate) {
                return Some(result);
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn felina_global_skills_dir_ends_with_dot_felina_skills() {
        let p = felina_global_skills_dir();
        // Must terminate with the canonical segments regardless of OS separator.
        assert_eq!(p.file_name().and_then(|s| s.to_str()), Some("skills"));
        assert_eq!(
            p.parent().and_then(|p| p.file_name()).and_then(|s| s.to_str()),
            Some(".felina"),
        );
        // Anchored under the user's home directory.
        assert!(p.starts_with(dirs::home_dir().expect("home dir")));
    }

    #[test]
    fn felina_project_skills_dir_under_project_root() {
        // Use a fixed string; PathBuf normalises separators per-OS at display time.
        let project = if cfg!(windows) { r"C:\proj" } else { "/proj" };
        let p = felina_project_skills_dir(project);
        assert!(p.starts_with(project));
        assert_eq!(p.file_name().and_then(|s| s.to_str()), Some("skills"));
        assert_eq!(
            p.parent().and_then(|p| p.file_name()).and_then(|s| s.to_str()),
            Some(".felina"),
        );
    }
}
