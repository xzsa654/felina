use serde::{Deserialize, Serialize};

/// Supported agent identifiers.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum AgentId {
    ClaudeCode,
    CodexCli,
    GeminiCli,
}

impl std::fmt::Display for AgentId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AgentId::ClaudeCode => write!(f, "claude-code"),
            AgentId::CodexCli => write!(f, "codex-cli"),
            AgentId::GeminiCli => write!(f, "gemini-cli"),
        }
    }
}

/// A single token usage event from any agent.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TokenEvent {
    pub agent: AgentId,
    pub provider: String,
    pub model: String,
    /// Unix epoch seconds
    pub timestamp: i64,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub project: Option<String>,
    pub session_id: Option<String>,
}

/// Granularity for time-series requests.
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum TimeGranularity {
    Hourly,
    Daily,
    Weekly,
    Monthly,
}

/// Aggregated token data for a single time bucket.
#[derive(Serialize, Clone, Debug)]
pub struct TokenBucket {
    pub label: String,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub cost_usd: f64,
    pub event_count: u64,
    pub agent_count: u64,
    pub model_count: u64,
}

/// Per-model breakdown record.
#[derive(Serialize, Clone, Debug)]
pub struct ModelBreakdown {
    pub model: String,
    pub provider: String,
    pub agent: AgentId,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub cost_usd: f64,
    pub event_count: u64,
    pub max_input_tokens: Option<u64>,
}

/// Per-agent breakdown record.
#[derive(Serialize, Clone, Debug)]
pub struct AgentBreakdown {
    pub agent: AgentId,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub reasoning_tokens: u64,
    pub cost_usd: f64,
    pub event_count: u64,
}

/// Hourly heatmap entry for visualization.
#[derive(Serialize, Clone, Debug)]
pub struct HourlyHeatmapEntry {
    pub day: String,
    pub hour: u8,
    pub total_tokens: u64,
    pub cost_usd: f64,
}

/// Full token analytics response.
#[derive(Serialize, Clone, Debug)]
pub struct TokenAnalytics {
    pub period_start: String,
    pub period_end: String,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub total_cache_read_tokens: u64,
    pub total_cache_write_tokens: u64,
    pub total_reasoning_tokens: u64,
    pub total_cost_usd: f64,
    pub event_count: u64,
    pub time_series: Vec<TokenBucket>,
    pub model_breakdown: Vec<ModelBreakdown>,
    pub agent_breakdown: Vec<AgentBreakdown>,
    pub top_sessions: Vec<DaySessionBreakdown>,
    pub hourly_heatmap: Vec<HourlyHeatmapEntry>,
}

/// Per-hour token distribution for a single day.
#[derive(Serialize, Clone, Debug)]
pub struct DayHourlyBucket {
    pub hour: u8,
    pub tokens: u64,
    pub messages: u64,
}

/// Per-project token breakdown for a single day.
#[derive(Serialize, Clone, Debug)]
pub struct DayProjectBreakdown {
    pub project: String,
    pub tokens: u64,
    pub messages: u64,
    pub cost_usd: f64,
}

/// Top session breakdown for a single day.
#[derive(Serialize, Clone, Debug)]
pub struct DaySessionBreakdown {
    pub session_id: String,
    pub agent: AgentId,
    pub project: Option<String>,
    pub model: String,
    pub tokens: u64,
    pub messages: u64,
    pub cost_usd: f64,
    pub transcript_available: bool,
}

/// Resolved source file for a session transcript.
#[derive(Serialize, Clone, Debug)]
pub struct SessionTranscriptLocation {
    pub agent: AgentId,
    pub session_id: String,
    pub path: String,
}

/// A session row for the History page.
#[derive(Serialize, Clone, Debug)]
pub struct HistorySession {
    pub agent: AgentId,
    pub session_id: String,
    pub project: Option<String>,
    pub model: Option<String>,
    pub timestamp: Option<i64>,
    pub tokens: u64,
    pub messages: u64,
    pub transcript_available: bool,
    pub source_path: Option<String>,
}

/// Paginated History page result.
#[derive(Serialize, Clone, Debug)]
pub struct HistorySessionsPage {
    pub sessions: Vec<HistorySession>,
    pub total: u64,
}

/// Normalized transcript returned to the History page.
#[derive(Serialize, Clone, Debug)]
pub struct SessionTranscript {
    pub agent: AgentId,
    pub session_id: String,
    pub source_path: String,
    pub metadata: TranscriptMetadata,
    pub entries: Vec<TranscriptEntry>,
}

