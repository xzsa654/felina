## ADDED Requirements

### Requirement: Insight-first tokens dashboard hierarchy

The TokensPage SHALL prioritize usage and accounting insights above temporal charts. The first viewport MUST present KPI summary, active source status, data resolution status, top model usage, cache composition, and agent split before secondary temporal analysis.

#### Scenario: Aggregate tokscale data loads

- **WHEN** `/tokens` loads analytics data where the active source is tokscale-backed aggregate data
- **THEN** the page SHALL show total tokens, message count, estimated cost, and cache read percentage in the primary summary
- **THEN** the page SHALL show top model usage and cache composition as primary analysis
- **THEN** temporal charts SHALL NOT be the dominant first-viewport content

##### Example: cache-heavy aggregate summary

- **GIVEN** analytics totals include `1,145,331,036` cache read tokens and `1,190,608,772` total tokens
- **WHEN** the dashboard renders the primary summary
- **THEN** cache read percentage is presented as a key insight
- **THEN** model and agent sections use total tokens including cache and reasoning tokens

### Requirement: Top models insight table

The TokensPage SHALL provide a top models insight table that ranks models by meaningful usage metrics. Each row MUST show model, agent, total tokens, token composition, cache read percentage, message count, and estimated cost when cost is available.

#### Scenario: User reviews model usage

- **WHEN** model breakdown data is available
- **THEN** the dashboard SHALL present a table sorted by total tokens or estimated cost
- **THEN** the table SHALL make cache-heavy models distinguishable from non-cache-heavy models
- **THEN** the table SHALL preserve model and agent names without requiring chart hover interaction

##### Example: ranking by total tokens

| Model | Input | Output | Cache Read | Cache Write | Reasoning | Expected Total |
| ----- | ----- | ------ | ---------- | ----------- | --------- | -------------- |
| claude-opus-4-6 | 76606 | 1654362 | 486225798 | 9816134 | 0 | 497772900 |
| gpt-5.5 | 6030203 | 428258 | 97396608 | 0 | 74342 | 103929411 |

### Requirement: Data resolution governs temporal views

The TokensPage SHALL classify analytics data resolution before rendering temporal views. If analytics data only contains aggregate or all-scope buckets, the page MUST show a data resolution explanation instead of presenting time series or hourly heatmap as if dated activity exists.

#### Scenario: Aggregate-only buckets

- **WHEN** `time_series` contains only a bucket labeled `all`
- **THEN** the dashboard SHALL identify the data resolution as aggregate-only
- **THEN** token trend and cost trend views SHALL be secondary or replaced by an aggregate explanation
- **THEN** hourly activity SHALL show an unavailable state instead of an empty heatmap grid

##### Example: all bucket handling

- **GIVEN** `time_series=[{ label: "all", event_count: 12681 }]`
- **AND** `hourly_heatmap=[]`
- **WHEN** `/tokens` renders
- **THEN** the page explains that dated/hourly buckets are unavailable
- **THEN** it does not label the aggregate bucket as daily or hourly activity

#### Scenario: Dated buckets available

- **WHEN** `time_series` contains dated labels such as `2026-05-20` and `2026-05-21`
- **THEN** token and cost trend views SHALL be available as secondary analysis
- **THEN** the date range and granularity controls SHALL continue to update the chart data

### Requirement: Estimated cost transparency

The TokensPage SHALL label cost values as estimated unless the backend explicitly provides exact billing confidence. Unknown or fallback pricing MUST be communicated in the UI without blocking usage analysis.

#### Scenario: Dashboard displays cost

- **WHEN** total cost or model cost values are shown
- **THEN** labels SHALL use estimated cost wording
- **THEN** the dashboard SHALL avoid presenting estimated values as exact invoices or billing records

##### Example: estimated cost copy

| Existing Label | Required Meaning |
| -------------- | ---------------- |
| Total Cost | Estimated cost |
| Cost by Model | Estimated cost by model |
| Spending Overview | Estimated spending overview |

### Requirement: Compact refresh and source diagnostics

The TokensPage SHALL show refresh and source status in a compact status area. Detailed diagnostics such as scanned files, skipped files, inserted rows, and individual errors MUST be available when refresh fails or diagnostics are expanded, but they SHALL NOT dominate the primary analytics layout after successful refresh.

#### Scenario: Successful refresh

- **WHEN** `refresh_token_data` returns `status=ok` and `active_source=tokscale_export`
- **THEN** the page SHALL show the active source and success state compactly
- **THEN** detailed scan coverage SHALL remain collapsed or visually secondary

#### Scenario: Failed refresh

- **WHEN** `refresh_token_data` returns a non-ok status such as `missing_binary`, `command_failed`, or `unsupported_schema`
- **THEN** the page SHALL surface the failure status and actionable diagnostic message
- **THEN** existing analytics SHALL remain visible when available
