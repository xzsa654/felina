export type AgentId = 'claude-code' | 'codex-cli' | 'gemini-cli';

export type TimeGranularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface TokenBucket {
  label: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  event_count: number;
  agent_count: number;
  model_count: number;
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  agent: AgentId;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  event_count: number;
  max_input_tokens: number | null;
}

export interface AgentBreakdown {
  agent: AgentId;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  reasoning_tokens: number;
  cost_usd: number;
  event_count: number;
}

export interface HourlyHeatmapEntry {
  day: string;
  hour: number;
  total_tokens: number;
  cost_usd: number;
}

export interface TokenAnalytics {
  period_start: string;
  period_end: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_write_tokens: number;
  total_reasoning_tokens: number;
  total_cost_usd: number;
  event_count: number;
  time_series: TokenBucket[];
  model_breakdown: ModelBreakdown[];
  agent_breakdown: AgentBreakdown[];
  top_sessions: DaySessionBreakdown[];
  hourly_heatmap: HourlyHeatmapEntry[];
}

export interface DayHourlyBucket {
  hour: number;
  tokens: number;
  messages: number;
}

export interface DayProjectBreakdown {
  project: string;
  tokens: number;
  messages: number;
  cost_usd: number;
}

export interface DaySessionBreakdown {
  session_id: string;
  agent: AgentId;
  project: string | null;
  model: string;
  tokens: number;
  messages: number;
  cost_usd: number;
  transcript_available: boolean;
}

export interface SessionTranscriptLocation {
  agent: AgentId;
  session_id: string;
  path: string;
}

export interface HistorySession {
  agent: AgentId;
  session_id: string;
  project: string | null;
  model: string | null;
  timestamp: number | null;
  tokens: number;
  messages: number;
  transcript_available: boolean;
  source_path: string | null;
}

export interface HistorySessionsPage {
  sessions: HistorySession[];
  total: number;
}

export interface SessionTranscript {
  agent: AgentId;
  session_id: string;
  source_path: string;
  metadata: TranscriptMetadata;
  entries: TranscriptEntry[];
}

export interface TranscriptMetadata {
  project: string | null;
  model: string | null;
  timestamp: string | null;
}

export interface TranscriptEntry {
  role: string;
  content: string;
  timestamp: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  reasoning_tokens: number | null;
}

export interface CacheEfficiency {
  total_input_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cache_hit_ratio: number;
  cache_cost_saved: number;
}

export interface AgentStatus {
  agent: AgentId;
  name: string;
  available: boolean;
  last_scanned: string | null;
  event_count: number;
  total_cost_usd: number;
  last_error: string | null;
}

export interface ScanError {
  agent: AgentId;
  source: string;
  message: string;
}

export interface RateLimitBucket {
  utilization: number | null;
  resets_at: string | null;
}

export interface AnthropicRateLimits {
  five_hour: RateLimitBucket;
  seven_day: RateLimitBucket;
  available: boolean;
  error: string | null;
}

export interface CodexRateLimits {
  primary_pct: number | null;
  primary_reset: string | null;
  secondary_pct: number | null;
  secondary_reset: string | null;
  plan_type: string | null;
  available: boolean;
  error: string | null;
}

export interface GeminiRateLimits {
  primary_pct: number | null;
  primary_reset: string | null;
  available: boolean;
  error: string | null;
}

export interface QuotaSnapshot {
  anthropic_limits: AnthropicRateLimits;
  codex_limits: CodexRateLimits;
  gemini_limits: GeminiRateLimits;
  fetched_at: string;
  expires_at: string;
  next_refresh_at: string;
  stale: boolean;
}

export interface RefreshResult {
  agents_scanned: number;
  files_scanned: number;
  files_skipped: number;
  events_parsed: number;
  events_inserted: number;
  errors: ScanError[];
  active_source: string;
  status: string;
  last_successful_source: string | null;
  fallback_used: boolean;
}
