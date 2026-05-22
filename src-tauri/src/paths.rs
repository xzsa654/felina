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

/// Felina's own settings file. Holds felina-only config (e.g. agent paths).
/// Kept separate from `~/.claude/settings.json` so we don't pollute Claude
/// Code's settings namespace with our keys.
pub fn felina_global_settings_path() -> PathBuf {
    felina_home().join("settings.json")
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

/// Resolve a Claude Code project hash (folder name under
/// `~/.claude/projects/`) back to its original cwd.
///
/// Tries in order:
/// 1. Read `cwd` from the first parseable `.jsonl` inside the project folder.
/// 2. Decode a Windows drive-letter prefix (`C--rest` → `C:/rest`) and verify
///    the resulting directory exists.
/// 3. Resolve dash-separated segments against the filesystem starting from
///    either the matching drive root (when hash has a drive prefix) or `/`.
///
/// Returns `None` (unresolved) when none of these yields a path that exists
/// or — for strategy 1 — a non-empty `cwd`. Callers MUST NOT use an
/// unresolved value as a project root for writes (fan-out, import, etc).
pub fn project_hash_to_path(hash: &str) -> Option<String> {
    if let Some(cwd) = cwd_from_session_file_in(&projects_dir(), hash) {
        return Some(cwd);
    }

    if let Some(decoded) = decode_drive_letter_hash(hash) {
        if Path::new(&decoded).is_dir() {
            return Some(decoded);
        }
    }

    let segments: Vec<&str> = hash.split('-').filter(|s| !s.is_empty()).collect();
    let root = drive_root_for_hash(hash).unwrap_or_else(|| "/".to_string());
    if let Some(path) = resolve_segments(&segments, drive_skip_count(hash), &root) {
        return Some(path);
    }

    None
}

/// Read the first parseable `.jsonl` under `<projects_root>/<hash>/` and
/// return its `cwd` field. Testable variant — accepts the projects root so
/// tests can use a tempdir instead of the user's real `~/.claude/projects/`.
fn cwd_from_session_file_in(projects_root: &Path, hash: &str) -> Option<String> {
    let project_dir = projects_root.join(hash);
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

/// Decode a Windows drive-letter hash into a forward-slash path string.
/// Pure: does NOT touch the filesystem. Returns `None` when the hash does
/// not begin with `[A-Za-z]--`.
///
/// Example: `C--MyProject-Pershing-felina` → `C:/MyProject/Pershing/felina`.
fn decode_drive_letter_hash(hash: &str) -> Option<String> {
    let bytes = hash.as_bytes();
    if bytes.len() < 3 {
        return None;
    }
    if !bytes[0].is_ascii_alphabetic() {
        return None;
    }
    if bytes[1] != b'-' || bytes[2] != b'-' {
        return None;
    }
    let drive = char::from(bytes[0]);
    let rest = &hash[3..];
    let tail = rest.replace('-', "/");
    Some(format!("{drive}:/{tail}"))
}

/// When `hash` begins with `[A-Za-z]--`, return the matching drive-root
/// string (`"C:/"`). Otherwise `None`.
fn drive_root_for_hash(hash: &str) -> Option<String> {
    let bytes = hash.as_bytes();
    if bytes.len() < 3 || !bytes[0].is_ascii_alphabetic() {
        return None;
    }
    if bytes[1] != b'-' || bytes[2] != b'-' {
        return None;
    }
    Some(format!("{}:/", char::from(bytes[0])))
}

/// When the hash has a `[A-Za-z]--` prefix, the first "segment" (the drive
/// letter) is already consumed by `drive_root_for_hash`. Segment resolution
/// SHOULD start from index 1, not 0.
fn drive_skip_count(hash: &str) -> usize {
    if drive_root_for_hash(hash).is_some() { 1 } else { 0 }
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
        } else if current.ends_with('/') {
            // Drive root (e.g. "C:/") — no extra separator needed.
            format!("{current}{joined}")
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
    use std::fs;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::time::{SystemTime, UNIX_EPOCH};

    static COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn tempdir() -> PathBuf {
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!("felina-paths-test-{pid}-{nanos}-{n}"));
        fs::create_dir_all(&dir).expect("mkdir tempdir");
        dir
    }

    #[test]
    fn decodes_windows_drive_letter_hash() {
        // Pure string decoding; does NOT touch filesystem.
        assert_eq!(
            decode_drive_letter_hash("C--MyProject-Pershing-felina"),
            Some("C:/MyProject/Pershing/felina".to_string()),
        );
        assert_eq!(
            decode_drive_letter_hash("D--foo-bar"),
            Some("D:/foo/bar".to_string()),
        );
        // No drive-letter prefix → None.
        assert_eq!(decode_drive_letter_hash("home-user-proj"), None);
        // Lower-case drive letters still recognised.
        assert_eq!(
            decode_drive_letter_hash("c--src"),
            Some("c:/src".to_string()),
        );
        // Multi-letter prefix is NOT a drive letter.
        assert_eq!(decode_drive_letter_hash("abc--foo"), None);
    }

    #[test]
    fn prefers_jsonl_cwd_over_decoding() {
        let tmp = tempdir();
        let hash = "C--would-decode-to-something-else";
        let project_dir = tmp.join(hash);
        fs::create_dir_all(&project_dir).expect("mkdir");
        let jsonl = project_dir.join("first.jsonl");
        fs::write(
            &jsonl,
            r#"{"cwd":"/expected/path/from/jsonl","type":"summary"}"#,
        )
        .expect("write jsonl");

        let cwd = cwd_from_session_file_in(&tmp, hash);
        assert_eq!(cwd, Some("/expected/path/from/jsonl".to_string()));
    }

    #[test]
    fn reports_unresolved_for_bogus_hash() {
        let tmp = tempdir();
        let bogus = "definitely-not-a-real-path-xyz12345-zzz";
        let cwd = cwd_from_session_file_in(&tmp, bogus);
        assert_eq!(cwd, None);

        // Drive-letter decoder rejects bogus hash because no `X--` prefix.
        assert_eq!(decode_drive_letter_hash(bogus), None);

        // The public function combines all strategies. The bogus hash is
        // engineered not to collide with any real folder.
        assert_eq!(project_hash_to_path(bogus), None);
    }

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