#[derive(Serialize, Clone, Debug, Default)]
pub struct TranscriptMetadata {
    pub project: Option<String>,
    pub model: Option<String>,
    pub timestamp: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
pub struct TranscriptEntry {
    pub role: String,
    pub content: String,
    pub timestamp: Option<String>,
    pub model: Option<String>,
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    pub reasoning_tokens: Option<u64>,
}

/// Pair of monthly + daily analytics returned in one call.
#[derive(Serialize, Clone, Debug)]
pub struct TokenAnalyticsPair {
    pub monthly: TokenAnalytics,
    pub daily: TokenAnalytics,
    pub cache_efficiency: CacheEfficiency,
}

/// Cache efficiency metrics.
#[derive(Serialize, Clone, Debug)]
pub struct CacheEfficiency {
    pub total_input_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
    pub cache_hit_ratio: f64,
    pub cache_cost_saved: f64,
}

/// Agent status info for the frontend.
#[derive(Serialize, Clone, Debug)]
pub struct AgentStatus {
    pub agent: AgentId,
    pub name: String,
    pub available: bool,
    /// Latest scan attempt timestamp from scan state (Unix epoch seconds as string).
    pub last_scanned: Option<String>,
    pub event_count: u64,
    pub total_cost_usd: f64,
    /// Persisted last error summary, if any.
    pub last_error: Option<String>,
}

/// A parse error from scanning a single file.
#[derive(Serialize, Clone, Debug)]
pub struct ScanError {
    pub agent: AgentId,
    pub source: String,
    pub message: String,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct ScanProgress {
    pub phase: String,
    pub files_scanned: u64,
    pub files_total: u64,
    pub events_ingested: u64,
}

pub trait ProgressSink: Send + Sync {
    fn report(&self, progress: ScanProgress);
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub struct TokenImportStatus {
    pub needs_import: bool,
}

/// Result from a refresh scan.
#[derive(Serialize, Clone, Debug)]
pub struct RefreshResult {
    pub agents_scanned: u32,
    pub files_scanned: u64,
    pub files_skipped: u64,
    pub events_parsed: u64,
    pub events_inserted: u64,
    pub errors: Vec<ScanError>,
    pub active_source: String,
    pub status: String,
    pub last_successful_source: Option<String>,
    pub fallback_used: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_refresh_result_json_shape() {
        let result = RefreshResult {
            agents_scanned: 3,
            files_scanned: 42,
            files_skipped: 10,
            events_parsed: 150,
            events_inserted: 148,
            errors: vec![ScanError {
                agent: AgentId::ClaudeCode,
                source: "/tmp/bad_file.jsonl".into(),
                message: "json error: unexpected character".into(),
            }],
            active_source: "tokscale_export".into(),
            status: "ok".into(),
            last_successful_source: Some("tokscale_export".into()),
            fallback_used: false,
        };

        let json = serde_json::to_string(&result).expect("Serialize RefreshResult");
        let parsed: serde_json::Value =
            serde_json::from_str(&json).expect("Deserialize as JSON value");

        assert_eq!(parsed["agents_scanned"], 3);
        assert_eq!(parsed["files_scanned"], 42);
        assert_eq!(parsed["files_skipped"], 10);
        assert_eq!(parsed["events_parsed"], 150);
        assert_eq!(parsed["events_inserted"], 148);
        assert_eq!(parsed["active_source"], "tokscale_export");
        assert_eq!(parsed["status"], "ok");
        assert_eq!(parsed["last_successful_source"], "tokscale_export");
        assert_eq!(parsed["fallback_used"], false);

        let errors = &parsed["errors"];
        assert!(errors.is_array());
        let err = &errors[0];
        assert_eq!(err["agent"], "claude-code");
        assert_eq!(err["source"], "/tmp/bad_file.jsonl");
        assert!(err["message"].as_str().unwrap().contains("json error"));
    }

    #[test]
    fn scan_progress_json_shape_matches_event_payload() {
        let progress = ScanProgress {
            phase: "parser".into(),
            files_scanned: 2,
            files_total: 5,
            events_ingested: 13,
        };

        let json = serde_json::to_value(&progress).expect("Serialize ScanProgress");

        assert_eq!(json["phase"], "parser");
        assert_eq!(json["files_scanned"], 2);
        assert_eq!(json["files_total"], 5);
        assert_eq!(json["events_ingested"], 13);
    }
}
