//! Token usage leaderboard client commands.
//!
//! Gathers all-time usage from the token aggregator (merged source) and submits
//! an opt-in summary + per-day contribution series to the market server, and
//! reads back the public ranking. Identity is the hub JWT; the leaderboard shows
//! only a self-chosen public handle, never the account email.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use tauri::State;

use crate::commands::tokens::TokenState;
use crate::paths;
use crate::tokens::types::{TimeGranularity, TokenAnalytics};

const HANDLE_KEY: &str = "leaderboardHandle";
/// Cap on the per-day series the client uploads (server rejects > 800).
const MAX_DAILY_ENTRIES: usize = 800;

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardSummary {
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub total_cost_usd: f64,
    pub event_count: u64,
    pub top_model: Option<String>,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct LeaderboardDailyEntry {
    pub day: String,
    pub tokens: u64,
    pub cost: f64,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LeaderboardModelEntry {
    pub model: String,
    pub provider: Option<String>,
    pub tokens: u64,
    pub cost: f64,
    pub event_count: u64,
}

#[derive(Serialize, Debug, PartialEq)]
pub struct LeaderboardSubmission {
    pub handle: String,
    pub summary: LeaderboardSummary,
    pub daily: Vec<LeaderboardDailyEntry>,
    pub models: Vec<LeaderboardModelEntry>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SubmitResult {
    pub rank: Option<u64>,
    pub submit_count: u64,
}

/// Build the upload payload from all-time daily analytics. Pure (no I/O) so the
/// summary/series derivation is unit-testable without a database.
fn build_submission(handle: String, analytics: &TokenAnalytics) -> LeaderboardSubmission {
    let mut daily: Vec<LeaderboardDailyEntry> = analytics
        .time_series
        .iter()
        .map(|bucket| {
            let tokens = bucket.input_tokens
                + bucket.output_tokens
                + bucket.cache_read_tokens
                + bucket.cache_write_tokens
                + bucket.reasoning_tokens;
            LeaderboardDailyEntry {
                day: bucket.label.clone(),
                tokens,
                cost: bucket.cost_usd,
            }
        })
        .filter(|entry| entry.tokens > 0)
        .collect();

    daily.sort_by(|a, b| a.day.cmp(&b.day));
    // Protect payload size: keep the most recent days if a user exceeds the cap.
    if daily.len() > MAX_DAILY_ENTRIES {
        daily.drain(0..daily.len() - MAX_DAILY_ENTRIES);
    }

    let summary = LeaderboardSummary {
        input_tokens: analytics.total_input_tokens,
        output_tokens: analytics.total_output_tokens,
        cache_read_tokens: analytics.total_cache_read_tokens,
        cache_write_tokens: analytics.total_cache_write_tokens,
        reasoning_tokens: analytics.total_reasoning_tokens,
        total_cost_usd: analytics.total_cost_usd,
        event_count: analytics.event_count,
        top_model: analytics.model_breakdown.first().map(|m| m.model.clone()),
    };

    let models = analytics
        .model_breakdown
        .iter()
        .map(|m| LeaderboardModelEntry {
            model: m.model.clone(),
            provider: if m.provider.is_empty() {
                None
            } else {
                Some(m.provider.clone())
            },
            tokens: m.input_tokens
                + m.output_tokens
                + m.cache_read_tokens
                + m.cache_write_tokens
                + m.reasoning_tokens,
            cost: m.cost_usd,
            event_count: m.event_count,
        })
        .collect();

    LeaderboardSubmission {
        handle,
        summary,
        daily,
        models,
    }
}

use super::hub_auth::is_token_expired;

async fn get_valid_token() -> Result<String, String> {
    let access_token =
        super::hub_auth::read_hub_access_token()?.ok_or_else(|| "請先登入 Hub 帳號".to_string())?;
    if !is_token_expired(&access_token) {
        return Ok(access_token);
    }
    super::hub_auth::try_refresh_token()
        .await
        .map_err(|_| "登入已過期，請重新登入".to_string())
}

fn leaderboard_base() -> Result<String, String> {
    Ok(super::market_server::get_market_server_url()?
        .trim_end_matches('/')
        .to_string())
}

async fn post_submission(
    base: &str,
    token: &str,
    submission: &LeaderboardSubmission,
) -> Result<SubmitResult, String> {
    let url = format!("{}/api/leaderboard/submit", base.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .post(url)
        .header("Authorization", format!("Bearer {token}"))
        .json(submission)
        .send()
        .await
        .map_err(|e| format!("submit failed: {e}"))?;

    let status = response.status();
    if status.is_success() {
        return response
            .json::<SubmitResult>()
            .await
            .map_err(|e| format!("failed to parse submit response: {e}"));
    }
    match status.as_u16() {
        401 => Err("登入已過期，請重新登入".to_string()),
        409 => Err("此暱稱已被使用，請換一個".to_string()),
        _ => {
            let body = response.text().await.unwrap_or_default();
            Err(format!("server returned {status}: {body}"))
        }
    }
}

#[tauri::command]
pub async fn submit_leaderboard_entry(
    handle: String,
    state: State<'_, TokenState>,
) -> Result<SubmitResult, String> {
    let token = get_valid_token().await?;

    // Build analytics under the lock, then release it before the async upload.
    let analytics = {
        let agg = state
            .aggregator
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        agg.build_analytics(
            TimeGranularity::Daily,
            None,
            None,
            None,
            None,
            Some("auto_dated".to_string()),
        )?
    };

    let submission = build_submission(handle.clone(), &analytics);
    let base = leaderboard_base()?;
    let result = post_submission(&base, &token, &submission).await?;
    let _ = set_handle_internal(&handle);
    Ok(result)
}

#[tauri::command]
pub async fn get_leaderboard(
    sort: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    days: Option<u32>,
) -> Result<Value, String> {
    let base = leaderboard_base()?;
    let mut url = format!("{}/api/leaderboard", base);
    let sort = sort.unwrap_or_else(|| "tokens".to_string());
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    url.push_str(&format!("?sort={sort}&limit={limit}&offset={offset}"));
    if let Some(days) = days {
        url.push_str(&format!("&days={days}"));
    }

    let client = reqwest::Client::new();
    let mut request = client.get(url);
    if let Ok(Some(token)) = super::hub_auth::read_hub_access_token() {
        if !is_token_expired(&token) {
            request = request.header("Authorization", format!("Bearer {token}"));
        }
    }
    let response = request
        .send()
        .await
        .map_err(|e| format!("failed to load leaderboard: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("server returned {status}: {body}"));
    }
    response
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse leaderboard: {e}"))
}

#[tauri::command]
pub async fn get_leaderboard_graph(handle: String) -> Result<Value, String> {
    let base = leaderboard_base()?;
    let url = format!("{}/api/leaderboard/{}/daily", base, handle);
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("failed to load contribution graph: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("server returned {status}: {body}"));
    }
    response
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse contribution graph: {e}"))
}

#[tauri::command]
pub async fn get_leaderboard_models(handle: String) -> Result<Value, String> {
    let base = leaderboard_base()?;
    let url = format!("{}/api/leaderboard/{}/models", base, handle);
    let response = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|e| format!("failed to load model breakdown: {e}"))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("server returned {status}: {body}"));
    }
    response
        .json::<Value>()
        .await
        .map_err(|e| format!("failed to parse model breakdown: {e}"))
}

#[tauri::command]
pub async fn remove_leaderboard_entry() -> Result<(), String> {
    let token = get_valid_token().await?;
    let base = leaderboard_base()?;
    let url = format!("{}/api/leaderboard/me", base);
    let response = reqwest::Client::new()
        .delete(url)
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("failed to remove entry: {e}"))?;
    let status = response.status();
    if status.is_success() {
        Ok(())
    } else if status.as_u16() == 401 {
        Err("登入已過期，請重新登入".to_string())
    } else {
        let body = response.text().await.unwrap_or_default();
        Err(format!("server returned {status}: {body}"))
    }
}

#[tauri::command]
pub fn get_leaderboard_handle() -> Result<Option<String>, String> {
    let path = paths::felina_global_settings_path();
    if !path.exists() {
        return Ok(None);
    }
    let raw =
        fs::read_to_string(&path).map_err(|e| format!("failed to read settings.json: {e}"))?;
    if raw.trim().is_empty() {
        return Ok(None);
    }
    let val: Value =
        serde_json::from_str(&raw).map_err(|e| format!("settings.json is not valid JSON: {e}"))?;
    Ok(val
        .get(HANDLE_KEY)
        .and_then(|v| v.as_str())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty()))
}

