## MODIFIED Requirements

### Requirement: History page lists local sessions

The system SHALL provide a History page at `/history` that lists local agent sessions discovered from supported agent transcript sources. Each listed session SHALL expose agent, session ID, project when available, model when available, date or timestamp when available, message count when available, token total when available, and transcript availability status.

The History page SHALL trigger a token data refresh on mount to ensure the underlying database contains up-to-date session records before querying. The refresh SHALL run asynchronously and SHALL NOT block the initial page render; the page SHALL display a loading state until the refresh-then-query sequence completes.

#### Scenario: User opens History

- **WHEN** the user navigates to `/history`
- **THEN** the system SHALL trigger a token data refresh
- **AND** after the refresh completes, the page SHALL request local session records
- **AND** the page SHALL display a scannable session list when records exist

#### Scenario: History page on first launch (empty DB)

- **GIVEN** the token database has never been populated
- **WHEN** the user navigates to `/history`
- **THEN** the page SHALL trigger a refresh that scans local transcript files
- **AND** after the refresh, the page SHALL display discovered sessions
