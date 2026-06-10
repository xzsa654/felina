# tokscale-backed-token-ingestion Specification

## Purpose

TBD - created by archiving change 'tokscale-backed-token-ingestion'. Update Purpose after archive.

## Requirements

### Requirement: Use tokscale as production token ingestion source

The system SHALL use tokscale machine-readable output as the primary production ingestion source for `/tokens` refresh. The production refresh path MUST NOT use Felina Claude, Codex, or Gemini parsers as the default source after this migration.

#### Scenario: Successful tokscale-backed refresh

- **WHEN** the operator refreshes token data and tokscale returns valid machine-readable usage rows
- **THEN** the system SHALL store or cache analytics data derived from tokscale output
- **THEN** the refresh result SHALL identify tokscale as the active ingestion source
- **THEN** `/tokens` analytics SHALL be computed from tokscale-backed data

##### Example: source selection

- **GIVEN** tokscale returns `claude` and `codex` usage rows
- **WHEN** `refresh_token_data` completes successfully
- **THEN** the active source is `tokscale_export`
- **THEN** Felina parser-backed rows are not included in the returned analytics totals


<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Normalize tokscale usage rows

The system SHALL normalize tokscale JSON usage rows into the internal analytics shape before storage or aggregation. Normalized rows MUST include agent, provider, model, input tokens, output tokens, cache read tokens, cache write tokens, event or message count, timestamp or scope bucket, and source metadata. If tokscale omits reasoning tokens, the system SHALL treat reasoning as zero.

#### Scenario: Normalize Claude and Codex rows

- **WHEN** tokscale JSON includes rows with `client`, `model`, `provider`, `input`, `output`, `cacheRead`, `cacheWrite`, and `messageCount`
- **THEN** the system SHALL map `client=claude` to `claude-code`
- **THEN** the system SHALL map `client=codex` to `codex-cli`
- **THEN** the system SHALL preserve cache and message count fields in the normalized row
- **THEN** the system SHALL preserve reasoning when present and use `0` when omitted

##### Example: tokscale row mapping

| Tokscale client | Model | Input | Output | Cache Read | Cache Write | Reasoning | Message Count | Expected Agent |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| claude | claude-sonnet-4-6 | 59951 | 1578906 | 168809098 | 7465353 | 0 | 2345 | claude-code |
| codex | gpt-5.5 | 5162272 | 339926 | 65629568 | 0 | 56278 | 881 | codex-cli |

#### Scenario: Unsupported tokscale schema

- **WHEN** tokscale output lacks required token usage fields
- **THEN** the system SHALL report an unsupported schema status
- **THEN** the system MUST NOT create zero-token production records from that output

##### Example: missing cache fields

- **GIVEN** tokscale returns a row with `client=claude`, `provider=anthropic`, `model=claude-sonnet-4-6`, `input=10`, `output=1`, and `messageCount=1`
- **AND** the row omits `cacheRead`, `cacheWrite`, or `reasoning`
- **WHEN** production refresh parses the row
- **THEN** the refresh result reports `unsupported_schema`
- **THEN** no `tokscale_export` production row is written for that output


<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Preserve `/tokens` analytics API compatibility

The system SHALL preserve the existing `/tokens` analytics command and frontend response shape while changing the ingestion backend. Existing consumers MUST continue receiving totals, agent breakdown, model breakdown, time-series data, cache metrics, and refresh status fields with compatible names and types.

#### Scenario: Frontend reads analytics after migration

- **WHEN** the `/tokens` page requests token analytics after a successful tokscale-backed refresh
- **THEN** the Tauri command SHALL return the same response shape expected before migration
- **THEN** totals and breakdowns SHALL be computed from tokscale-backed normalized data
- **THEN** the response SHALL expose refresh status without requiring frontend schema changes


<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Isolate legacy parser data from tokscale-backed data

The system SHALL prevent legacy Felina parser-backed rows from being aggregated together with tokscale-backed rows after migration. The implementation MUST provide either active source or active generation isolation, or a reversible storage rebuild that excludes legacy rows from production analytics.

#### Scenario: Legacy data exists before migration

- **WHEN** parser-backed `token_events` already exist before the first tokscale-backed refresh
- **THEN** the migration SHALL preserve a rollback path for the pre-migration data
- **THEN** production analytics SHALL aggregate only the active tokscale-backed source or generation after migration
- **THEN** legacy parser-backed rows SHALL NOT inflate tokscale-backed totals

##### Example: aggregate isolation

