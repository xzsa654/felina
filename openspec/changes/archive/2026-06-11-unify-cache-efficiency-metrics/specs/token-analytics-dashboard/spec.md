## MODIFIED Requirements

### Requirement: Cache efficiency card

The system SHALL render a card showing cache hit ratio as a percentage and estimated cost savings from prompt caching. The card SHALL display a visual indicator (progress bar or ring) for the hit ratio. The cache hit ratio SHALL be computed as cache-read tokens divided by the sum of input tokens and cache-read tokens. The estimated cost savings SHALL be computed per model from each model's actual input and cache-read pricing, summed across models, and MUST NOT assume a single hardcoded model price. When a model lacks a cache-read price, the system SHALL apply a fallback of ten percent of that model's input price; the result MUST NOT be negative and MUST NOT be NaN. The card's displayed values SHALL come from the backend cache efficiency computation rather than a separate frontend recomputation.

#### Scenario: Cache card shows savings

- **GIVEN** cache_hit_ratio is 0.6 and cache_cost_saved is $15.30
- **WHEN** the cache efficiency card renders
- **THEN** it SHALL display "60%" as the hit ratio
- **THEN** it SHALL display "$15.30" as estimated savings

#### Scenario: Savings reflect per-model pricing

- **WHEN** the analytics include cache-read tokens across multiple models with different input and cache-read prices
- **THEN** the estimated savings SHALL equal the sum over models of cache-read tokens times the per-model difference between input price and cache-read price
- **THEN** the savings SHALL NOT be derived from a single hardcoded model price

##### Example: mixed-model savings

| Model | Cache-read tokens | Input $/1M | Cache-read $/1M | Per-model saving |
| ----- | ----------------- | ---------- | --------------- | ---------------- |
| claude-sonnet | 1000000 | 3.0 | 0.3 | 2.70 |
| some-model (no cache price) | 1000000 | 5.0 | (fallback 0.5) | 4.50 |

- **GIVEN** the two rows above
- **WHEN** estimated savings is computed
- **THEN** the total equals 2.70 + 4.50 = 7.20

#### Scenario: Hit ratio uses cacheable-input denominator

- **GIVEN** input tokens is 400 and cache-read tokens is 600
- **WHEN** the cache hit ratio is computed
- **THEN** the ratio SHALL be 600 / (400 + 600) = 0.6
- **THEN** output and cache-write tokens MUST NOT affect the ratio

## ADDED Requirements

### Requirement: Consistent cache hit ratio across dashboard views

The system SHALL use a single cache hit ratio definition across all `/tokens` views that display it, computed as cache-read tokens divided by the sum of input tokens and cache-read tokens. This definition SHALL apply to the cache efficiency card, the summary stat card (including its fallback path), and the top models insight table. When the denominator is zero the ratio SHALL be zero.

#### Scenario: Stat card and top models table agree

- **WHEN** the same underlying token data is shown in the summary stat card and the top models insight table
- **THEN** the cache hit ratio displayed in each SHALL be computed with the same cacheable-input denominator
- **THEN** the two views SHALL NOT display contradictory cache ratios for the same data

#### Scenario: Per-model ratio in top models table

- **GIVEN** a model row with input tokens 800 and cache-read tokens 200
- **WHEN** the top models table computes that model's cache ratio
- **THEN** the ratio SHALL be 200 / (800 + 200) = 0.2
