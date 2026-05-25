use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use tauri::State;
use walkdir::WalkDir;

use crate::tokens::aggregator::TokenAggregator;
use crate::tokens::types::*;

type SessionRoots = Vec<(AgentId, Vec<PathBuf>)>;

fn session_search_roots(agent: &AgentId) -> Vec<PathBuf> {
    let home = dirs::home_dir().unwrap_or_default();
    match agent {
        AgentId::CodexCli => vec![home.join(".codex").join("sessions")],
        AgentId::ClaudeCode => vec![home.join(".claude").join("projects"), home.join(".claude")],
        AgentId::GeminiCli => vec![home.join(".gemini").join("tmp")],
    }
}

fn default_session_roots() -> SessionRoots {
    vec![
        (
            AgentId::ClaudeCode,
            session_search_roots(&AgentId::ClaudeCode),
        ),
        (AgentId::CodexCli, session_search_roots(&AgentId::CodexCli)),
        (
            AgentId::GeminiCli,
            session_search_roots(&AgentId::GeminiCli),
        ),
    ]
}

fn is_supported_transcript_file(path: &Path, session_id: &str) -> bool {
    let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
        return false;
    };
    if stem != session_id {
        return false;
    }

    matches!(
        path.extension().and_then(|e| e.to_str()),
        Some("jsonl") | Some("json")
    )
}

fn find_session_transcript_path_in_roots(
    agent: &AgentId,
    session_id: &str,
    roots_by_agent: &[(AgentId, Vec<PathBuf>)],
) -> Option<PathBuf> {
    if session_id.trim().is_empty() {
        return None;
    }

    let roots = roots_by_agent
        .iter()
        .find(|(root_agent, _)| root_agent == agent)
        .map(|(_, roots)| roots.as_slice())
        .unwrap_or(&[]);

    for root in roots {
        if !root.exists() {
            continue;
        }

        for entry in WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_map(Result::ok)
        {
            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            if is_supported_transcript_file(path, session_id) {
                return Some(path.to_path_buf());
            }
        }
    }

    None
}

fn find_session_transcript_path(agent: &AgentId, session_id: &str) -> Option<PathBuf> {
    find_session_transcript_path_in_roots(agent, session_id, &default_session_roots())
}

fn parse_agent_id(value: &str) -> AgentId {
    match value {
        "codex-cli" => AgentId::CodexCli,
        "gemini-cli" => AgentId::GeminiCli,
        _ => AgentId::ClaudeCode,
    }
}

fn project_from_path(agent: &AgentId, path: &Path) -> Option<String> {
    match agent {
        AgentId::ClaudeCode => path
            .parent()
            .and_then(|p| p.file_name())
            .map(|n| n.to_string_lossy().to_string()),
        _ => None,
    }
}

fn pick_history_source(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT source
             FROM token_events
             WHERE session_id IS NOT NULL
               AND session_id != ''
               AND session_id NOT LIKE 'tokscale-%'
             GROUP BY source
             ORDER BY COALESCE(SUM(event_count),0) DESC
             LIMIT 1",
        )
        .map_err(|e| format!("history source query: {}", e))?;

    match stmt.query_row([], |row| row.get::<_, String>(0)) {
        Ok(source) => Ok(Some(source)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("history source row: {}", e)),
    }
}

#[cfg(test)]
fn build_history_sessions_from_roots(
    aggregator: &TokenAggregator,
    roots_by_agent: &[(AgentId, Vec<PathBuf>)],
) -> Result<Vec<HistorySession>, String> {
    Ok(
        build_history_sessions_page_from_roots(aggregator, roots_by_agent, 10_000, 0, None, None)?
            .sessions,
    )
}

