# sync-info-ui Specification

## Purpose

Defines how the sync info bar presents skill target synchronization statuses at scale, using aggregated summary chips with auto-expansion of actionable states and interactive toggling.

## Requirements

### Requirement: Sync Info Status Grouping

The system SHALL present skill target sync statuses as an aggregated summary in the sync info UI, grouping targets by their synchronization state (Synced, Pending/Not-Synced, Missing/Error). The system SHALL NOT render all individual targets in a flat vertical list by default when multiple targets exist.

#### Scenario: Aggregated summary display

- **GIVEN** a skill with multiple targets
- **WHEN** the user views the skill's sync information
- **THEN** the UI SHALL display a concise row of summary chips representing the counts for each status group

##### Example: Summary chips

- **GIVEN** a skill has 8 targets in Synced state, 1 in Pending state, and 1 in Missing state
- **WHEN** the sync info bar is rendered
- **THEN** the UI displays `[✓ 8 Synced]`, `[— 1 Pending]`, and `[! 1 Missing]` chips


<!-- @trace
source: sync-info-bar-scalability
updated: 2026-05-29
code:
  - .knowledge/knowledge-base/platform.md
  - src/lib/types/token-analytics.ts
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src-tauri/src/tokens/types.rs
  - src/router.tsx
  - .session/scratch/run.js
  - .knowledge/_catalog.json
  - src/lib/components/projects/ManagedInventory.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - .knowledge/knowledge-base/architecture.md
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/skill_fields.rs
  - src-tauri/src/lib.rs
  - src/lib/stores/theme.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/skills/SkillsPage.tsx
  - README.md
  - src/lib/stores/skills-store.ts
  - src/lib/utils/path.ts
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/agent-skill-market-complete.md
  - src/lib/components/instructions/InstructionsPage.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/scratch/proposal.md
  - src/lib/types/index.ts
  - src/lib/types/skills.ts
  - src/lib/components/shared/MarkdownPreview.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/canonical_skills.rs
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/tokens/tokscale.rs
  - package.json
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/memory/MemoryPage.tsx
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/layout/Sidebar.tsx
-->

---
### Requirement: Auto-Expansion of Actionable States

The system SHALL automatically expand and display the detailed list of targets for any state that requires user attention, such as Pending (not-synced) or Missing (project not found). Targets in a healthy (Synced) state SHALL remain collapsed by default to save vertical space.

#### Scenario: Auto-expanding pending items

- **GIVEN** a skill has both Synced and Pending targets
- **WHEN** the sync info bar is rendered
- **THEN** the detailed list of Pending targets SHALL be visible automatically
- **AND** the detailed list of Synced targets SHALL be hidden


<!-- @trace
source: sync-info-bar-scalability
updated: 2026-05-29
code:
  - .knowledge/knowledge-base/platform.md
  - src/lib/types/token-analytics.ts
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src-tauri/src/tokens/types.rs
  - src/router.tsx
  - .session/scratch/run.js
  - .knowledge/_catalog.json
  - src/lib/components/projects/ManagedInventory.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - .knowledge/knowledge-base/architecture.md
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/skill_fields.rs
  - src-tauri/src/lib.rs
  - src/lib/stores/theme.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/skills/SkillsPage.tsx
  - README.md
  - src/lib/stores/skills-store.ts
  - src/lib/utils/path.ts
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/agent-skill-market-complete.md
  - src/lib/components/instructions/InstructionsPage.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/scratch/proposal.md
  - src/lib/types/index.ts
  - src/lib/types/skills.ts
  - src/lib/components/shared/MarkdownPreview.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/canonical_skills.rs
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/tokens/tokscale.rs
  - package.json
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/memory/MemoryPage.tsx
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/layout/Sidebar.tsx
-->

---
### Requirement: Interactive Expansion

The system SHALL allow users to toggle the visibility of the detailed target list for any status group by interacting with its corresponding summary chip.

#### Scenario: Toggling synced details

- **GIVEN** a skill has Synced targets that are currently collapsed
- **WHEN** the user clicks the `Synced` summary chip
- **THEN** the detailed list of Synced targets SHALL become visible
- **AND WHEN** the user clicks the chip again
- **THEN** the detailed list SHALL collapse

<!-- @trace
source: openspec/changes/sync-info-bar-scalability
-->

<!-- @trace
source: sync-info-bar-scalability
updated: 2026-05-29
code:
  - .knowledge/knowledge-base/platform.md
  - src/lib/types/token-analytics.ts
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src-tauri/src/tokens/types.rs
  - src/router.tsx
  - .session/scratch/run.js
  - .knowledge/_catalog.json
  - src/lib/components/projects/ManagedInventory.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - .knowledge/knowledge-base/architecture.md
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/skill_fields.rs
  - src-tauri/src/lib.rs
  - src/lib/stores/theme.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/skills/SkillsPage.tsx
  - README.md
  - src/lib/stores/skills-store.ts
  - src/lib/utils/path.ts
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/agent-skill-market-complete.md
  - src/lib/components/instructions/InstructionsPage.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/scratch/proposal.md
  - src/lib/types/index.ts
  - src/lib/types/skills.ts
  - src/lib/components/shared/MarkdownPreview.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/canonical_skills.rs
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/tokens/tokscale.rs
  - package.json
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/memory/MemoryPage.tsx
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/layout/Sidebar.tsx
-->