- **GIVEN** legacy parser-backed total is `2076337915`
- **AND** tokscale-backed total is `1161157714`
- **WHEN** analytics are requested after migration
- **THEN** the returned total is derived from `1161157714`
- **THEN** the returned total is not the sum of both sources


<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Surface tokscale failures without corrupting analytics

The system SHALL distinguish missing binary, command failed, unsupported schema, and parse failed statuses for tokscale-backed refresh. Failed tokscale refreshes MUST NOT overwrite the last successful analytics with empty or partial data.

#### Scenario: Tokscale binary is missing

- **WHEN** production refresh runs and the tokscale executable is unavailable
- **THEN** the refresh result SHALL report missing binary status
- **THEN** the system SHALL preserve the last successful analytics data
- **THEN** the system MUST NOT silently report Felina parser data as a successful tokscale refresh

##### Example: missing executable

- **GIVEN** no `tokscale` executable exists on `PATH`
- **AND** `FELINA_TOKSCALE_BIN` is unset
- **WHEN** `refresh_token_data` runs
- **THEN** the refresh result reports `status=missing_binary`
- **THEN** `fallback_used=false`
- **THEN** the previous active source remains active

#### Scenario: Tokscale command fails

- **WHEN** tokscale exits unsuccessfully during production refresh
- **THEN** the refresh result SHALL report command failed status and diagnostic message
- **THEN** existing analytics SHALL remain unchanged

##### Example: non-zero exit

- **GIVEN** tokscale exits with status code `1`
- **AND** stderr contains `failed to read local usage`
- **WHEN** `refresh_token_data` runs
- **THEN** the refresh result reports `status=command_failed`
- **THEN** the refresh result includes the diagnostic message
- **THEN** existing analytics rows and active source remain unchanged


<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Require explicit parser fallback

The system SHALL disable automatic Felina parser fallback by default for production refresh. If parser fallback is explicitly enabled, the refresh result and analytics metadata MUST identify the fallback source.

#### Scenario: Fallback disabled by default

- **WHEN** tokscale-backed refresh fails and no explicit fallback option is enabled
- **THEN** the system SHALL return a degraded or failed refresh status
- **THEN** the system MUST NOT run Felina parsers as an implicit replacement source

##### Example: default refresh does not fallback

- **GIVEN** the active source is `tokscale_export`
- **AND** tokscale refresh fails with `command_failed`
- **WHEN** the default `/tokens` refresh command runs
- **THEN** the refresh result reports `fallback_used=false`
- **THEN** no rows are written with `source=parser_fallback`

#### Scenario: Explicit fallback enabled

- **WHEN** tokscale-backed refresh fails and explicit parser fallback is enabled
- **THEN** the system SHALL run the parser fallback path
- **THEN** the refresh result SHALL identify the active source as parser fallback
- **THEN** analytics metadata SHALL distinguish fallback data from tokscale-backed data

##### Example: diagnostic fallback source

- **GIVEN** tokscale refresh fails with `missing_binary`
- **AND** a diagnostic caller enables parser fallback explicitly
- **WHEN** the fallback refresh completes
- **THEN** the refresh result reports `status=parser_fallback`
- **THEN** the refresh result reports `active_source=parser_fallback`
- **THEN** fallback analytics rows are written with `source=parser_fallback`

<!-- @trace
source: tokscale-backed-token-ingestion
updated: 2026-05-22
code:
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/budget.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/tokens/scanner.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/commands/stats.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/scan_state.rs
  - src-tauri/src/commands/memory.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - docs/token-usage-source-of-truth.md
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Resolve Windows command shims for tokscale invocation

On Windows, when spawning a bare command name (not an explicit user-provided path) for the tokscale source or its npx fallback, and the initial spawn fails with a not-found error, the system SHALL retry the spawn using the `.cmd` variant of the command name. Explicit binary paths provided via the tokscale binary override MUST NOT be retried with name variants. On non-Windows platforms the spawn behavior MUST remain unchanged. The retry MUST NOT route execution through a shell interpreter.

#### Scenario: npm-installed tokscale shim is found on Windows

- **WHEN** the refresh runs on Windows and `tokscale` is installed globally via npm (exposing only a `tokscale.cmd` shim on PATH)
- **THEN** the system SHALL retry with `tokscale.cmd` after the bare `tokscale` spawn fails with not-found
- **THEN** the refresh SHALL collect tokscale data instead of reporting `missing_binary`

#### Scenario: npx fallback shim is found on Windows

