//! Felina-internal settings stored in `~/.felina/settings.json`.
//!
//! Currently exposes the quota cache TTL (`quotaTtlSeconds`) shared by the
//! frontend AgentQuotaPanel and the backend `ccusage` quota cache window.

use std::fs;

use serde::{Deserialize, Serialize};

use crate::paths;

/// Settings-file key holding the quota cache TTL in seconds.
const SETTINGS_KEY: &str = "quotaTtlSeconds";

/// Settings-file key holding per-agent quota-window trigger schedules.
const SCHEDULES_KEY: &str = "quotaWindowSchedules";

/// Supported agents for quota-window scheduling. Gemini is intentionally
/// excluded (see change `quota-window-scheduler` Non-Goals).
pub const SCHEDULE_AGENTS: [&str; 2] = ["claude", "codex"];

/// A single agent's daily quota-window trigger schedule. `time` is a local
/// wall-clock `HH:MM` (24-hour). `message` is the text sent on trigger.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct QuotaWindowSchedule {
    pub enabled: bool,
    pub time: String,
    pub message: String,
}

impl Default for QuotaWindowSchedule {
    fn default() -> Self {
        Self {
            enabled: false,
            time: "09:00".into(),
            message: "早安".into(),
        }
    }
}

/// All supported agents' schedules.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Default)]
pub struct QuotaWindowSchedules {
    pub claude: QuotaWindowSchedule,
    pub codex: QuotaWindowSchedule,
}

/// Default TTL when the settings file or the key is absent. Matches the
/// AgentQuotaPanel display fallback so frontend and backend agree.
const DEFAULT_TTL_SECONDS: u64 = 60;

const MIN_TTL_SECONDS: u64 = 30;
const MAX_TTL_SECONDS: u64 = 3600;

/// Read `quotaTtlSeconds` from `~/.felina/settings.json`. Missing file,
/// missing key, or unparsable JSON all mean "no setting" and return the
/// default — never an error.
pub(crate) fn read_quota_ttl_seconds() -> u64 {
    let path = paths::felina_global_settings_path();
    let Ok(raw) = fs::read_to_string(&path) else {
        return DEFAULT_TTL_SECONDS;
    };
    let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return DEFAULT_TTL_SECONDS;
    };
    val.get(SETTINGS_KEY)
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_TTL_SECONDS)
}

