use std::sync::{Arc, Mutex};
use tauri::State;

use crate::tokens::aggregator::TokenAggregator;
use crate::tokens::types::*;

#[tauri::command]
pub fn get_token_analytics_pair(
    date_start: Option<i64>,
    date_end: Option<i64>,
    monthly_source: Option<String>,
    daily_source: Option<String>,
    state: State<'_, TokenState>,
) -> Result<TokenAnalyticsPair, String> {
    let agg = state.aggregator.lock().map_err(|e| format!("Lock error: {}", e))?;
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
    agg.build_analytics(g, date_start, date_end, filter_agent, filter_model, source_override)
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
    let agg = state.aggregator.lock().map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_hourly(&date, source_override)
}

#[tauri::command]
pub fn get_day_project_breakdown(
    date: String,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<crate::tokens::types::DayProjectBreakdown>, String> {
    let agg = state.aggregator.lock().map_err(|e| format!("Lock error: {}", e))?;
    agg.build_day_project_breakdown(&date, source_override)
}

#[tauri::command]
pub fn get_day_top_sessions(
    date: String,
    limit: u64,
    source_override: Option<String>,
    state: State<'_, TokenState>,
) -> Result<Vec<crate::tokens::types::DaySessionBreakdown>, String> {
    let agg = state.aggregator.lock().map_err(|e| format!("Lock error: {}", e))?;
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
        agg.refresh()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    result
}
