## ADDED Requirements

### Requirement: get_token_analytics_pair command

The system SHALL expose a `get_token_analytics_pair` Tauri command that returns monthly analytics, daily analytics, and cache efficiency in a single response, computed within a single acquisition of the aggregator lock. The command SHALL accept independent date bounds for the monthly and daily sides (`monthly_date_start`, `monthly_date_end`, `daily_date_start`, `daily_date_end`) and independent source overrides (`monthly_source`, `daily_source`). The response SHALL be a `TokenAnalyticsPair` containing `monthly`, `daily`, and `cache_efficiency`. The cache efficiency SHALL be derived from the daily analytics that the command already builds, without performing a second daily aggregation. The cache hit ratio and estimated cost savings in `cache_efficiency` SHALL be identical to those returned by `get_cache_efficiency` over the same daily date range and source.

#### Scenario: Single call returns all three datasets

- **WHEN** `get_token_analytics_pair` is called
- **THEN** the response SHALL contain a `monthly` analytics object, a `daily` analytics object, and a `cache_efficiency` object
- **THEN** the daily analytics SHALL be aggregated exactly once

#### Scenario: Independent monthly and daily date bounds

- **GIVEN** a monthly date range covering 90 days and a daily date range covering 7 days
- **WHEN** `get_token_analytics_pair` is called with both ranges
- **THEN** the `monthly` totals SHALL reflect the 90-day range
- **THEN** the `daily` totals SHALL reflect the 7-day range

#### Scenario: Cache efficiency matches standalone command

- **GIVEN** the same daily date range and source
- **WHEN** the cache efficiency is taken from `get_token_analytics_pair` and compared with `get_cache_efficiency`
- **THEN** the cache_hit_ratio SHALL be equal
- **THEN** the cache_cost_saved SHALL be equal
