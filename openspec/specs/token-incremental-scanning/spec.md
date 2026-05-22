# token-incremental-scanning Specification

## Purpose

TBD - created by archiving change 'make-token-scanning-incremental'. Update Purpose after archive.

## Requirements

### Requirement: Persist per-agent scan cursors

The system SHALL persist scan cursor state for each agent and source path. The cursor state SHALL include the agent id, source path, last successful file modification timestamp, last scan timestamp, and last error summary.

#### Scenario: Cursor state is created after successful scan

- **WHEN** refresh_token_data scans a source path successfully
- **THEN** the system SHALL persist cursor state for that agent and source path
- **THEN** the cursor state SHALL record the latest successfully processed file modification timestamp

#### Scenario: Cursor state survives app restart

- **WHEN** the application restarts after a successful scan
- **THEN** the next refresh_token_data call SHALL read the persisted cursor state before scanning files


<!-- @trace
source: make-token-scanning-incremental
updated: 2026-05-22
code:
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/maintenance.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
-->

---
### Requirement: Incremental scan processes changed sources

The scanner SHALL process every file whose modification timestamp is newer than the persisted cursor for that agent and source path. The scanner MUST NOT rely on a fixed maximum recent-file count as the primary completeness rule.

#### Scenario: Old file receives new token events

- **GIVEN** a source path has already been scanned and its cursor is persisted
- **WHEN** an older conversation file is modified after the cursor timestamp
- **THEN** the next refresh_token_data call SHALL process that modified file

#### Scenario: More than fifty files changed

- **GIVEN** a source path contains 75 files with modification timestamps newer than the cursor
- **WHEN** refresh_token_data scans the source path
- **THEN** the scanner SHALL process all 75 changed files


<!-- @trace
source: make-token-scanning-incremental
updated: 2026-05-22
code:
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/maintenance.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
-->

---
### Requirement: Refresh result reports scan coverage

refresh_token_data SHALL return scan coverage fields including agents scanned, files scanned, files skipped, events parsed, events inserted, and parse errors. Parse errors SHALL include the agent id, source identifier, and a human-readable error message.

#### Scenario: Scan succeeds with skipped unchanged files

- **WHEN** refresh_token_data finds unchanged files and changed files in the same source path
- **THEN** the response SHALL report changed files as files scanned
- **THEN** the response SHALL report unchanged files as files skipped

#### Scenario: One file fails to parse

- **WHEN** one source file fails to parse while other source files are valid
- **THEN** refresh_token_data SHALL include one parse error for the failed file
- **THEN** refresh_token_data SHALL still return events from the valid files

#### Scenario: Failed file is retried after newer files succeed

- **GIVEN** a source path contains an older changed file that fails to parse
- **AND** the same source path contains a newer changed file that parses successfully
- **WHEN** refresh_token_data completes with a parse error for the older file
- **THEN** the persisted cursor SHALL NOT advance past the failed file in a way that skips it on the next refresh
- **THEN** the next refresh_token_data call SHALL attempt the failed file again unless it has been successfully processed or explicitly marked safe to skip

#### Scenario: Scan state persistence fails

- **WHEN** refresh_token_data cannot read or write scan cursor state
- **THEN** refresh_token_data SHALL return an error rather than reporting a successful refresh
- **THEN** the error SHALL be treated as a refresh failure, not as a file-level parse error

#### Scenario: Agents scanned reflects actual scanned parsers

- **GIVEN** the parser registry contains available and unavailable agents
- **WHEN** refresh_token_data scans available parsers
- **THEN** the response SHALL report agents scanned as the number of parsers actually scanned
- **THEN** the response SHALL NOT hard-code the total number of registered agent types


<!-- @trace
source: make-token-scanning-incremental
updated: 2026-05-22
code:
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/maintenance.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
-->

---
### Requirement: Agent status reflects scan state

AgentStatus SHALL expose persisted scan status for each agent. Last scanned SHALL represent the latest scan attempt timestamp from scan state, not the maximum token event timestamp. If the system persists a last error summary, AgentStatus SHALL expose enough information for the UI to show that status without reading logs.

#### Scenario: Event timestamp differs from scan timestamp

- **GIVEN** an agent has token events whose timestamps are older than the latest refresh
- **WHEN** the UI requests agent status
- **THEN** last scanned SHALL reflect the latest scan state timestamp
- **THEN** last scanned SHALL NOT be derived from MAX(token_events.timestamp)

#### Scenario: Last scan error is available after refresh

- **GIVEN** a refresh records a parse error summary for an agent and source path
- **WHEN** the UI requests agent status after that refresh
- **THEN** the response SHALL include the persisted last error summary or equivalent status field


<!-- @trace
source: make-token-scanning-incremental
updated: 2026-05-22
code:
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/maintenance.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
-->

---
### Requirement: SQLite uniqueness remains the duplicate safety net

The system SHALL retain SQLite uniqueness for token events and use it as duplicate prevention during upsert. Incremental scan cursor state SHALL control scan coverage, and SQLite uniqueness SHALL control event identity.

#### Scenario: A source is intentionally rescanned

- **WHEN** a source file that was already processed is scanned again
- **THEN** duplicate token events SHALL NOT be inserted into token_events
- **THEN** refresh_token_data SHALL report parsed events and inserted events as separate counts

<!-- @trace
source: make-token-scanning-incremental
updated: 2026-05-22
code:
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/maintenance.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
-->