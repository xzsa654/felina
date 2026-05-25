## ADDED Requirements

### Requirement: TokensPage replaces AnalyticsPage

The system SHALL provide a `TokensPage` React component at route `/tokens` that replaces the legacy `AnalyticsPage`. The page SHALL be loaded via `React.lazy()` code splitting.

#### Scenario: User navigates to /tokens

- **WHEN** the user navigates to `/tokens`
- **THEN** the TokensPage SHALL render with a loading spinner during lazy load
- **THEN** the page SHALL display the token analytics dashboard after data loads

### Requirement: Token stat cards show summary metrics

The TokensPage SHALL display a row of summary stat cards showing: total tokens (sum of input + output + cache + reasoning), total cost in USD, total event count, active agent count, and cache hit ratio.

#### Scenario: Stat cards update with data

- **WHEN** token analytics data is loaded from the backend
- **THEN** each stat card SHALL display its metric with a formatted value

### Requirement: Token time series chart

The system SHALL render a recharts `AreaChart` showing stacked token usage over time. The chart SHALL stack input tokens, output tokens, cache read tokens, and cache write tokens as separate areas. A `GranularityPicker` toggle SHALL switch between hourly, daily, weekly, and monthly buckets.

#### Scenario: Switching granularity updates chart

- **WHEN** the user clicks "Weekly" in the granularity picker
- **THEN** the time series chart SHALL re-fetch data and display weekly buckets

### Requirement: Cost time series chart

The system SHALL render a recharts `AreaChart` showing daily cost trend (USD) over the selected date range.

#### Scenario: Cost chart shows daily spending

- **WHEN** daily analytics data is loaded
- **THEN** the cost chart SHALL display a line or area showing cost per day

### Requirement: Model breakdown chart and table

The system SHALL render a recharts horizontal `BarChart` showing per-model token usage or cost, sorted descending. A sortable table variant (`ModelBreakdownTable`) SHALL show the same data in tabular format with columns for model, input tokens, output tokens, cache tokens, and cost.

#### Scenario: Model breakdown shows top models

- **WHEN** multiple models have been used
- **THEN** the bar chart SHALL display each model as a horizontal bar with cost or token count
- **THEN** the table SHALL be sortable by clicking column headers

### Requirement: Hourly heatmap grid

The system SHALL render a 7-column (Mon-Sun) by 24-row (0h-23h) CSS Grid heatmap showing token usage intensity. Each cell SHALL be colored on a 5-level scale based on token count quantiles. Hovering a cell SHALL display a tooltip with exact token count and cost.

#### Scenario: Heatmap colors reflect intensity

- **GIVEN** hourly token data for the last 7 days
- **WHEN** the heatmap renders
- **THEN** cells with higher token counts SHALL have darker/intenser colors
- **THEN** cells with zero tokens SHALL have a neutral background color

### Requirement: Cache efficiency card

The system SHALL render a card showing cache hit ratio as a percentage and estimated cost savings from Anthropic prompt caching. The card SHALL display a visual indicator (progress bar or ring) for the hit ratio.

#### Scenario: Cache card shows savings

- **GIVEN** cache_hit_ratio is 0.6 and cache_cost_saved is $15.30
- **WHEN** the cache efficiency card renders
- **THEN** it SHALL display "60%" as the hit ratio
- **THEN** it SHALL display "$15.30" as estimated savings

### Requirement: Agent distribution chart

The system SHALL render a recharts `PieChart` or `BarChart` showing token usage distribution across available agents. When only one agent is available, the chart SHALL show per-model breakdown within that agent.

#### Scenario: Multi-agent distribution

- **GIVEN** data from Claude Code and Cursor agents
- **WHEN** the agent distribution chart renders
- **THEN** each agent SHALL be shown as a pie slice or bar proportional to its token share

### Requirement: Agent status panel

The system SHALL render an `AgentStatusPanel` listing each detected agent with: agent name, availability status (installed/not installed), last scanned timestamp, event count, and total cost. The panel SHALL include a `RefreshButton` to trigger re-scanning.

#### Scenario: Refresh button triggers scan

- **WHEN** the user clicks the Refresh button
- **THEN** `refresh_token_data` SHALL be called
- **THEN** the UI SHALL show a loading state during the scan
- **THEN** the stat cards and charts SHALL update with new data

### Requirement: Cost budget card

The TokensPage SHALL include a `CostBudgetCard` showing current daily/monthly spending against configured budget limits. When limits are exceeded, the card SHALL display a warning indicator. The monthly projection line SHALL extend the current burn rate to estimate month-end cost.

#### Scenario: Budget exceeded warning

- **GIVEN** daily limit is $10 and today's cost is $12
- **WHEN** the cost budget card renders
- **THEN** it SHALL display a warning indicator for the exceeded daily limit

### Requirement: Analytics redirect from old route

The system SHALL redirect requests to `/analytics` to `/tokens`. The legacy `AnalyticsPage.tsx` and `AnalyticsPage.svelte` SHALL be removed.

#### Scenario: Old analytics route redirects

- **WHEN** the user navigates to `/analytics`
- **THEN** the router SHALL redirect to `/tokens`
