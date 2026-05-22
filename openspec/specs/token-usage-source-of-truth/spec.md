# token-usage-source-of-truth Specification

## Purpose

TBD - created by archiving change 'investigate-token-usage-source-of-truth'. Update Purpose after archive.

## Requirements

### Requirement: Reconcile independent token usage sources

The system SHALL provide a local reconciliation command that compares token usage across Felina SQLite storage, Felina parser dry-run output, and tokscale export output for the same requested scope. The command MUST NOT mutate production token storage, scan cursors, or `/tokens` analytics state.

#### Scenario: Compare all available sources for a date range

- **WHEN** the operator runs token reconciliation with a date range
- **THEN** the system SHALL collect Felina SQLite aggregates for that date range
- **THEN** the system SHALL collect Felina parser dry-run aggregates for that date range
- **THEN** the system SHALL collect tokscale export aggregates for that date range when tokscale is available
- **THEN** the system SHALL produce a reconciliation report without writing token events or scan cursor state

##### Example: one day comparison scope

- **GIVEN** the requested date range is `2026-05-21T00:00:00Z` through `2026-05-21T23:59:59Z`
- **AND** Felina SQLite reports `codex-cli=900000` total tokens
- **AND** Felina parser dry-run reports `codex-cli=920000` total tokens
- **AND** tokscale export reports `codex-cli=300000` total tokens
- **WHEN** reconciliation completes
- **THEN** the report SHALL include all three source totals for `codex-cli`
- **THEN** the report SHALL preserve the selected date range in its scope metadata

#### Scenario: Tokscale binary is unavailable

- **WHEN** the operator runs token reconciliation and the tokscale executable is not available
- **THEN** the system SHALL compare Felina SQLite aggregates and Felina parser dry-run aggregates
- **THEN** the report SHALL mark the tokscale source status as `missing_binary`
- **THEN** the command SHALL NOT report production refresh success or modify `/tokens` data


<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Normalize token source records

The reconciliation command SHALL normalize each source into comparable token usage records before computing differences. Each normalized record SHALL include source name, agent, provider, model, timestamp bucket, session identifier when available, input tokens, output tokens, cache read tokens, cache write tokens, reasoning tokens, event count, and source metadata.

#### Scenario: Normalize Felina and tokscale records

- **WHEN** Felina SQLite, Felina parser dry-run, and tokscale export produce usage data for the same model and session
- **THEN** the system SHALL transform each source into the same normalized record shape
- **THEN** the diff calculation SHALL compare normalized token fields rather than source-specific raw payloads

##### Example: normalized Codex session comparison

- **GIVEN** Felina parser dry-run reports session `abc`, model `gpt-5`, input `1000`, output `200`, reasoning `50`
- **AND** tokscale export reports session `abc`, model `gpt-5`, input `1000`, output `200`, reasoning `50`
- **WHEN** the records are normalized
- **THEN** the diff for session `abc` SHALL be zero for input, output, and reasoning tokens


<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Report scoped aggregate differences

The reconciliation report SHALL include source-by-source differences by total, agent, model, provider, date bucket, and session identifier when available. The report MUST separate token count differences from cost or pricing differences.

#### Scenario: Codex total exceeds tokscale total

- **WHEN** Felina reports more Codex CLI tokens than tokscale for the same date range
- **THEN** the report SHALL show the Codex CLI total difference
- **THEN** the report SHALL show top mismatching model buckets and session identifiers when available
- **THEN** the report SHALL NOT combine that token count difference with pricing differences

##### Example: agent total mismatch

| Source | Agent | Total Tokens |
| ------ | ----- | ------------ |
| felina_db | codex-cli | 900000 |
| tokscale_export | codex-cli | 300000 |
| felina_db | claude-code | 700000 |

- **WHEN** the report compares these records
- **THEN** the report SHALL identify `codex-cli` as having a `600000` token difference against `tokscale_export`
- **THEN** the report SHALL keep `claude-code` in a separate aggregate row


<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Classify mismatch causes

The reconciliation report SHALL classify known mismatch patterns. The system MUST include classifications for cumulative usage counted as per-turn usage, truncated JSONL scanning, overlapping source directories, missing timestamps, cache token mapping mismatch, reasoning token mapping mismatch, storage duplicate behavior, pricing-only mismatch, and unknown mismatch.

#### Scenario: Cumulative usage appears as per-turn usage

- **WHEN** a source record contains repeated cumulative totals that inflate Felina parser dry-run totals compared with tokscale export
- **THEN** the report SHALL classify the affected rows as `cumulative_as_incremental_candidate`
- **THEN** the report SHALL include the affected agent, model, session identifier when available, and source metadata

#### Scenario: Difference cannot be classified

- **WHEN** a source difference does not match any known classification rule
- **THEN** the report SHALL classify the difference as `unknown`
- **THEN** the report SHALL include enough source metadata for manual investigation


<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Evaluate tokscale source-of-truth readiness

The system SHALL evaluate whether tokscale satisfies the minimum criteria to become a candidate source of truth for a later ingestion migration. The evaluation SHALL check machine-readable output availability, token field coverage, `TokenEvent` mapping coverage, command failure observability, version or schema traceability, and behavior when the tokscale binary is missing.

#### Scenario: Tokscale satisfies readiness criteria

- **WHEN** tokscale returns machine-readable output with fields that map to Felina token event fields
- **THEN** the report SHALL mark tokscale readiness as `ready_for_migration_proposal`
- **THEN** the report SHALL list the supported field mappings and observed tokscale version or schema metadata

#### Scenario: Tokscale lacks required fields

- **WHEN** tokscale output cannot provide one or more required token event fields
- **THEN** the report SHALL mark tokscale readiness as `blocked`
- **THEN** the report SHALL list each missing field and the affected Felina analytics behavior


<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Produce a migration decision report

The system SHALL produce a human-readable migration decision report that records the executed command, selected scope, source statuses, aggregate differences, mismatch classifications, tokscale readiness result, and recommended next step. The recommendation SHALL be one of `keep_felina_parser`, `patch_felina_parser`, `propose_tokscale_backed_ingestion`, or `defer_pending_evidence`.

#### Scenario: Tokscale is ready and Felina mismatch is material

- **WHEN** tokscale readiness is `ready_for_migration_proposal`
- **AND** Felina parser or storage totals differ materially from tokscale for the selected scope
- **THEN** the migration decision report SHALL recommend `propose_tokscale_backed_ingestion`
- **THEN** the report SHALL include the material mismatch evidence that supports the recommendation

#### Scenario: Mismatch points to a narrow parser bug

- **WHEN** the report classifies the material mismatch as a specific Felina parser defect
- **AND** tokscale readiness is not required to explain the discrepancy
- **THEN** the migration decision report SHALL recommend `patch_felina_parser`
- **THEN** the report SHALL name the affected agent and mismatch classification

<!-- @trace
source: investigate-token-usage-source-of-truth
updated: 2026-05-22
code:
  - src-tauri/src/tokens/scan_state.rs
  - docs/token-usage-source-of-truth.md
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/tokens/reconciliation.rs
  - src-tauri/src/paths.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/skills.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/tokens/scanner.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src-tauri/src/tokens/types.rs
  - src-tauri/src/commands/hooks.rs
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/commands/memory.rs
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/rules.rs
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/stats.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src-tauri/src/tokens/aggregator.rs
-->