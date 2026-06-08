use crate::paths;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;

const HUB_ACCESS_TOKEN_KEY: &str = "hubAccessToken";
const HUB_REFRESH_TOKEN_KEY: &str = "hubRefreshToken";
const HUB_EMAIL_KEY: &str = "hubEmail";

#[derive(Serialize, Deserialize)]
pub struct HubAuthResult {
    pub access_token: String,
    pub refresh_token: String,
    pub email: String,
}

#[derive(Serialize)]
pub struct HubAuthStatus {
    pub email: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthResponse {
    access_token: String,
    refresh_token: String,
    email: String,
}

fn read_settings() -> Result<Value, String> {
    let path = paths::felina_global_settings_path();
    if !path.exists() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    let raw = fs::read_to_string(&path)
        .map_err(|e| format!("failed to read settings.json: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    serde_json::from_str(&raw).map_err(|e| format!("settings.json is not valid JSON: {e}"))
}

fn write_settings(root: &Value) -> Result<(), String> {
    let path = paths::felina_global_settings_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create settings dir: {e}"))?;
    }
    let pretty = serde_json::to_string_pretty(root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    fs::write(&path, pretty).map_err(|e| format!("failed to write settings.json: {e}"))
}

pub fn save_auth_public(access_token: &str, refresh_token: &str, email: &str) -> Result<(), String> {
    save_auth(access_token, refresh_token, email)
}

fn save_auth(access_token: &str, refresh_token: &str, email: &str) -> Result<(), String> {
    let mut root = read_settings()?;
    let obj = root
        .as_object_mut()
        .ok_or("settings.json root must be an object")?;
    obj.insert(HUB_ACCESS_TOKEN_KEY.to_string(), Value::String(access_token.to_string()));
    obj.insert(HUB_REFRESH_TOKEN_KEY.to_string(), Value::String(refresh_token.to_string()));
    obj.insert(HUB_EMAIL_KEY.to_string(), Value::String(email.to_string()));
    write_settings(&root)
}

#[tauri::command]
pub fn read_hub_access_token() -> Result<Option<String>, String> {
    let root = read_settings()?;
    Ok(root
        .get(HUB_ACCESS_TOKEN_KEY)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string()))
}

pub fn read_hub_refresh_token() -> Result<Option<String>, String> {
    let root = read_settings()?;
    Ok(root
        .get(HUB_REFRESH_TOKEN_KEY)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string()))
}

async fn auth_request(
    endpoint: &str,
    email: &str,
    password: &str,
) -> Result<HubAuthResult, String> {
    let base = super::market_server::get_market_server_url()?;
    let url = format!("{}/{}", base.trim_end_matches('/'), endpoint);
    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| format!("request failed: {e}"))?;

    let status = response.status();
    let body = response.text().await.unwrap_or_default();

    if status.as_u16() == 409 {
        return Err("此 email 已註冊".to_string());
    }
    if status.as_u16() == 401 {
        return Err("帳號或密碼錯誤".to_string());
    }
    if !status.is_success() {
        return Err(format!("server returned {status}: {body}"));
    }

    let auth: AuthResponse =
        serde_json::from_str(&body).map_err(|e| format!("parse error: {e}"))?;
    save_auth(&auth.access_token, &auth.refresh_token, &auth.email)?;
    Ok(HubAuthResult {
        access_token: auth.access_token,
        refresh_token: auth.refresh_token,
        email: auth.email,
    })
}

#[tauri::command]
pub async fn register_hub_account(
    email: String,
    password: String,
) -> Result<HubAuthResult, String> {
    auth_request("auth/register", &email, &password).await
}

#[tauri::command]
pub async fn login_hub_account(
    email: String,
    password: String,
) -> Result<HubAuthResult, String> {
    auth_request("auth/login", &email, &password).await
}

#[tauri::command]
pub fn get_hub_auth_status() -> Result<Option<HubAuthStatus>, String> {
    let root = read_settings()?;
    let email = root
        .get(HUB_EMAIL_KEY)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    let token = root
        .get(HUB_ACCESS_TOKEN_KEY)
        .and_then(|v| v.as_str())
        .filter(|s| !s.is_empty());
    match (email, token) {
        (Some(email), Some(_)) => Ok(Some(HubAuthStatus {
            email: email.to_string(),
        })),
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn logout_hub_account() -> Result<(), String> {
    let mut root = read_settings()?;
    if let Some(obj) = root.as_object_mut() {
        obj.remove(HUB_ACCESS_TOKEN_KEY);
        obj.remove(HUB_REFRESH_TOKEN_KEY);
        obj.remove(HUB_EMAIL_KEY);
    }
    write_settings(&root)
}
