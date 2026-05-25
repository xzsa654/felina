# history-page Specification

## Purpose

TBD - created by archiving change 'add-history-page'. Update Purpose after archive.

## Requirements

### Requirement: History page lists local sessions

The system SHALL provide a History page at `/history` that lists local agent sessions discovered from supported agent transcript sources. Each listed session SHALL expose agent, session ID, project when available, model when available, date or timestamp when available, message count when available, token total when available, and transcript availability status.

#### Scenario: User opens History

- **WHEN** the user navigates to `/history`
- **THEN** the system SHALL render the History page
- **AND** the page SHALL request local session records
- **AND** the page SHALL display a scannable session list when records exist

#### Scenario: No local sessions exist

- **WHEN** the History page receives an empty session list
- **THEN** the page SHALL display an empty state
- **AND** the page SHALL NOT show stale session rows from a previous load

##### Example: empty session list

- **GIVEN** the previous visible list contained `codex-cli/abc123`
- **WHEN** the next History load returns `[]`
- **THEN** `codex-cli/abc123` SHALL NOT remain visible and the empty state SHALL be shown


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
### Requirement: History page reads a selected transcript

The system SHALL allow a user to select a listed session and read its transcript from the local source file. Transcript content SHALL be normalized into ordered entries that distinguish at least user-like content, assistant-like content, tool or system or other content, and token usage entries when available.

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
### Requirement: History page supports agent and metadata filtering

The system SHALL provide lightweight filters for the History session list. At minimum, the user SHALL be able to filter by agent and by free-text metadata matching session ID, project, or model.

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