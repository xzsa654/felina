## ADDED Requirements

### Requirement: Single batched analytics fetch

The `/tokens` dashboard SHALL load its overview (monthly) analytics, daily analytics, and cache efficiency through a single batched backend request rather than separate per-dataset requests. Independent date-range selection for the overview view and the daily view SHALL be preserved through the batched request. The cache hit ratio and estimated savings obtained from the batched request SHALL remain consistent with the values shown in the cache efficiency card, the summary stat card, and the top models table, using the existing cacheable-input ratio definition.

#### Scenario: Independent date presets preserved

- **GIVEN** the overview view uses a 90-day preset and the daily view uses a 7-day preset
- **WHEN** the dashboard loads its data through the batched request
- **THEN** the overview SHALL display data for the 90-day range
- **THEN** the daily view SHALL display data for the 7-day range

#### Scenario: Cache values stay consistent

- **WHEN** the dashboard renders cache hit ratio from the batched request
- **THEN** the cache efficiency card, summary stat card, and top models table SHALL show consistent cache hit ratios for the same data
