## ADDED Requirements

### Requirement: Session analytics include agent identity

The system SHALL include agent identity in session analytics records returned for Daily Top sessions so callers can resolve session transcripts across supported agent sources.

#### Scenario: Daily Top sessions response includes agent

- **WHEN** `get_day_top_sessions` returns a session row
- **THEN** the row SHALL include `agent`
- **AND** `agent` SHALL be one of `claude-code`, `codex-cli`, or `gemini-cli`
- **AND** the row SHALL include `session_id`

##### Example: session row identity

- **GIVEN** a Codex event with `session_id=abc123`
- **WHEN** `get_day_top_sessions` includes that event in a row
- **THEN** the row SHALL include `agent=codex-cli` and `session_id=abc123`

### Requirement: Session transcript commands

The system SHALL expose Tauri commands for History session listing, transcript reading, and transcript source reveal. The commands SHALL use `agent + session_id` as the session identity for single-session operations.

#### Scenario: List sessions for History

- **WHEN** the History page requests local sessions
- **THEN** the backend SHALL return session records with agent, session ID, project when available, model when available, timestamp or date when available, message count when available, token total when available, and transcript availability status

##### Example: session list row

- **GIVEN** a readable Codex transcript for `session_id=abc123` and token analytics totals `messages=4` and `tokens=1200`
- **WHEN** the History page requests local sessions
- **THEN** one returned row SHALL include `agent=codex-cli`, `session_id=abc123`, `messages=4`, `tokens=1200`, and `transcript_available=true`

#### Scenario: Read a session transcript

- **WHEN** the frontend requests a transcript with `agent=codex-cli` and `session_id=abc123`
- **THEN** the backend SHALL resolve the matching supported local transcript source
- **AND** return a normalized transcript object containing source path, agent, session ID, metadata, and ordered entries

##### Example: normalized transcript entries

- **GIVEN** a Codex JSONL transcript containing a user entry followed by an assistant entry
- **WHEN** the frontend requests `agent=codex-cli` and `session_id=abc123`
- **THEN** the normalized transcript SHALL contain entries in source order with roles `user` and `assistant`

#### Scenario: Reveal a session transcript source

- **WHEN** the frontend requests reveal for `agent=codex-cli` and `session_id=abc123`
- **THEN** the backend SHALL resolve the matching transcript source file
- **AND** ask the operating system file manager to reveal that source file
- **AND** return the resolved transcript location when the reveal command succeeds

#### Scenario: Transcript source is unavailable

- **WHEN** the frontend requests read or reveal for a session whose transcript source cannot be resolved
- **THEN** the backend SHALL return a clear not-found error
- **AND** the backend SHALL NOT create a placeholder transcript file

##### Example: deleted source file

- **GIVEN** no supported local transcript file exists for `agent=codex-cli` and `session_id=missing123`
- **WHEN** the frontend requests read for that identity
- **THEN** the backend SHALL return a not-found error and create no file for `missing123`

### Requirement: Transcript content is not persisted in analytics storage

The system SHALL NOT persist full transcript body content in the token analytics database or app settings as part of the History first version. Transcript body content SHALL be read from local source files on demand.

#### Scenario: Transcript is read

- **WHEN** the user opens a session transcript in History
- **THEN** the backend SHALL read transcript content from the resolved local source file
- **AND** the backend SHALL NOT write transcript body content to token analytics storage

##### Example: on-demand transcript read

- **GIVEN** transcript content exists only in `/Users/u/.codex/sessions/abc123.jsonl`
- **WHEN** the user opens `codex-cli/abc123` in History
- **THEN** the backend SHALL read `/Users/u/.codex/sessions/abc123.jsonl` and SHALL NOT insert that transcript body into `token_events`
