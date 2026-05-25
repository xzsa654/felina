## ADDED Requirements

### Requirement: get_token_analytics command

The system SHALL expose a `get_token_analytics` Tauri command that returns a complete `TokenAnalytics` response. The command SHALL accept optional parameters: `granularity` (hourly/daily/weekly/monthly), `date_start`, `date_end`, `filter_agent`, and `filter_model`. The response SHALL include total aggregates, time series buckets, model breakdown, agent breakdown, and hourly heatmap data.

#### Scenario: Daily analytics for the last 7 days

- **WHEN** `get_token_analytics` is called with `granularity="daily"` and appropriate date range
- **THEN** the response SHALL contain 7 time series buckets, one per day
- **THEN** each bucket SHALL include input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, and cost_usd

#### Scenario: Filtered analytics for a specific agent

- **WHEN** `get_token_analytics` is called with `filter_agent="claude-code"`
- **THEN** only token events from the Claude Code agent SHALL be included in the aggregation

### Requirement: get_model_breakdown command

The system SHALL expose a `get_model_breakdown` Tauri command that returns a list of `ModelBreakdown` records grouped by model, provider, and agent. The command SHALL accept optional `date_start` and `date_end` parameters.

#### Scenario: Model breakdown shows per-model costs

- **WHEN** `get_model_breakdown` is called
- **THEN** each record SHALL contain model name, provider, agent, token counts, and cost_usd
- **THEN** records SHALL be sorted by cost descending

### Requirement: get_cache_efficiency command

The system SHALL expose a `get_cache_efficiency` Tauri command that returns cache hit ratio and cost savings from Anthropic prompt caching. The response SHALL include `cache_hit_ratio` (cache_read / total_input), `cache_read_tokens`, `cache_write_tokens`, and `cache_cost_saved`.

#### Scenario: Cache efficiency for cache-heavy usage

- **GIVEN** token events include 1M input tokens total, with 600K cache_read and 100K cache_write
- **WHEN** `get_cache_efficiency` is called
- **THEN** cache_hit_ratio SHALL be 0.6 (60%)
- **THEN** cache_cost_saved SHALL reflect the price difference between regular input and cache_read tokens

### Requirement: get_available_agents command

The system SHALL expose a `get_available_agents` Tauri command that returns which agents are detected as installed, their last scanned timestamp, event count, and total cost.

#### Scenario: List available agents

- **WHEN** `get_available_agents` is called
- **THEN** the response SHALL list each agent with its availability status
- **THEN** only agents whose `is_available()` returned true SHALL show as available

### Requirement: refresh_token_data command

The system SHALL expose a `refresh_token_data` Tauri command that triggers a full re-scan of all available agent data. The command SHALL return the number of agents scanned, total events parsed, and any errors encountered.

#### Scenario: Manual refresh after new agent installation

- **WHEN** `refresh_token_data` is called
- **THEN** all available agent directories SHALL be re-scanned
- **THEN** new events SHALL be upserted into the SQLite database
- **THEN** the response SHALL report the count of new events parsed
