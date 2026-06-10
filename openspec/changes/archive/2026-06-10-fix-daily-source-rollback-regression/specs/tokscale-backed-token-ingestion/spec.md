## ADDED Requirements

### Requirement: Honor explicit rollback in default analytics source resolution

When no explicit source override is provided, the analytics aggregator SHALL resolve the default source for Daily, Weekly, and Monthly aggregate views by first reading the active ingestion source. If the active source is `felina_parser` (explicit rollback, or tokscale never succeeded), the aggregator SHALL use the active source and SHALL NOT substitute `tokscale_export`. If the active source is `tokscale_export` or `parser_fallback`, the aggregator SHALL prefer `tokscale_export` when tokscale-backed rows exist, and SHALL fall back to the active source when they do not. The Hourly view SHALL always use the active source. The same resolution rule MUST apply uniformly to the Daily, Weekly, and Monthly branches.

#### Scenario: Explicit rollback to felina_parser is honored

- **WHEN** the active source is set to `felina_parser` and tokscale-backed rows exist in storage
- **THEN** Daily, Weekly, and Monthly analytics SHALL aggregate only `felina_parser` rows

##### Example: daily rollback returns legacy totals

- **GIVEN** legacy `felina_parser` rows totaling input=321 / output=123 / events=1, and `tokscale_export` rows totaling input=999 / output=111 / events=3
- **WHEN** the active source is `felina_parser` and Daily analytics are requested without a source override
- **THEN** the response reports input=321, output=123, event_count=1

#### Scenario: Automatic parser fallback keeps tokscale preference for aggregate views

- **WHEN** the active source is `parser_fallback` and tokscale-backed rows exist in storage
- **THEN** Daily, Weekly, and Monthly analytics SHALL aggregate `tokscale_export` rows

##### Example: monthly fallback prefers tokscale totals

- **GIVEN** `parser_fallback` is the active source after a failed tokscale refresh, legacy rows totaling input=321, and `tokscale_export` rows totaling input=1000 / output=200 / events=7
- **WHEN** Monthly analytics are requested without a source override
- **THEN** the response reports input=1000, output=200, event_count=7

#### Scenario: No tokscale rows falls back to active source

- **WHEN** the active source is `tokscale_export` or `parser_fallback` and no tokscale-backed rows exist in storage
- **THEN** Daily, Weekly, and Monthly analytics SHALL aggregate the active source rows
