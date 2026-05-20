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
}

/// Per-agent breakdown record.
#[derive(Serialize, Clone, Debug)]
pub struct AgentBreakdown {
    pub agent: AgentId,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub cache_read_tokens: u64,
    pub cache_write_tokens: u64,
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
    pub hourly_heatmap: Vec<HourlyHeatmapEntry>,
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
    pub last_scanned: Option<String>,
    pub event_count: u64,
    pub total_cost_usd: f64,
}

/// Result from a refresh scan.
#[derive(Serialize, Clone, Debug)]
pub struct RefreshResult {
    pub agents_scanned: u32,
    pub events_parsed: u64,
    pub errors: Vec<String>,
}
