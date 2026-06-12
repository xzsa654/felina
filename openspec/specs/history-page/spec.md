# history-page Specification

## Purpose

TBD - created by archiving change 'add-history-page'. Update Purpose after archive.

## Requirements

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


<!-- @trace
source: tokens-cross-platform-fix
updated: 2026-05-25
code:
  - .knowledge/knowledge-base/architecture.md
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/tokens.rs
  - .knowledge/_catalog.json
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - .knowledge/knowledge-base/_index.json
  - .session/product-backlog.md
  - README.md
-->

---
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


<!-- @trace
source: history-transcript-conversation-channel
updated: 2026-06-11
code:
  - src-tauri/src/tokens/types.rs
  - src/app.css
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/utils/markdown-source-map.ts
  - src-tauri/src/commands/tokens.rs
-->

---
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


<!-- @trace
source: history-transcript-conversation-channel
updated: 2026-06-11
code:
  - src-tauri/src/tokens/types.rs
  - src/app.css
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/utils/markdown-source-map.ts
  - src-tauri/src/commands/tokens.rs
-->

---
### Requirement: History page can reveal transcript source files

The system SHALL allow the user to reveal a selected session transcript source file in the operating system file manager when that source file exists.

#### Scenario: User reveals a transcript source file

- **WHEN** the user invokes reveal for a session whose source file exists
- **THEN** the operating system file manager SHALL open at or near the transcript source file

##### Example: reveal existing Codex transcript

- **GIVEN** session `codex-cli/abc123` resolves to `/Users/u/.codex/sessions/abc123.jsonl`
- **WHEN** the user invokes reveal for `codex-cli/abc123`
- **THEN** the operating system file manager SHALL open at or near `/Users/u/.codex/sessions/abc123.jsonl`

#### Scenario: Reveal target is missing

- **WHEN** the user invokes reveal for a session whose source file cannot be resolved
- **THEN** the page SHALL show a non-crashing not-found state
- **AND** the page SHALL NOT clear the selected session

##### Example: reveal missing transcript

- **GIVEN** session `codex-cli/deleted123` is selected
- **WHEN** reveal returns not-found
- **THEN** the page SHALL still show `codex-cli/deleted123` as the selected session

<!-- @trace
source: add-history-page
updated: 2026-05-25
code:
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/layout/Header.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/i18n/locales/en.ts
  - src/router.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/history/HistoryPage.tsx
-->

---
### Requirement: Glassmorphism List Styles

The History page's session list SHALL NOT use hardcoded solid borders (such as `border-l-2` or `border-r-2`) or fully solid background colors to indicate active or hovered states. Instead, they SHALL use glassmorphism techniques (e.g., `backdrop-blur-md`, subtle semi-transparent background colors, and low-opacity borders) to allow the underlying application background grid animations to remain visible.

#### Scenario: User hovers over a list item

- **WHEN** the user hovers over a session in the History list
- **THEN** the item SHALL display a semi-transparent glassmorphism background
- **AND** the item SHALL NOT display a solid border

#### Scenario: User selects a list item

- **WHEN** the user selects a session
- **THEN** the active item SHALL display a brighter semi-transparent background and a subtle border to distinguish it from the hover state
- **AND** the active item SHALL NOT use thick solid left/right borders

<!-- @trace
source: enforce-ui-guidelines-page-scaffold
updated: 2026-06-03
code:
  - src/lib/assets/logo.png
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.tsx
  - temp_spec_token_analytics.md
  - GEMINI.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/router.tsx
  - src/app.css
  - src/lib/components/projects/ProjectsPage.tsx
  - temp_tasks.md
  - temp_spec_history_page.md
  - src/lib/components/history/HistoryPage.tsx
  - temp_proposal.md
  - temp_spec_felina_settings.md
  - src/lib/components/projects/ProjectsList.tsx
  - .session/projects-page-ui-adjustment-report.md
  - temp_spec_app_pages.md
  - src/lib/assets/logo_.png
  - src/lib/components/projects/ManagedInventory.tsx
  - temp_design.md
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/shared/PageScaffold.tsx
-->

---
### Requirement: Session list pagination resets on filter change

The History page SHALL load sessions in pages of 50 with a load-more control showing loaded and total counts, and SHALL reset the list to the first page of the new result set whenever the agent filter or the session search query changes. The load-more control SHALL NOT be shown when all sessions are loaded.

#### Scenario: Load more appends the next page

- **WHEN** the user activates the load-more control and more sessions exist
- **THEN** the next page is appended to the list and the loaded/total counts update accordingly

#### Scenario: Changing the agent filter resets the list

- **WHEN** the user switches the agent filter after loading multiple pages
- **THEN** the list shows the first page of sessions matching the new filter


<!-- @trace
source: history-react-query-migration
updated: 2026-06-12
code:
  - .knowledge/ideas-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/history/hooks/useHistoryQueries.ts
  - src/lib/components/memory/MemoryPage.tsx
  - .knowledge/knowledge-base/_index.json
  - src/lib/components/history/HistoryPage.tsx
tests:
  - tests/history-pagination.test.ts
-->

---
### Requirement: Transcript loads are race-safe and cached within a session

The History page SHALL key transcript loads by agent and session ID so that rapidly switching the selected session never renders a previously selected session's transcript, and SHALL serve a previously viewed transcript from cache without a visible reload when the user re-selects it within the same app session.

#### Scenario: Rapid session switching shows the latest selection

- **WHEN** the user selects session A and then session B before A's transcript finishes loading
- **THEN** the page renders session B's transcript and never displays A's transcript under B's selection

#### Scenario: Re-selecting a viewed session hits the cache

- **WHEN** the user returns to a session whose transcript was already loaded in this app session
- **THEN** the transcript renders without an intervening loading state

<!-- @trace
source: history-react-query-migration
updated: 2026-06-12
code:
  - .knowledge/ideas-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/history/hooks/useHistoryQueries.ts
  - src/lib/components/memory/MemoryPage.tsx
  - .knowledge/knowledge-base/_index.json
  - src/lib/components/history/HistoryPage.tsx
tests:
  - tests/history-pagination.test.ts
-->