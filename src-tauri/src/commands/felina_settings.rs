//! Felina-internal settings stored in `~/.felina/settings.json`.
//!
//! Currently exposes the quota cache TTL (`quotaTtlSeconds`) shared by the
//! frontend AgentQuotaPanel and the backend `ccusage` quota cache window.

use std::fs;

use crate::paths;

/// Settings-file key holding the quota cache TTL in seconds.
const SETTINGS_KEY: &str = "quotaTtlSeconds";

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
}
