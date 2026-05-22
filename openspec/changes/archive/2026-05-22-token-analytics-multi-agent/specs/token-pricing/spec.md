## ADDED Requirements

### Requirement: LiteLLM pricing fetch with disk cache

The system SHALL implement a `PricingService` that fetches model pricing from the LiteLLM community pricing JSON (`https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`). The fetched data SHALL be cached to disk for 1 hour before re-fetching.

#### Scenario: First fetch caches pricing to disk

- **WHEN** `PricingService` fetches pricing for the first time
- **THEN** the full pricing JSON SHALL be written to a disk cache file
- **THEN** subsequent calls within 1 hour SHALL use the disk cache without making HTTP requests

#### Scenario: Cache expiration triggers re-fetch

- **WHEN** the cached pricing data is older than 1 hour
- **THEN** the service SHALL attempt to fetch fresh data from LiteLLM
- **THEN** if the fetch succeeds, the cache SHALL be updated

#### Scenario: Network failure falls back to cache

- **WHEN** LiteLLM API is unreachable
- **THEN** the service SHALL use the existing disk cache regardless of age

### Requirement: Static pricing fallback

The system SHALL include a static pricing map covering at minimum: Claude models (Haiku 3.5, Sonnet 4, Opus 4), OpenAI models (GPT-4o, GPT-4.1), and Google models (Gemini 2.5 Pro/Flash). The static map SHALL be used when both the LiteLLM fetch and disk cache are unavailable.

#### Scenario: Static fallback for known model

- **WHEN** no cached data exists and LiteLLM is unreachable
- **THEN** the service SHALL return pricing from the static map for models listed in it

#### Scenario: Unknown model returns error

- **WHEN** a model name is not found in LiteLLM data, disk cache, or static map
- **THEN** the service SHALL return an error with the model name

### Requirement: Cost calculation per token event

The `PricingService` SHALL provide a `calculate_cost(event)` method that computes cost as: `(input_tokens / 1M * input_price) + (output_tokens / 1M * output_price) + (cache_read_tokens / 1M * cache_read_price) + (cache_write_tokens / 1M * cache_write_price)`.

#### Scenario: Cost calculation for a Sonnet event

- **GIVEN** a TokenEvent with model "claude-sonnet-4-20250514", input_tokens=1000000, output_tokens=500000, cache_read=0, cache_write=0
- **WHEN** cost is calculated with static pricing (input=$3/M, output=$15/M)
- **THEN** cost SHALL be $3.00 + $7.50 = $10.50