fn build_history_sessions_page_from_roots(
    aggregator: &TokenAggregator,
    roots_by_agent: &[(AgentId, Vec<PathBuf>)],
    limit: u64,
    offset: u64,
    agent_filter: Option<String>,
    query: Option<String>,
) -> Result<HistorySessionsPage, String> {
    let conn = aggregator
        .storage
        .connection()
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    let Some(source) = pick_history_source(&conn)? else {
        return Ok(HistorySessionsPage {
            sessions: Vec::new(),
            total: 0,
        });
    };

    let mut conditions = vec![
        "source = ?".to_string(),
        "session_id IS NOT NULL".to_string(),
        "session_id != ''".to_string(),
        "session_id NOT LIKE 'tokscale-%'".to_string(),
    ];
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(source)];

    if let Some(agent) = agent_filter.filter(|value| value != "all" && !value.is_empty()) {
        conditions.push("agent = ?".to_string());
        values.push(Box::new(agent));
    }

    if let Some(q) = query
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty())
    {
        conditions.push(
            "(LOWER(session_id) LIKE ? OR LOWER(COALESCE(project,'')) LIKE ? OR LOWER(COALESCE(model,'')) LIKE ?)"
                .to_string(),
        );
        let pattern = format!("%{}%", q);
        values.push(Box::new(pattern.clone()));
        values.push(Box::new(pattern.clone()));
        values.push(Box::new(pattern));
    }

    let where_clause = format!("WHERE {}", conditions.join(" AND "));
    let params_refs: Vec<&dyn rusqlite::types::ToSql> =
        values.iter().map(|value| value.as_ref()).collect();

    let count_sql = format!(
        "SELECT COUNT(*) FROM (
            SELECT 1 FROM token_events {}
            GROUP BY agent, session_id
         )",
        where_clause
    );
    let total = conn
        .query_row(&count_sql, params_refs.as_slice(), |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|e| format!("history sessions count: {}", e))?
        .max(0) as u64;

    let page_limit = limit.clamp(1, 100);
    let sql = format!(
        "SELECT agent,
                session_id,
                project,
                model,
                NULLIF(MAX(timestamp), 0),
                COALESCE(SUM(input_tokens+output_tokens+cache_read_tokens+cache_write_tokens),0),
                COALESCE(SUM(event_count),0)
         FROM token_events {}
         GROUP BY agent, session_id
         ORDER BY NULLIF(MAX(timestamp), 0) DESC,
                  COALESCE(SUM(input_tokens+output_tokens+cache_read_tokens+cache_write_tokens),0) DESC,
                  agent ASC,
                  session_id ASC
         LIMIT ? OFFSET ?",
        where_clause
    );

    values.push(Box::new(page_limit as i64));
    values.push(Box::new(offset as i64));
    let page_params_refs: Vec<&dyn rusqlite::types::ToSql> =
        values.iter().map(|value| value.as_ref()).collect();

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("history sessions query: {}", e))?;
    let rows = stmt
        .query_map(page_params_refs.as_slice(), |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, Option<i64>>(4)?,
                row.get::<_, i64>(5)? as u64,
                row.get::<_, i64>(6)? as u64,
            ))
        })
        .map_err(|e| format!("history sessions map: {}", e))?;

    let mut sessions = Vec::new();
    for row in rows.flatten() {
        let (agent_raw, session_id, project, model, timestamp, tokens, messages) = row;
        let agent = parse_agent_id(&agent_raw);
        let source_path =
            find_session_transcript_path_in_roots(&agent, &session_id, roots_by_agent)
                .map(|path| path.to_string_lossy().to_string());
        sessions.push(HistorySession {
            agent,
            session_id,
            project,
            model,
            timestamp,
            tokens,
            messages,
            transcript_available: source_path.is_some(),
            source_path,
        });
    }
    drop(stmt);
    drop(conn);

    Ok(HistorySessionsPage { sessions, total })
}

