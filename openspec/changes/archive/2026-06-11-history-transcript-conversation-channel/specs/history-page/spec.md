## MODIFIED Requirements

### Requirement: History page reads a selected transcript

The system SHALL allow a user to select a listed session and read its transcript from the local source file. Transcript content SHALL be normalized into ordered entries that distinguish at least user-like content, assistant-like content, tool or system or other content, and token usage entries when available.

Each normalized non-usage entry SHALL additionally carry a channel classification with exactly two values: `conversation` (content the user typed or the assistant replied as part of the visible dialogue) and `background` (content produced by harness or agent machinery rather than the visible dialogue). Classification SHALL prefer structural signals from the source format over content heuristics, and any entry whose signals are missing or unrecognized SHALL default to `conversation`.

For Claude Code transcripts, the system SHALL classify as `background`: entries marked as sidechain (`isSidechain: true`), entries marked as meta (`isMeta: true`), lines of type `system`, user-role entries whose content consists only of tool result blocks, and user-role entries whose trimmed text starts with a harness-injection prefix (`<system-reminder>`, the `<local-command-` tag family such as `<local-command-stdout>` / `<local-command-caveat>`, or `Caveat:`). For Codex transcripts, the system SHALL classify as `background`: response items whose payload type is `reasoning`, `function_call`, or `function_call_output`.

User-role entries wrapped in slash-command tags (`<command-message>` / `<command-name>` / `<command-args>`) are user input, not harness machinery. The system SHALL classify them as `conversation` and SHALL restore their content to the form the user actually typed: the `<command-name>` value followed by the `<command-args>` value (command name only when args are empty). When the tag structure cannot be parsed, the system SHALL keep the original content verbatim and still classify the entry as `conversation`.

User-role entries containing a `<bash-input>` tag are likewise user input (the `!` shell escape). The system SHALL classify them as `conversation` and SHALL restore their content to `! ` followed by the `<bash-input>` value, discarding accompanying `<bash-stdout>` / `<bash-stderr>` wrappers. User-role entries that carry only `<bash-stdout>` / `<bash-stderr>` content without a `<bash-input>` tag SHALL be classified as `background`.

#### Scenario: User selects a readable session

- **WHEN** the user selects a session whose transcript file can be read
- **THEN** the page SHALL display the selected session metadata
- **AND** the page SHALL display ordered transcript entries for that session
- **AND** the page SHALL display the local source path for the transcript

##### Example: readable session view

- **GIVEN** session `codex-cli/abc123` has source path `/Users/u/.codex/sessions/abc123.jsonl` and normalized entries `user`, `assistant`
- **WHEN** the user selects `codex-cli/abc123`
- **THEN** the viewer SHALL show source path `/Users/u/.codex/sessions/abc123.jsonl` and entries in order `user`, `assistant`

#### Scenario: Selected transcript cannot be read

- **WHEN** the user selects a session whose transcript file is missing or unreadable
- **THEN** the page SHALL display a non-crashing error state for that selected session
- **AND** the page SHALL preserve the selected agent and session ID in the UI

##### Example: selected missing transcript

- **GIVEN** the user selected `claude-code/missing123`
- **WHEN** transcript read returns not-found
- **THEN** the error state SHALL still identify `claude-code/missing123`

#### Scenario: Transcript entries are classified into channels

- **WHEN** a transcript is normalized into entries
- **THEN** each non-usage entry SHALL carry `channel` equal to `conversation` or `background`
- **AND** entries with missing or unrecognized classification signals SHALL carry `channel` equal to `conversation`

##### Example: Claude Code background classification

- **GIVEN** a Claude Code transcript containing a sidechain assistant line (`isSidechain: true`), a user-role line whose content is a single tool_result block, a user-role line starting with `<system-reminder>`, and a plain user-typed line `hello`
- **WHEN** the transcript is normalized
- **THEN** the first three entries SHALL carry `channel=background`
- **AND** the `hello` entry SHALL carry `channel=conversation`

##### Example: slash command restored as typed input

- **GIVEN** a Claude Code user-role line whose content is `<command-message>spectra-discuss</command-message> <command-name>/spectra-discuss</command-name> <command-args>import browser should support folders</command-args>`
- **WHEN** the transcript is normalized
- **THEN** the entry SHALL carry `channel=conversation`
- **AND** the entry content SHALL be `/spectra-discuss import browser should support folders`

##### Example: bash escape restored as typed input

- **GIVEN** a Claude Code user-role line whose content is `<bash-input>code .</bash-input>` followed by `<bash-stdout>(no output)</bash-stdout><bash-stderr></bash-stderr>`
- **WHEN** the transcript is normalized
- **THEN** the entry SHALL carry `channel=conversation`
- **AND** the entry content SHALL be `! code .`

##### Example: Codex background classification

- **GIVEN** a Codex transcript containing a `reasoning` response item, a `function_call` response item, and a `message` response item with output text
- **WHEN** the transcript is normalized
- **THEN** the `reasoning` and `function_call` entries SHALL carry `channel=background`
- **AND** the `message` entry SHALL carry `channel=conversation`

### Requirement: History page supports agent and metadata filtering

The system SHALL provide lightweight filters for the History session list. At minimum, the user SHALL be able to filter by agent and by free-text metadata matching session ID, project, or model.

The transcript view SHALL provide display filters `All`, `Conversation`, and `Usage`. `All` SHALL show every entry. `Usage` SHALL show only usage entries. `Conversation` SHALL show only entries whose role is not `usage` and whose channel is `conversation`, hiding background entries.

#### Scenario: User filters by agent

- **WHEN** the user selects an agent filter on the History page
- **THEN** the session list SHALL include only sessions for the selected agent

##### Example: agent filter

- **GIVEN** sessions `codex-cli/s1`, `claude-code/s2`, and `codex-cli/s3`
- **WHEN** the user filters by `codex-cli`
- **THEN** the visible sessions SHALL be `codex-cli/s1` and `codex-cli/s3`

#### Scenario: User filters by metadata text

- **WHEN** the user enters a text filter
- **THEN** the session list SHALL include sessions whose session ID, project, or model contains the entered text case-insensitively

##### Example: metadata filter

- **GIVEN** sessions with metadata `session_id=abc123 project=felina model=gpt-5`, `session_id=def456 project=demo model=claude`, and `session_id=ghi789 project=felina model=claude`
- **WHEN** the user filters by `felina`
- **THEN** the visible sessions SHALL be `abc123` and `ghi789`

#### Scenario: Conversation filter hides background entries

- **WHEN** the user selects the `Conversation` transcript filter
- **THEN** the transcript view SHALL show only entries with `channel=conversation` and role other than `usage`

##### Example: conversation-only view

- **GIVEN** a transcript with entries `user/conversation`, `assistant/conversation`, `user/background` (tool result), and a `usage` entry
- **WHEN** the user selects the `Conversation` filter
- **THEN** the visible entries SHALL be the `user/conversation` and `assistant/conversation` entries
- **AND** selecting `All` SHALL show all four entries
