## ADDED Requirements

### Requirement: Non-blocking token refresh

The system SHALL run the token refresh scan without holding the aggregator lock for the duration of the scan. The refresh path SHALL acquire the aggregator lock only briefly to obtain shareable references to storage and cached state, release it, and then perform the scan against those references. Synchronous read commands that run on the main thread MUST remain responsive while a refresh is in progress.

#### Scenario: Reads stay responsive during refresh

- **WHEN** a token refresh is running and processing a large volume of historical data
- **THEN** the analytics read commands SHALL NOT block on the aggregator lock for the duration of the scan
- **THEN** the UI SHALL remain responsive, allowing tab navigation while the refresh runs

#### Scenario: Refresh result and read behavior unchanged

- **WHEN** a refresh completes after the non-blocking change
- **THEN** the refresh result shape SHALL remain compatible with the prior behavior
- **THEN** read commands SHALL return analytics computed from the same stored data as before

### Requirement: Transactional batch writes for parser ingestion

The system SHALL write parser-sourced token events using a database transaction with batched commits rather than committing each row individually. The implementation SHALL preserve INSERT-OR-IGNORE semantics and SHALL return an inserted count identical to the pre-change per-row behavior.

#### Scenario: Large import uses batched transactions

- **WHEN** the parser path ingests a large set of token events
- **THEN** the system SHALL execute the inserts inside transactions committed in batches
- **THEN** the total inserted count SHALL equal the count produced by per-row insertion for the same input
- **THEN** duplicate rows SHALL be ignored exactly as under INSERT-OR-IGNORE semantics
