## ADDED Requirements

### Requirement: Memory page uses translation resources

The `/memory` page SHALL obtain user-visible static text from translation resources via t(locale, key) instead of hard-coded English literals. This includes the page title, loading text, empty states, project list labels, memory file list labels, editor controls (create, edit, save, delete, cancel), and save feedback messages. User and system data — project paths, file names, timestamps, memory file content, and backend error payloads — SHALL be displayed verbatim and SHALL NOT be translated.

#### Scenario: Memory page text follows active locale

- **WHEN** the active locale is `zh-TW` and the user opens `/memory`
- **THEN** the page title, loading text, empty states, and editor controls SHALL render from the Traditional Chinese translation resource, while project paths and file names render verbatim

#### Scenario: Memory save failure shows localized title with verbatim detail

- **WHEN** saving a memory file fails
- **THEN** the page SHALL present a localized failure title together with the backend error payload verbatim, instead of a bare stringified error

### Requirement: History page uses translation resources

The `/history` page SHALL obtain user-visible static text from translation resources via t(locale, key) instead of hard-coded English literals. This includes the page title, agent filter labels, transcript filter labels, search placeholders, loading text, empty states, the session-selection prompt, and the load-more control. User and system data — session IDs, project paths, model names, agent identifiers, timestamps, transcript content, and backend error payloads — SHALL be displayed verbatim and SHALL NOT be translated.

#### Scenario: History page text follows active locale

- **WHEN** the active locale is `zh-TW` and the user opens `/history`
- **THEN** filter labels, search placeholders, loading and empty states SHALL render from the Traditional Chinese translation resource, while session IDs, model names, and transcript content render verbatim

#### Scenario: History load failure shows localized title with verbatim detail

- **WHEN** loading the session list or a transcript fails
- **THEN** the page SHALL present a localized failure title together with the backend error payload verbatim, instead of a bare stringified error

### Requirement: History page uses locale-aware number formatting

The `/history` page SHALL pass the active locale to number formatting for user-visible token and message counts, preserving the underlying numeric values.

#### Scenario: Token counts follow active locale formatting

- **WHEN** `/history` displays per-session token and message counts with the active locale set to `zh-TW`
- **THEN** the counts SHALL use the locale-aware formatter with the active locale while preserving the numeric values
