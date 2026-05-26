## ADDED Requirements

### Requirement: Tokens Daily sessions link to History

The Tokens page SHALL provide a History navigation action for Daily Top sessions. The action SHALL navigate to `/history` with search parameters containing the selected session agent and session ID.

#### Scenario: User opens a Top session in History

- **WHEN** the user expands a Daily row on `/tokens` and invokes the History action for a Top session with `agent=codex-cli` and `session_id=abc123`
- **THEN** the app SHALL navigate to `/history?agent=codex-cli&session=abc123`

#### Scenario: Top session remains revealable when source exists

- **WHEN** the user invokes an explicit reveal action for a Top session whose transcript source file exists
- **THEN** the operating system file manager SHALL open at or near the transcript source file

##### Example: reveal action from Tokens

- **GIVEN** a Top session row with `agent=codex-cli`, `session_id=abc123`, and source path `/Users/u/.codex/sessions/abc123.jsonl`
- **WHEN** the user invokes the reveal action for that row
- **THEN** the operating system file manager SHALL open at or near `/Users/u/.codex/sessions/abc123.jsonl`

#### Scenario: Top session target is missing

- **WHEN** the user invokes a History or reveal action for a Top session whose transcript source file cannot be resolved
- **THEN** the system SHALL surface a non-crashing unavailable or not-found state
- **AND** the Tokens page SHALL keep the Daily detail expanded

##### Example: missing Top session target

- **GIVEN** a Top session row with `agent=codex-cli` and `session_id=missing123`
- **WHEN** the user invokes reveal and the source cannot be resolved
- **THEN** the Tokens page SHALL show not-found feedback and keep the Daily detail expanded