fn set_handle_internal(handle: &str) -> Result<(), String> {
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
    root.as_object_mut()
        .ok_or("settings.json root must be an object")?
        .insert(HANDLE_KEY.to_string(), Value::String(handle.to_string()));
    let pretty = serde_json::to_string_pretty(&root)
        .map_err(|e| format!("failed to encode settings.json: {e}"))?;
    fs::write(&path, pretty).map_err(|e| format!("failed to write settings.json: {e}"))
}

#[tauri::command]
pub fn set_leaderboard_handle(handle: String) -> Result<(), String> {
    set_handle_internal(&handle)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::types::{AgentId, ModelBreakdown, TokenBucket};
    use std::io::{Read, Write};
    use std::net::TcpListener;

    fn bucket(label: &str, input: u64, cost: f64) -> TokenBucket {
        TokenBucket {
            label: label.to_string(),
            input_tokens: input,
            output_tokens: 0,
            cache_read_tokens: 0,
            cache_write_tokens: 0,
            reasoning_tokens: 0,
            cost_usd: cost,
            event_count: 1,
            agent_count: 1,
            model_count: 1,
        }
    }

    fn analytics_with(buckets: Vec<TokenBucket>, top_model: &str) -> TokenAnalytics {
        TokenAnalytics {
            period_start: String::new(),
            period_end: String::new(),
            total_input_tokens: 500,
            total_output_tokens: 200,
            total_cache_read_tokens: 100,
            total_cache_write_tokens: 50,
            total_reasoning_tokens: 25,
            total_cost_usd: 3.5,
            event_count: 42,
            time_series: buckets,
            model_breakdown: vec![ModelBreakdown {
                model: top_model.to_string(),
                provider: "anthropic".into(),
                agent: AgentId::ClaudeCode,
                input_tokens: 500,
                output_tokens: 200,
                cache_read_tokens: 100,
                cache_write_tokens: 50,
                reasoning_tokens: 25,
                cost_usd: 3.5,
                event_count: 42,
                max_input_tokens: None,
            }],
            agent_breakdown: vec![],
            top_sessions: vec![],
            hourly_heatmap: vec![],
        }
    }

    #[test]
    fn build_submission_summarizes_and_filters_empty_days() {
        let analytics = analytics_with(
            vec![
                bucket("2026-06-02", 100, 0.5),
                bucket("2026-06-01", 0, 0.0), // zero-token day filtered out
                bucket("2026-05-30", 40, 0.2),
            ],
            "claude-opus-4-7",
        );
        let sub = build_submission("alice".into(), &analytics);

        assert_eq!(sub.handle, "alice");
        assert_eq!(sub.summary.input_tokens, 500);
        assert_eq!(sub.summary.total_cost_usd, 3.5);
        assert_eq!(sub.summary.event_count, 42);
        assert_eq!(sub.summary.top_model.as_deref(), Some("claude-opus-4-7"));
        // Only the two non-empty days, sorted ascending by date.
        assert_eq!(sub.daily.len(), 2);
        assert_eq!(sub.daily[0].day, "2026-05-30");
        assert_eq!(sub.daily[1].day, "2026-06-02");
        assert_eq!(sub.daily[1].tokens, 100);
        // Per-model breakdown carried from analytics (tokens = sum of all 5 types).
        assert_eq!(sub.models.len(), 1);
        assert_eq!(sub.models[0].model, "claude-opus-4-7");
        assert_eq!(sub.models[0].tokens, 875);
        assert_eq!(sub.models[0].provider.as_deref(), Some("anthropic"));
    }

    fn spawn_server(
        status: &'static str,
        body: &'static str,
    ) -> (String, std::thread::JoinHandle<Vec<u8>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            let mut buffer = [0_u8; 4096];
            loop {
                let n = stream.read(&mut buffer).unwrap();
                if n == 0 {
                    break;
                }
                request.extend_from_slice(&buffer[..n]);
                if let Some(header_end) = request.windows(4).position(|w| w == b"\r\n\r\n") {
                    let headers = String::from_utf8_lossy(&request[..header_end]);
                    let content_length = headers
                        .lines()
                        .find_map(|line| {
                            let lower = line.to_ascii_lowercase();
                            lower
                                .strip_prefix("content-length:")
                                .map(|v| v.trim().to_string())
                        })
                        .and_then(|value| value.parse::<usize>().ok())
                        .unwrap_or(0);
                    if request.len() >= header_end + 4 + content_length {
                        break;
                    }
                }
            }
            let response = format!(
                "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            stream.write_all(response.as_bytes()).unwrap();
            request
        });
        (url, handle)
    }

    fn sample_submission() -> LeaderboardSubmission {
        build_submission(
            "alice".into(),
            &analytics_with(vec![bucket("2026-06-01", 100, 0.5)], "claude-opus-4-7"),
        )
    }

    #[tokio::test]
    async fn post_submission_sends_bearer_and_payload_and_parses_result() {
        let (url, handle) = spawn_server("200 OK", r#"{"rank":3,"submitCount":2}"#);
        let result = post_submission(&url, "tok123", &sample_submission())
            .await
            .unwrap();
        assert_eq!(result.rank, Some(3));
        assert_eq!(result.submit_count, 2);

        let request = handle.join().unwrap();
        let text = String::from_utf8_lossy(&request);
        assert!(text.starts_with("POST /api/leaderboard/submit HTTP/1.1"));
        assert!(text.contains("authorization: Bearer tok123"));
        assert!(text.contains("\"handle\":\"alice\""));
        assert!(text.contains("\"summary\""));
        assert!(text.contains("\"inputTokens\":500"));
        assert!(text.contains("\"daily\""));
        assert!(text.contains("\"models\""));
    }

    #[tokio::test]
    async fn post_submission_maps_401_to_relogin() {
        let (url, handle) = spawn_server("401 Unauthorized", "unauthorized");
        let err = post_submission(&url, "tok", &sample_submission())
            .await
            .unwrap_err();
        assert!(err.contains("登入已過期"));
        let _ = handle.join().unwrap();
    }

    #[tokio::test]
    async fn post_submission_maps_409_to_handle_taken() {
        let (url, handle) = spawn_server("409 Conflict", "handle already taken");
        let err = post_submission(&url, "tok", &sample_submission())
            .await
            .unwrap_err();
        assert!(err.contains("暱稱"));
        let _ = handle.join().unwrap();
    }
}