- **WHEN** the refresh runs on Windows, `tokscale` is absent, and Node.js is installed (exposing `npx.cmd` on PATH)
- **THEN** the system SHALL retry the fallback with `npx.cmd` after the bare `npx` spawn fails with not-found
- **THEN** the npx fallback SHALL execute instead of reporting `missing_binary`

#### Scenario: explicit binary override is not variant-retried

- **WHEN** the refresh runs with an explicit tokscale binary path override and that path does not exist
- **THEN** the system SHALL NOT attempt `.cmd` or other name variants
- **THEN** the refresh SHALL report `missing_binary` for the tokscale source

#### Scenario: neither tokscale nor Node.js is installed on Windows

- **WHEN** the refresh runs on Windows and the bare names and `.cmd` variants of both `tokscale` and `npx` fail with not-found
- **THEN** the refresh SHALL report `missing_binary` with a message indicating both the binary and the npx fallback are unavailable

##### Example: resolution order on Windows

| Attempt | Command | Result | Next step |
| ------- | ------- | ------ | --------- |
| 1 | `tokscale` | not-found | retry variant |
| 2 | `tokscale.cmd` | not-found | npx fallback |
| 3 | `npx --yes tokscale@latest` | not-found | retry variant |
| 4 | `npx.cmd --yes tokscale@latest` | not-found | report `missing_binary` |

<!-- @trace
source: tokscale-windows-cmd-resolution-fix
updated: 2026-06-10
code:
  - README.md
  - .knowledge/knowledge-base/architecture.md
  - docs/tokscale-backed-token-ingestion.md
  - .session/product-backlog.md
  - .session/felina_hackathon_ppt_spec_report.md
  - .knowledge/ideas-backlog.md
  - .session/ui-design-guidelines.md
  - .session/release-notes-v1.0.0.md
  - .session/agent-skill-market-complete.md
  - src-tauri/src/tokens/tokscale.rs
  - .session/felina_development_report.md
-->

---
### Requirement: Resolve bundled sidecar tokscale binary

When no explicit binary override is set and the PATH lookup (including Windows `.cmd` variants) fails with not-found, the system SHALL attempt the bundled sidecar tokscale binary located in the same directory as the main executable, before falling back to npx. A sidecar candidate SHALL only be used when the file exists. The explicit override, PATH, and npx behaviors MUST remain unchanged.

#### Scenario: clean machine uses the sidecar

- **WHEN** the refresh runs on a machine with no tokscale on PATH and no Node.js, and the sidecar binary exists next to the main executable
- **THEN** the system SHALL execute the sidecar binary
- **THEN** the refresh SHALL collect tokscale data instead of reporting `missing_binary`

#### Scenario: PATH installation takes precedence over the sidecar

- **WHEN** the refresh runs and a tokscale binary is resolvable via PATH
- **THEN** the system SHALL use the PATH binary and SHALL NOT execute the sidecar

#### Scenario: missing sidecar preserves current behavior

- **WHEN** the refresh runs in a development environment where the sidecar file does not exist
- **THEN** the resolution chain SHALL behave exactly as before this change (PATH → npx → `missing_binary`)

#### Scenario: failing sidecar falls back to npx

- **WHEN** the sidecar binary exists but its execution fails
- **THEN** the system SHALL continue with the npx fallback without aborting the refresh

##### Example: full resolution order

| Step | Candidate | Condition |
| ---- | --------- | --------- |
| 1 | explicit override (env) | set → used exclusively, no fallback |
| 2 | PATH `tokscale` (+ `.cmd` on Windows) | found → use |
| 3 | sidecar next to main executable | file exists → use |
| 4 | `npx --yes tokscale@latest` (+ `.cmd` on Windows) | found → use |
| 5 | — | report `missing_binary` |

<!-- @trace
source: bundle-tokscale-distribution
updated: 2026-06-10
code:
  - src-tauri/tauri.conf.json
  - .knowledge/knowledge-base/architecture.md
  - .session/agent-skill-market-complete.md
  - .session/ui-design-guidelines.md
  - scripts/fetch-tokscale.mjs
  - .knowledge/ideas-backlog.md
  - .knowledge/knowledge-base/platform.md
  - .knowledge/milestones.md
  - package.json
  - .session/product-backlog.md
  - .session/felina_development_report.md
  - docs/tokscale-backed-token-ingestion.md
  - .session/release-notes-v1.0.0.md
  - .knowledge/_catalog.json
  - README.md
  - src-tauri/src/tokens/tokscale.rs
  - .session/felina_hackathon_ppt_spec_report.md
-->