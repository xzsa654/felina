//! Market server URL setting (persisted in `~/.felina/settings.json`).
//!
//! Read by Hub UI (`HubPage`) and the `install_market_skill` command. The
//! default `http://localhost:3100` keeps dev environments zero-config; users
//! configure a different host via Settings → Market Server.

use crate::paths;
use serde_json::Value;
use std::fs;

const SETTINGS_KEY: &str = "marketServerUrl";
pub const DEFAULT_URL: &str = "http://localhost:3100";

/// Return the persisted market server base URL, or the default if unset.
/// Always returns a value with no trailing slash so callers can concatenate
/// path segments directly.
#[tauri::command]
pub fn get_market_server_url() -> Result<String, String> {
    let path = paths::felina_global_settings_path();
    if !path.exists() {
        return Ok(DEFAULT_URL.to_string());
    }
    let raw = match fs::read_to_string(&path) {
        Ok(s) => s,
        Err(_) => return Ok(DEFAULT_URL.to_string()),
    };
    let val: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Ok(DEFAULT_URL.to_string()),
    };
    let stored = val
        .get(SETTINGS_KEY)
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Ok(stored.unwrap_or_else(|| DEFAULT_URL.to_string()))
}

/// Persist the market server base URL. Validates non-empty and `http://`
/// or `https://` scheme; trailing slashes are trimmed so the stored value
/// is in a canonical concatenation-friendly form.
#[tauri::command]
pub fn set_market_server_url(url: String) -> Result<(), String> {
    let trimmed = url.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        return Err("market server URL must not be empty".into());
    }
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return Err("market server URL must start with http:// or https://".into());
    }

    let path = paths::felina_global_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("failed to create settings dir: {e}"))?;
    }

    let mut root: Value = if path.exists() {
        let raw =
            fs::read_to_string(&path).map_err(|e| format!("failed to read settings.json: {e}"))?;
        if raw.trim().is_empty() {
            Value::Object(serde_json::Map::new())
        } else {
            serde_json::from_str(&raw)
                .map_err(|e| format!("settings.json is not valid JSON: {e}"))?
        }
    } else {
        Value::Object(serde_json::Map::new())
    };

    match root.as_object_mut() {
        Some(obj) => {
            obj.insert(SETTINGS_KEY.to_string(), Value::String(trimmed));
        }
        None => return Err("settings.json root must be an object".into()),
    }

    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    fs::write(&path, pretty).map_err(|e| format!("failed to write settings.json: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::paths::set_felina_home_override_for_test;
    use std::sync::Mutex;

    // Tests mutate the same thread-local override; serialize them.
    static LOCK: Mutex<()> = Mutex::new(());

    fn tempdir() -> std::path::PathBuf {
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("felina-market-server-{nanos}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn get_returns_default_when_unset() {
        let _g = LOCK.lock().unwrap();
        let tmp = tempdir();
        set_felina_home_override_for_test(Some(tmp));
        assert_eq!(get_market_server_url().unwrap(), DEFAULT_URL);
        set_felina_home_override_for_test(None);
    }

    #[test]
    fn set_then_get_round_trip() {
        let _g = LOCK.lock().unwrap();
        let tmp = tempdir();
        set_felina_home_override_for_test(Some(tmp));
        set_market_server_url("https://market.internal.example:8080/".into()).unwrap();
        // Trailing slash trimmed on write.
        assert_eq!(
            get_market_server_url().unwrap(),
            "https://market.internal.example:8080"
        );
        set_felina_home_override_for_test(None);
    }

    #[test]
    fn set_rejects_empty_and_bad_scheme() {
        let _g = LOCK.lock().unwrap();
        let tmp = tempdir();
        set_felina_home_override_for_test(Some(tmp));
        assert!(set_market_server_url("".into()).is_err());
        assert!(set_market_server_url("   ".into()).is_err());
        assert!(set_market_server_url("ftp://x".into()).is_err());
        assert!(set_market_server_url("market.example".into()).is_err());
        set_felina_home_override_for_test(None);
    }

    #[test]
    fn set_preserves_unrelated_keys() {
        let _g = LOCK.lock().unwrap();
        let tmp = tempdir();
        set_felina_home_override_for_test(Some(tmp.clone()));
        let settings_path = paths::felina_global_settings_path();
        fs::create_dir_all(settings_path.parent().unwrap()).unwrap();
        fs::write(&settings_path, r#"{"agentPaths":{"keep":"me"}}"#).unwrap();
        set_market_server_url("http://localhost:3100".into()).unwrap();
        let raw = fs::read_to_string(&settings_path).unwrap();
        assert!(raw.contains("agentPaths"));
        assert!(raw.contains("marketServerUrl"));
        set_felina_home_override_for_test(None);
    }
}
