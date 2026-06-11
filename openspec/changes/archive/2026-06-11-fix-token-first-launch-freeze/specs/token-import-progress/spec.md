## ADDED Requirements

### Requirement: Lazy first-run token import on /tokens entry

The system SHALL trigger token data import lazily, only when the user first opens the `/tokens` page, rather than at application startup. The system SHALL expose a status query that reports whether a first-run import is needed, backed by the persisted ingestion flag `token_import_completed_v1` so the check does not require a full-table row count.

#### Scenario: First visit triggers import

- **WHEN** the user opens `/tokens` and `token_ingestion_state.token_import_completed_v1` is absent or not equal to `"1"`
- **THEN** the import status query SHALL report that import is needed
- **THEN** the page SHALL trigger a single refresh and display an import progress view instead of the standard skeleton
- **THEN** on refresh completion the page SHALL reload analytics and render the normal view
- **THEN** successful refresh SHALL persist `token_ingestion_state.token_import_completed_v1 = "1"`

#### Scenario: Subsequent visits skip import

- **WHEN** the user opens `/tokens` and `token_ingestion_state.token_import_completed_v1` equals `"1"`
- **THEN** the import status query SHALL report that import is not needed
- **THEN** the page SHALL render analytics directly from stored data without showing the progress view

#### Scenario: Existing rows without completion flag still trigger import

- **WHEN** the database contains token rows but `token_ingestion_state.token_import_completed_v1` is absent
- **THEN** the import status query SHALL report that import is needed
- **THEN** the system SHALL NOT use `token_events` row count to suppress the first-run import

#### Scenario: Deleting all token events resets first-run import

- **WHEN** `deleteAllTokenEvents` succeeds after a prior successful import
- **THEN** the system SHALL delete `token_ingestion_state.token_import_completed_v1`
- **THEN** the system SHALL preserve the active source metadata
- **THEN** the next import status query SHALL report that import is needed

#### Scenario: Import status query failure is non-fatal

- **WHEN** the import status query fails
- **THEN** the page MUST NOT freeze or remain blank
- **THEN** the page SHALL surface the error or render available data without blocking

### Requirement: Emit scan progress events during token import

The system SHALL emit scan progress events during a token refresh so the UI can display ongoing progress. Each progress event SHALL identify the current phase and report incremental counts. Progress emission MUST be best-effort and MUST NOT abort or alter the refresh result on emission failure.

#### Scenario: Progress events reported during scan

- **WHEN** a token refresh runs and processes files or commits batches of events
- **THEN** the system SHALL emit progress events identifying the phase and incremental file and event counts
- **THEN** the frontend SHALL subscribe to these events and update the import progress view

#### Scenario: Progress shown as indeterminate before first event

- **WHEN** the import progress view is displayed and no progress event has arrived yet
- **THEN** the view SHALL show an indeterminate state rather than an empty or frozen panel

#### Scenario: Emission failure does not corrupt refresh

- **WHEN** emitting a progress event fails
- **THEN** the refresh SHALL continue and return its normal result
- **THEN** the failure MUST NOT be surfaced as a refresh error