/// Persist `quotaTtlSeconds` into `~/.felina/settings.json`, preserving all
/// other top-level fields (e.g. `agentPaths`). Atomic write: temp file in
/// the same directory, then rename over the target.
pub(crate) fn write_quota_ttl_seconds(seconds: u64) -> Result<(), String> {
    if !(MIN_TTL_SECONDS..=MAX_TTL_SECONDS).contains(&seconds) {
        return Err("quota TTL must be between 30 and 3600 seconds".into());
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

    match root.as_object_mut() {
        Some(obj) => {
            obj.insert(SETTINGS_KEY.to_string(), serde_json::Value::from(seconds));
        }
        None => return Err("settings.json root must be an object".into()),
    }

    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, pretty).map_err(|e| format!("failed to write settings.json: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("failed to replace settings.json: {e}"))?;
    Ok(())
}

// ── Quota-window schedules ──────────────────────────────────────────────────

/// Read one agent's schedule out of the `quotaWindowSchedules` node, falling
/// back to per-field defaults so a partially-written entry still resolves.
fn read_one_schedule(node: Option<&serde_json::Value>, agent: &str) -> QuotaWindowSchedule {
    let d = QuotaWindowSchedule::default();
    let entry = node.and_then(|n| n.get(agent));
    QuotaWindowSchedule {
        enabled: entry
            .and_then(|e| e.get("enabled"))
            .and_then(|v| v.as_bool())
            .unwrap_or(d.enabled),
        time: entry
            .and_then(|e| e.get("time"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .unwrap_or(d.time),
        message: entry
            .and_then(|e| e.get("message"))
            .and_then(|v| v.as_str())
            .map(str::to_string)
            .unwrap_or(d.message),
    }
}

/// Read all quota-window schedules from `~/.felina/settings.json`. Missing
/// file, missing key, missing fields, or unparsable JSON all resolve to
/// defaults — never an error.
pub(crate) fn read_quota_window_schedules() -> QuotaWindowSchedules {
    let path = paths::felina_global_settings_path();
    let root = fs::read_to_string(&path)
        .ok()
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());
    let node = root.as_ref().and_then(|v| v.get(SCHEDULES_KEY));
    QuotaWindowSchedules {
        claude: read_one_schedule(node, "claude"),
        codex: read_one_schedule(node, "codex"),
    }
}

/// `true` when `time` is a valid 24-hour `HH:MM` literal (exactly two digits
/// each, hours 00..=23, minutes 00..=59).
pub(crate) fn is_valid_hhmm(time: &str) -> bool {
    let bytes = time.as_bytes();
    if bytes.len() != 5 || bytes[2] != b':' {
        return false;
    }
    if !bytes
        .iter()
        .enumerate()
        .all(|(i, b)| i == 2 || b.is_ascii_digit())
    {
        return false;
    }
    let (Some(h), Some(m)) = (
        time.get(0..2).and_then(|s| s.parse::<u32>().ok()),
        time.get(3..5).and_then(|s| s.parse::<u32>().ok()),
    ) else {
        return false;
    };
    h < 24 && m < 60
}

/// Persist a single agent's schedule into `quotaWindowSchedules`, preserving
/// all other settings keys. Rejects unsupported agents, malformed `time`, and
/// empty (or whitespace-only) `message` without touching the file.
pub(crate) fn write_quota_window_schedule(
    agent: &str,
    enabled: bool,
    time: &str,
    message: &str,
) -> Result<(), String> {
    if !SCHEDULE_AGENTS.contains(&agent) {
        return Err(format!(
            "unsupported agent '{agent}'; expected one of {SCHEDULE_AGENTS:?}"
        ));
    }
    if !is_valid_hhmm(time) {
        return Err(format!("time must be in HH:MM 24-hour format, got '{time}'"));
    }
    if message.trim().is_empty() {
        return Err("message must not be empty".into());
    }

    let path = paths::felina_global_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create settings dir: {e}"))?;
    }

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

    let obj = root
        .as_object_mut()
        .ok_or_else(|| "settings.json root must be an object".to_string())?;

    let schedules = obj
        .entry(SCHEDULES_KEY)
        .or_insert_with(|| serde_json::Value::Object(serde_json::Map::new()));
    if !schedules.is_object() {
        *schedules = serde_json::Value::Object(serde_json::Map::new());
    }
    let entry = serde_json::json!({
        "enabled": enabled,
        "time": time,
        "message": message,
    });
    schedules
        .as_object_mut()
        .expect("schedules normalised to object above")
        .insert(agent.to_string(), entry);

    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, pretty).map_err(|e| format!("failed to write settings.json: {e}"))?;
    fs::rename(&tmp, &path).map_err(|e| format!("failed to replace settings.json: {e}"))?;
    Ok(())
}

/// Read the shared quota cache TTL in seconds.
#[tauri::command]
pub fn get_felina_quota_ttl() -> Result<u64, String> {
    Ok(read_quota_ttl_seconds())
}

/// Persist the shared quota cache TTL in seconds. Accepts 30..=3600.
#[tauri::command]
pub fn set_felina_quota_ttl(seconds: u64) -> Result<(), String> {
    write_quota_ttl_seconds(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::set_felina_home_override_for_test;

    fn with_temp_home<R>(name: &str, f: impl FnOnce(&std::path::Path) -> R) -> R {
        let dir = std::env::temp_dir().join(format!("felina_settings_test_{name}"));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create temp home");
        set_felina_home_override_for_test(Some(dir.clone()));
        let out = f(&dir);
        set_felina_home_override_for_test(None);
        let _ = fs::remove_dir_all(&dir);
        out
    }

    #[test]
    fn missing_settings_file_returns_default_ttl() {
        with_temp_home("missing_file", |_| {
            assert_eq!(read_quota_ttl_seconds(), 60);
        });
    }

    #[test]
    fn write_round_trip_preserves_other_fields() {
        with_temp_home("round_trip", |home| {
            let path = home.join("settings.json");
            fs::write(
                &path,
                r#"{ "agentPaths": { "anthropic": { "global": "~/.claude/skills" } } }"#,
            )
            .expect("seed settings");

            write_quota_ttl_seconds(120).expect("write ttl");

            assert_eq!(read_quota_ttl_seconds(), 120);
            let raw = fs::read_to_string(&path).expect("read back");
            let val: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
            assert_eq!(
                val["agentPaths"]["anthropic"]["global"],
                serde_json::Value::from("~/.claude/skills")
            );
            assert_eq!(val["quotaTtlSeconds"], serde_json::Value::from(120));
        });
    }

    #[test]
    fn write_creates_file_when_absent() {
        with_temp_home("creates_file", |home| {
            write_quota_ttl_seconds(45).expect("write ttl");
            let raw = fs::read_to_string(home.join("settings.json")).expect("read back");
            let val: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
            assert_eq!(val["quotaTtlSeconds"], serde_json::Value::from(45));
        });
    }

    #[test]
    fn out_of_range_ttl_is_rejected_and_file_unchanged() {
        with_temp_home("out_of_range", |home| {
            let path = home.join("settings.json");
            fs::write(&path, r#"{ "quotaTtlSeconds": 60 }"#).expect("seed settings");

            assert!(write_quota_ttl_seconds(29).is_err());
            assert!(write_quota_ttl_seconds(3601).is_err());
            assert!(write_quota_ttl_seconds(30).is_ok());
            assert!(write_quota_ttl_seconds(3600).is_ok());

            assert_eq!(read_quota_ttl_seconds(), 3600);
        });
    }

    #[test]
    fn unparsable_settings_file_returns_default_ttl() {
        with_temp_home("bad_json", |home| {
            fs::write(home.join("settings.json"), "{not json").expect("seed settings");
            assert_eq!(read_quota_ttl_seconds(), 60);
        });
    }

    // ── Quota-window schedules ──────────────────────────────────────────────

    #[test]
    fn missing_schedules_key_returns_defaults() {
        with_temp_home("sched_missing", |home| {
            fs::write(&home.join("settings.json"), r#"{ "quotaTtlSeconds": 60 }"#)
                .expect("seed settings");
            let s = read_quota_window_schedules();
            assert_eq!(s.claude, QuotaWindowSchedule::default());
            assert_eq!(s.codex, QuotaWindowSchedule::default());
            assert!(!s.claude.enabled);
            assert_eq!(s.claude.time, "09:00");
            assert_eq!(s.claude.message, "早安");
        });
    }

    #[test]
    fn writing_schedule_preserves_quota_ttl() {
        with_temp_home("sched_preserve", |home| {
            let path = home.join("settings.json");
            fs::write(&path, r#"{ "quotaTtlSeconds": 120 }"#).expect("seed settings");

            write_quota_window_schedule("claude", true, "07:30", "早安").expect("write schedule");

            let raw = fs::read_to_string(&path).expect("read back");
            let val: serde_json::Value = serde_json::from_str(&raw).expect("valid json");
            assert_eq!(val["quotaTtlSeconds"], serde_json::Value::from(120));
            assert_eq!(val["quotaWindowSchedules"]["claude"]["enabled"], serde_json::Value::Bool(true));
            assert_eq!(val["quotaWindowSchedules"]["claude"]["time"], serde_json::Value::from("07:30"));

            let s = read_quota_window_schedules();
            assert!(s.claude.enabled);
            assert_eq!(s.claude.time, "07:30");
            // codex untouched → default
            assert_eq!(s.codex, QuotaWindowSchedule::default());
        });
    }

    #[test]
    fn writing_second_agent_keeps_first() {
        with_temp_home("sched_two_agents", |_| {
            write_quota_window_schedule("claude", true, "08:00", "morning").expect("claude");
            write_quota_window_schedule("codex", true, "23:59", "hi").expect("codex");
            let s = read_quota_window_schedules();
            assert!(s.claude.enabled && s.claude.time == "08:00");
            assert!(s.codex.enabled && s.codex.time == "23:59");
        });
    }

    #[test]
    fn invalid_schedule_input_is_rejected_and_file_unchanged() {
        with_temp_home("sched_invalid", |home| {
            let path = home.join("settings.json");
            fs::write(&path, r#"{ "quotaTtlSeconds": 60 }"#).expect("seed settings");
            let before = fs::read_to_string(&path).expect("read before");

            // spec validation table
            assert!(write_quota_window_schedule("gemini", true, "09:00", "早安").is_err());
            assert!(write_quota_window_schedule("claude", true, "9:0", "早安").is_err());
            assert!(write_quota_window_schedule("claude", true, "25:00", "早安").is_err());
            assert!(write_quota_window_schedule("claude", true, "09:00", "").is_err());
            assert!(write_quota_window_schedule("claude", true, "09:00", "   ").is_err());

            let after = fs::read_to_string(&path).expect("read after");
            assert_eq!(before, after, "rejected writes must not touch the file");

            // valid cases accepted
            assert!(write_quota_window_schedule("claude", true, "09:00", "早安").is_ok());
            assert!(write_quota_window_schedule("codex", false, "23:59", "hi").is_ok());
        });
    }

    #[test]
    fn hhmm_validation_boundaries() {
        assert!(is_valid_hhmm("00:00"));
        assert!(is_valid_hhmm("23:59"));
        assert!(!is_valid_hhmm("24:00"));
        assert!(!is_valid_hhmm("09:60"));
        assert!(!is_valid_hhmm("9:00"));
        assert!(!is_valid_hhmm("09:0"));
        assert!(!is_valid_hhmm("0900"));
        assert!(!is_valid_hhmm("ab:cd"));
        assert!(!is_valid_hhmm("09:00 "));
    }
}