fn extract_text(value: &serde_json::Value) -> Option<String> {
    match value {
        serde_json::Value::String(text) => Some(text.clone()),
        serde_json::Value::Array(items) => {
            let parts = items
                .iter()
                .filter_map(extract_text)
                .filter(|part| !part.trim().is_empty())
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        serde_json::Value::Object(map) => {
            if let Some(text) = map.get("text").and_then(|v| v.as_str()) {
                return Some(text.to_string());
            }
            if let Some(content) = map.get("content").and_then(extract_text) {
                return Some(content);
            }
            None
        }
        _ => None,
    }
}

fn normalized_role(raw: Option<&str>, fallback: &str) -> String {
    match raw.unwrap_or(fallback) {
        "user" => "user",
        "assistant" => "assistant",
        "system" => "system",
        "reasoning" | "function_call" | "tool_result" | "function_call_output" => "assistant",
        "tool" => "tool",
        "token_count" | "usage" => "usage",
        _ => "assistant",
    }
    .to_string()
}

fn role_from_content(value: &serde_json::Value) -> Option<&'static str> {
    match value {
        serde_json::Value::Array(items) => items.iter().find_map(role_from_content),
        serde_json::Value::Object(map) => {
            match map.get("type").and_then(|v| v.as_str()) {
                Some("input_text") => return Some("user"),
                Some("output_text") | Some("text") => return Some("assistant"),
                Some("tool_result") | Some("function_call_output") => return Some("assistant"),
                _ => {}
            }
            map.get("content").and_then(role_from_content)
        }
        _ => None,
    }
}

fn has_content_field(item: &serde_json::Value) -> bool {
    item.get("content")
        .and_then(extract_text)
        .map(|content| !content.trim().is_empty())
        .unwrap_or(false)
}

fn infer_transcript_role(item: &serde_json::Value, line_type: Option<&str>) -> String {
    let explicit_role = item.get("role").and_then(|v| v.as_str());
    let content_role = item.get("content").and_then(role_from_content);
    if let Some(role @ ("user" | "assistant" | "tool")) = content_role {
        return normalized_role(Some(role), "assistant");
    }
    if has_content_field(item) {
        return normalized_role(explicit_role, "assistant");
    }

    let raw_role = item
        .get("type")
        .and_then(|v| v.as_str())
        .filter(|role| *role != "message")
        .or_else(|| line_type.filter(|role| *role != "response_item"));

    normalized_role(raw_role, "assistant")
}

fn u64_at<'a>(value: &'a serde_json::Value, path: &[&str]) -> Option<u64> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    current.as_u64()
}

fn transcript_entries_from_value(value: &serde_json::Value) -> Vec<TranscriptEntry> {
    let timestamp = value
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let mut entries = Vec::new();

    if value.get("type").and_then(|v| v.as_str()) == Some("event_msg")
        && value
            .get("payload")
            .and_then(|p| p.get("type"))
            .and_then(|v| v.as_str())
            == Some("token_count")
    {
        let usage = value
            .get("payload")
            .and_then(|p| p.get("info"))
            .and_then(|i| {
                i.get("last_token_usage")
                    .or_else(|| i.get("total_token_usage"))
            });
        if let Some(usage) = usage {
            let input = usage.get("input_tokens").and_then(|v| v.as_u64());
            let output = usage.get("output_tokens").and_then(|v| v.as_u64());
            entries.push(TranscriptEntry {
                role: "usage".to_string(),
                content: "Token usage".to_string(),
                timestamp,
                model: None,
                input_tokens: input,
                output_tokens: output,
                cache_read_tokens: usage.get("cached_input_tokens").and_then(|v| v.as_u64()),
                cache_write_tokens: None,
                reasoning_tokens: usage
                    .get("reasoning_output_tokens")
                    .and_then(|v| v.as_u64()),
            });
        }
        return entries;
    }

    let item = value
        .get("payload")
        .and_then(|p| p.get("item"))
        .or_else(|| value.get("item"))
        .or_else(|| value.get("message"));

    if let Some(item) = item {
        let role = infer_transcript_role(item, value.get("type").and_then(|v| v.as_str()));
        if let Some(content) = item.get("content").and_then(extract_text) {
            entries.push(TranscriptEntry {
                role,
                content,
                timestamp: timestamp.clone(),
                model: item
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                input_tokens: None,
                output_tokens: None,
                cache_read_tokens: None,
                cache_write_tokens: None,
                reasoning_tokens: None,
            });
        }

        if item.get("usage").is_some() {
            entries.push(TranscriptEntry {
                role: "usage".to_string(),
                content: "Token usage".to_string(),
                timestamp,
                model: item
                    .get("model")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                input_tokens: u64_at(item, &["usage", "input_tokens"]),
                output_tokens: u64_at(item, &["usage", "output_tokens"]),
                cache_read_tokens: u64_at(item, &["usage", "cache_read_input_tokens"]),
                cache_write_tokens: u64_at(item, &["usage", "cache_creation_input_tokens"]),
                reasoning_tokens: u64_at(item, &["usage", "reasoning_tokens"]),
            });
        }
    }

    entries
}

