## MODIFIED Requirements

### Requirement: get_token_analytics command

The system SHALL expose a `get_token_analytics` Tauri command that returns a complete `TokenAnalytics` response. The command SHALL accept optional parameters: `granularity` (hourly/daily/weekly/monthly), `date_start`, `date_end`, `filter_agent`, and `filter_model`. The response SHALL include total aggregates, time series buckets, model breakdown, agent breakdown, and hourly heatmap data.

**Implementation constraint**: Backend HTTP calls to external APIs (e.g., Anthropic OAuth/Usage) SHALL use the in-process `reqwest` HTTP client, NOT external CLI tools such as `curl`. On Windows, any subprocess invocation (e.g., tokscale, explorer) SHALL set the `CREATE_NO_WINDOW` (0x08000000) creation flag to prevent console window popups in the GUI application.

#### Scenario: Daily analytics for the last 7 days

- **WHEN** `get_token_analytics` is called with `granularity="daily"` and appropriate date range
- **THEN** the response SHALL contain 7 time series buckets, one per day
- **THEN** each bucket SHALL include input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, and cost_usd

#### Scenario: Windows GUI subprocess behavior

- **WHEN** any token analytics backend operation spawns a subprocess on Windows
- **THEN** no console window SHALL appear to the user
- **THEN** the subprocess SHALL execute silently and return results via stdout/stderr capture