fn read_session_transcript_from_path(
    agent: AgentId,
    session_id: String,
    path: &Path,
) -> Result<SessionTranscript, String> {
    let file = fs::File::open(path)
        .map_err(|e| format!("Cannot open transcript {}: {}", path.display(), e))?;
    let reader = BufReader::new(file);
    let mut entries = Vec::new();
    let mut metadata = TranscriptMetadata {
        project: project_from_path(&agent, path),
        ..TranscriptMetadata::default()
    };

    for (index, line) in reader.lines().enumerate() {
        let line = line.map_err(|e| format!("Cannot read transcript line {}: {}", index + 1, e))?;
        if line.trim().is_empty() {
            continue;
        }
        let value: serde_json::Value = serde_json::from_str(&line)
            .map_err(|e| format!("Cannot parse transcript line {}: {}", index + 1, e))?;

        if metadata.timestamp.is_none() {
            metadata.timestamp = value
                .get("timestamp")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }
        if metadata.model.is_none() {
            metadata.model = value
                .get("payload")
                .and_then(|p| p.get("model"))
                .or_else(|| value.get("message").and_then(|m| m.get("model")))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
        }

        entries.extend(transcript_entries_from_value(&value));
    }

    Ok(SessionTranscript {
        agent,
        session_id,
        source_path: path.to_string_lossy().to_string(),
        metadata,
        entries,
    })
}

fn read_session_transcript_from_roots(
    agent: AgentId,
    session_id: String,
    roots_by_agent: &[(AgentId, Vec<PathBuf>)],
) -> Result<SessionTranscript, String> {
    let path = find_session_transcript_path_in_roots(&agent, &session_id, roots_by_agent)
        .ok_or_else(|| "Session transcript file was not found".to_string())?;
    read_session_transcript_from_path(agent, session_id, &path)
}

fn reveal_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let status = Command::new("open")
        .arg("-R")
        .arg(path)
        .status()
        .map_err(|e| format!("Cannot reveal transcript: {}", e))?;

    #[cfg(target_os = "windows")]
    let status = Command::new("explorer")
        .arg(format!("/select,{}", path.display()))
        .status()
        .map_err(|e| format!("Cannot reveal transcript: {}", e))?;

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open")
        .arg(path.parent().unwrap_or(path))
        .status()
        .map_err(|e| format!("Cannot reveal transcript: {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Reveal command exited with status {}", status))
    }
}

#[tauri::command]
pub fn resolve_session_transcript(
    agent: AgentId,
    session_id: String,
) -> Result<SessionTranscriptLocation, String> {
    let path = find_session_transcript_path(&agent, &session_id)
        .ok_or_else(|| "Session transcript file was not found".to_string())?;

    Ok(SessionTranscriptLocation {
        agent,
        session_id,
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn reveal_session_transcript(
    agent: AgentId,
    session_id: String,
) -> Result<SessionTranscriptLocation, String> {
    let location = resolve_session_transcript(agent, session_id)?;
    reveal_path(Path::new(&location.path))?;
    Ok(location)
}

#[tauri::command]
pub fn list_history_sessions(
    limit: Option<u64>,
    offset: Option<u64>,
    agent_filter: Option<String>,
    query: Option<String>,
    state: State<'_, TokenState>,
) -> Result<HistorySessionsPage, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    build_history_sessions_page_from_roots(
        &agg,
        &default_session_roots(),
        limit.unwrap_or(50),
        offset.unwrap_or(0),
        agent_filter,
        query,
    )
}

#[tauri::command]
pub fn read_session_transcript(
    agent: AgentId,
    session_id: String,
) -> Result<SessionTranscript, String> {
    read_session_transcript_from_roots(agent, session_id, &default_session_roots())
}

#[tauri::command]
pub async fn get_agent_quota_snapshot() -> Result<crate::tokens::ccusage::QuotaSnapshot, String> {
    tokio::task::spawn_blocking(crate::tokens::ccusage::get_quota_snapshot_cached)
        .await
        .map_err(|e| format!("Task join error: {}", e))
}

#[tauri::command]
pub fn get_token_analytics_pair(
    date_start: Option<i64>,
    date_end: Option<i64>,
    monthly_source: Option<String>,
    daily_source: Option<String>,
    state: State<'_, TokenState>,
) -> Result<TokenAnalyticsPair, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_analytics_pair(date_start, date_end, monthly_source, daily_source)
}

/// Managed state wrapping the TokenAggregator.
pub struct TokenState {
    pub aggregator: Arc<Mutex<TokenAggregator>>,
}

impl TokenState {
    pub fn new() -> Result<Self, String> {
        let aggregator = TokenAggregator::new()?;
        Ok(TokenState {
            aggregator: Arc::new(Mutex::new(aggregator)),
        })
    }
}

#[tauri::command]
pub fn get_token_analytics(
    granularity: String,
    date_start: Option<i64>,
    date_end: Option<i64>,
    filter_agent: Option<String>,
    filter_model: Option<String>,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<TokenAnalytics, String> {
    let g = match granularity.as_str() {
        "hourly" => TimeGranularity::Hourly,
        "weekly" => TimeGranularity::Weekly,
        "monthly" => TimeGranularity::Monthly,
        _ => TimeGranularity::Daily,
    };

    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_analytics(
        g,
        date_start,
        date_end,
        filter_agent,
        filter_model,
        source_override,
    )
}

#[tauri::command]
pub fn get_model_breakdown(
    date_start: Option<i64>,
    date_end: Option<i64>,
    state: State<'_, TokenState>,
) -> Result<Vec<ModelBreakdown>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.get_model_breakdown(date_start, date_end)
}

#[tauri::command]
pub fn get_cache_efficiency(
    date_start: Option<i64>,
    date_end: Option<i64>,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<CacheEfficiency, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_cache_efficiency(date_start, date_end, source_override)
}

#[tauri::command]
pub fn get_day_hourly(
    date: String,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<crate::tokens::types::DayHourlyBucket>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_hourly(&date, source_override)
}

#[tauri::command]
pub fn get_day_project_breakdown(
    date: String,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<crate::tokens::types::DayProjectBreakdown>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_project_breakdown(&date, source_override)
}

#[tauri::command]
pub fn get_day_top_sessions(
    date: String,
    limit: u64,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<crate::tokens::types::DaySessionBreakdown>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_top_sessions(&date, limit, source_override)
}

#[tauri::command]
pub fn get_day_model_breakdown(
    date: String,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<ModelBreakdown>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_model_breakdown(&date, source_override)
}

#[tauri::command]
pub fn get_available_agents(state: State<'_, TokenState>) -> Result<Vec<AgentStatus>, String> {
    let agg = state
        .aggregator
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    agg.get_agent_status()
}

#[tauri::command]
pub async fn refresh_token_data(state: State<'_, TokenState>) -> Result<RefreshResult, String> {
    // Clone the Arc so we can move it into spawn_blocking
    let aggregator = state.aggregator.clone();

    // Spawn blocking work on tokio's thread pool so the UI stays responsive
    let result = tokio::task::spawn_blocking(move || {
        let agg = aggregator
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        agg.refresh_with_options(true)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tokens::pricing::PricingService;
    use crate::tokens::storage::TokenStorage;

    fn temp_dir(name: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("felina_history_{}_{}", name, std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    fn temp_db(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("felina_history_{}_{}.db", name, std::process::id()))
    }

    fn cleanup_path(path: &Path) {
        let _ = fs::remove_file(path);
        let _ = fs::remove_file(path.with_extension("db-wal"));
        let _ = fs::remove_file(path.with_extension("db-shm"));
        let _ = fs::remove_dir_all(path);
    }

    fn aggregator(name: &str) -> (TokenAggregator, PathBuf) {
        let db = temp_db(name);
        cleanup_path(&db);
        let storage = TokenStorage::with_path(db.clone()).expect("storage");
        (
            TokenAggregator {
                storage,
                pricing: Mutex::new(PricingService::new()),
                dated_source_cache: Mutex::new(None),
            },
            db,
        )
    }

    fn token_event(agent: AgentId, session_id: &str) -> TokenEvent {
        TokenEvent {
            agent,
            provider: "openai".into(),
            model: "gpt-5".into(),
            timestamp: 1_700_000_000,
            input_tokens: 800,
            output_tokens: 300,
            cache_read_tokens: 50,
            cache_write_tokens: 50,
            reasoning_tokens: 0,
            project: Some("felina".into()),
            session_id: Some(session_id.into()),
        }
    }

    #[test]
    fn history_sessions_merge_token_totals_with_resolved_transcript_file() {
        let (aggregator, db) = aggregator("sessions_merge");
        let root = temp_dir("codex_root");
        let transcript = root.join("abc123.jsonl");
        fs::write(
            &transcript,
            r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"role":"user","content":[{"type":"input_text","text":"hello"}]}}}"#,
        )
        .expect("write transcript");
        aggregator
            .storage
            .upsert_events(&[token_event(AgentId::CodexCli, "abc123")])
            .expect("insert token event");

        let sessions = build_history_sessions_from_roots(
            &aggregator,
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("history sessions");

        let row = sessions
            .iter()
            .find(|session| session.session_id == "abc123")
            .expect("session row");
        assert_eq!(row.agent, AgentId::CodexCli);
        assert_eq!(row.messages, 1);
        assert_eq!(row.tokens, 1_200);
        assert!(row.transcript_available);
        assert_eq!(
            row.source_path.as_deref(),
            Some(transcript.to_string_lossy().as_ref())
        );
        cleanup_path(&root);
        cleanup_path(&db);
    }

    #[test]
    fn history_sessions_do_not_import_transcript_only_zero_usage_rows() {
        let (aggregator, db) = aggregator("sessions_skip_zero_usage");
        let root = temp_dir("transcript_only_root");
        fs::write(
            root.join("empty-session.jsonl"),
            r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"role":"user","content":[{"type":"input_text","text":"hello"}]}}}"#,
        )
        .expect("write transcript");

        let sessions = build_history_sessions_from_roots(
            &aggregator,
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("history sessions");

        assert!(sessions.is_empty());
        cleanup_path(&root);
        cleanup_path(&db);
    }

    #[test]
    fn history_sessions_hide_legacy_synthetic_tokscale_rows() {
        let (aggregator, db) = aggregator("sessions_hide_synthetic_tokscale");
        aggregator
            .storage
            .upsert_events(&[token_event(AgentId::ClaudeCode, "tokscale-claude")])
            .expect("insert token event");

        let sessions =
            build_history_sessions_from_roots(&aggregator, &[]).expect("history sessions");

        assert!(sessions.is_empty());
        cleanup_path(&db);
    }

    #[test]
    fn history_sessions_use_real_session_source_when_tokscale_is_active() {
        let (aggregator, db) = aggregator("sessions_real_source_with_tokscale_active");
        let root = temp_dir("codex_real_source_root");
        let transcript = root.join("abc123.jsonl");
        fs::write(
            &transcript,
            r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"role":"user","content":[{"type":"input_text","text":"hello"}]}}}"#,
        )
        .expect("write transcript");
        aggregator
            .storage
            .upsert_events(&[token_event(AgentId::CodexCli, "abc123")])
            .expect("insert parser event");

        let mut aggregate = token_event(AgentId::ClaudeCode, "unused");
        aggregate.session_id = None;
        aggregator
            .storage
            .replace_tokscale_records(&[(&aggregate, 42)], "tokscale-test")
            .expect("replace tokscale");

        let sessions = build_history_sessions_from_roots(
            &aggregator,
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("history sessions");

        assert_eq!(sessions.len(), 1);
        assert_eq!(sessions[0].session_id, "abc123");
        assert_eq!(
            sessions[0].source_path.as_deref(),
            Some(transcript.to_string_lossy().as_ref())
        );
        cleanup_path(&root);
        cleanup_path(&db);
    }

    #[test]
    fn history_sessions_page_applies_limit_offset_and_total() {
        let (aggregator, db) = aggregator("sessions_page");
        aggregator
            .storage
            .upsert_events(&[
                token_event(AgentId::CodexCli, "older"),
                token_event(AgentId::CodexCli, "newer"),
            ])
            .expect("insert token events");

        let page = build_history_sessions_page_from_roots(
            &aggregator,
            &[],
            1,
            1,
            Some("codex-cli".into()),
            None,
        )
        .expect("history page");

        assert_eq!(page.total, 2);
        assert_eq!(page.sessions.len(), 1);
        cleanup_path(&db);
    }

    #[test]
    fn read_session_transcript_from_roots_returns_normalized_entries() {
        let root = temp_dir("read_codex");
        fs::write(
            root.join("abc123.jsonl"),
            concat!(
                r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"role":"user","content":[{"type":"input_text","text":"hello"}]}}}"#,
                "\n",
                r#"{"timestamp":"2026-05-20T00:00:01Z","type":"response_item","payload":{"item":{"role":"assistant","content":[{"type":"output_text","text":"hi"}]}}}"#,
                "\n",
                r#"{"timestamp":"2026-05-20T00:00:02Z","type":"event_msg","payload":{"type":"token_count","info":{"last_token_usage":{"input_tokens":10,"output_tokens":5,"cached_input_tokens":3,"reasoning_output_tokens":2}}}}"#,
                "\n",
            ),
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::CodexCli,
            "abc123".into(),
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(transcript.agent, AgentId::CodexCli);
        assert_eq!(transcript.session_id, "abc123");
        assert_eq!(transcript.entries.len(), 3);
        assert_eq!(transcript.entries[0].role, "user");
        assert_eq!(transcript.entries[0].content, "hello");
        assert_eq!(transcript.entries[1].role, "assistant");
        assert_eq!(transcript.entries[1].content, "hi");
        assert_eq!(transcript.entries[2].role, "usage");
        assert_eq!(transcript.entries[2].input_tokens, Some(10));
        assert_eq!(transcript.entries[2].cache_read_tokens, Some(3));
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_infers_roles_from_content_item_types() {
        let root = temp_dir("read_content_roles");
        fs::write(
            root.join("contentroles.jsonl"),
            concat!(
                r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"type":"message","content":[{"type":"input_text","text":"hello"}]}}}"#,
                "\n",
                r#"{"timestamp":"2026-05-20T00:00:01Z","type":"response_item","payload":{"item":{"type":"message","content":[{"type":"output_text","text":"hi"}]}}}"#,
                "\n",
            ),
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::CodexCli,
            "contentroles".into(),
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(transcript.entries.len(), 2);
        assert_eq!(transcript.entries[0].role, "user");
        assert_eq!(transcript.entries[0].content, "hello");
        assert_eq!(transcript.entries[1].role, "assistant");
        assert_eq!(transcript.entries[1].content, "hi");
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_defaults_content_entries_to_agent_unless_user() {
        let root = temp_dir("read_unknown_agent_roles");
        fs::write(
            root.join("unknownagent.jsonl"),
            concat!(
                r#"{"timestamp":"2026-05-20T00:00:00Z","type":"response_item","payload":{"item":{"type":"message","content":"agent-side status text"}}}"#,
                "\n",
                r#"{"timestamp":"2026-05-20T00:00:01Z","type":"user","payload":{"item":{"type":"message","content":"content-bearing event from agent stream"}}}"#,
                "\n",
            ),
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::CodexCli,
            "unknownagent".into(),
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(transcript.entries.len(), 2);
        assert_eq!(transcript.entries[0].role, "assistant");
        assert_eq!(transcript.entries[0].content, "agent-side status text");
        assert_eq!(transcript.entries[1].role, "assistant");
        assert_eq!(
            transcript.entries[1].content,
            "content-bearing event from agent stream"
        );
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_treats_tool_results_as_agent_even_when_message_role_is_user() {
        let root = temp_dir("read_tool_result_agent");
        fs::write(
            root.join("toolresult.jsonl"),
            r#"{"timestamp":"2026-05-20T00:00:00Z","type":"user","message":{"role":"user","content":[{"tool_use_id":"toolu_01","type":"tool_result","content":"command output from tool"}]}}"#,
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::ClaudeCode,
            "toolresult".into(),
            &[(AgentId::ClaudeCode, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(transcript.entries.len(), 1);
        assert_eq!(transcript.entries[0].role, "assistant");
        assert_eq!(transcript.entries[0].content, "command output from tool");
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_keeps_plain_user_message_content_as_user() {
        let root = temp_dir("read_plain_user_message");
        fs::write(
            root.join("plainuser.jsonl"),
            r#"{"timestamp":"2026-05-22T16:08:00.796Z","type":"user","message":{"role":"user","content":"請你幫我找開源多like的tokens整合項目，至少四個"}}"#,
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::ClaudeCode,
            "plainuser".into(),
            &[(AgentId::ClaudeCode, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(transcript.entries.len(), 1);
        assert_eq!(transcript.entries[0].role, "user");
        assert_eq!(
            transcript.entries[0].content,
            "請你幫我找開源多like的tokens整合項目，至少四個"
        );
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_normalizes_claude_jsonl_entries() {
        let root = temp_dir("read_claude");
        fs::write(
            root.join("claude123.jsonl"),
            concat!(
                r#"{"timestamp":"2026-05-20T00:00:00Z","type":"user","message":{"role":"user","content":"hello claude"}}"#,
                "\n",
                r#"{"timestamp":"2026-05-20T00:00:01Z","type":"assistant","message":{"role":"assistant","model":"claude-sonnet","content":[{"type":"text","text":"hello user"}],"usage":{"input_tokens":11,"output_tokens":7,"cache_read_input_tokens":5,"cache_creation_input_tokens":2}}}"#,
                "\n",
            ),
        )
        .expect("write transcript");

        let transcript = read_session_transcript_from_roots(
            AgentId::ClaudeCode,
            "claude123".into(),
            &[(AgentId::ClaudeCode, vec![root.clone()])],
        )
        .expect("read transcript");

        assert_eq!(
            transcript.metadata.project,
            Some(root.file_name().unwrap().to_string_lossy().to_string())
        );
        assert_eq!(transcript.entries.len(), 3);
        assert_eq!(transcript.entries[0].role, "user");
        assert_eq!(transcript.entries[0].content, "hello claude");
        assert_eq!(transcript.entries[1].role, "assistant");
        assert_eq!(transcript.entries[1].content, "hello user");
        assert_eq!(transcript.entries[2].role, "usage");
        assert_eq!(transcript.entries[2].input_tokens, Some(11));
        assert_eq!(transcript.entries[2].output_tokens, Some(7));
        assert_eq!(transcript.entries[2].cache_read_tokens, Some(5));
        assert_eq!(transcript.entries[2].cache_write_tokens, Some(2));
        cleanup_path(&root);
    }

    #[test]
    fn read_session_transcript_reports_not_found_and_parse_errors() {
        let root = temp_dir("read_errors");
        let missing = read_session_transcript_from_roots(
            AgentId::CodexCli,
            "missing123".into(),
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect_err("missing transcript");
        assert!(missing.contains("not found"));

        fs::write(root.join("bad.jsonl"), "{not-json").expect("write bad transcript");
        let parse_error = read_session_transcript_from_roots(
            AgentId::CodexCli,
            "bad".into(),
            &[(AgentId::CodexCli, vec![root.clone()])],
        )
        .expect_err("parse error");
        assert!(parse_error.contains("Cannot parse transcript line 1"));
        cleanup_path(&root);
    }
}
