# sync-info-ui Specification

## Purpose

Defines how the sync info bar presents skill target synchronization statuses at scale, using aggregated summary chips with auto-expansion of actionable states and interactive toggling.

## Requirements

### Requirement: Sync Info Status Grouping

The system SHALL present skill target sync statuses inline within Target Chips rather than in a separate SyncInfoBar component. In collapsed state, each Target Chip SHALL display a status icon indicating its synchronization state: checkmark (✓) for synced, filled circle (●) for pending/not-synced, exclamation (!) for missing/project-not-found. The system SHALL use semantic theme colors from STATUS_CONFIG to differentiate states. The system SHALL display a single area-level siblingsDirty warning indicator at the beginning of the Target Chips row when any sibling has unsaved changes, rather than repeating the warning on each chip.

#### Scenario: Collapsed chip displays sync status icon

- **WHEN** the Target Chips area is rendered in collapsed state
- **THEN** each chip SHALL display its sync status icon (✓, ●, or !) alongside the existing agent/location/mode label

##### Example: Mixed status chips

- **GIVEN** a skill with targets: claude·global·auto (synced), gemini·project·manual (pending), codex·global·auto (missing project)
- **WHEN** the Target Chips area renders in collapsed state
- **THEN** chips display as: [✓ claude·global·auto] [● gemini·project·manual] [! codex·global·auto]

#### Scenario: siblingsDirty area-level warning

- **GIVEN** a skill where at least one sibling skill has unsaved changes
- **WHEN** the Target Chips area is rendered
- **THEN** a single warning indicator (⚠) SHALL appear at the start of the Target Chips row
- **AND** individual chips SHALL NOT each display their own siblingsDirty warning


<!-- @trace
source: skill-editor-target-sync-redesign
updated: 2026-06-01
code:
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/components/skills/SyncInfoBar.tsx
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/sync-status-utils.ts
  - .session/product-backlog.md
  - tests/loader.mjs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillsPage.tsx
tests:
  - tests/sync-status-utils.test.ts
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

---
### Requirement: Target Detail Popover

The system SHALL display target details in a Popover panel anchored near the clicked Target Chip, instead of inline expansion. The Popover SHALL contain: agent and location labels, a mode selector (dropdown for Auto/Manual/Disabled), last sync timestamp (or "Not synced" in pending color), drift warning (if any), and action buttons (view, open folder, delete) in ghost button style. The Popover interior SHALL use no hard borders, relying on subtle spacing and dividers. Targets with pending or missing states SHALL have their status visually emphasized through semantic theme colors. The Popover SHALL close when the user clicks outside it or presses Escape. Only one Target Popover SHALL be open at a time; opening a new one SHALL close the previous.

#### Scenario: Opening target popover

- **GIVEN** a skill has targets displayed as collapsed chips
- **WHEN** the user clicks a specific Target Chip
- **THEN** a Popover panel SHALL appear anchored near the clicked chip, showing that target's detail fields

#### Scenario: Popover shows sync timestamp

- **WHEN** a Target Popover is open for a synced target
- **THEN** the Popover SHALL display the last sync timestamp

##### Example: Synced target with timestamp

- **GIVEN** a target claude·global·auto with lastSync.at = "2026-06-01T10:30:00Z"
- **WHEN** the user clicks its chip to open the Popover
- **THEN** the Popover displays "Synced 10:30" in the status field

##### Example: Pending target without timestamp

- **GIVEN** a target gemini·project·manual with no lastSync entry
- **WHEN** the user clicks its chip to open the Popover
- **THEN** the Popover displays "Not synced" in pending color in the status field

#### Scenario: Closing popover

- **GIVEN** a Target Popover is open
- **WHEN** the user clicks outside the Popover or presses Escape
- **THEN** the Popover SHALL close

#### Scenario: Only one popover at a time

- **GIVEN** a Target Popover is open for target A
- **WHEN** the user clicks the chip for target B
- **THEN** target A's Popover SHALL close and target B's Popover SHALL open


<!-- @trace
source: skill-editor-target-sync-redesign
updated: 2026-06-01
code:
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/components/skills/SyncInfoBar.tsx
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/sync-status-utils.ts
  - .session/product-backlog.md
  - tests/loader.mjs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillsPage.tsx
tests:
  - tests/sync-status-utils.test.ts
-->

---
### Requirement: SyncInfoBar Removal

The independent SyncInfoBar component SHALL be removed from SkillsPage rendering. All sync status information SHALL be accessible exclusively through the Target Chips area (status icons in collapsed state, detail fields in Popover).

#### Scenario: SyncInfoBar removal

- **WHEN** the SkillsPage renders a selected skill
- **THEN** no independent SyncInfoBar component SHALL be rendered
- **AND** all sync status information SHALL be accessible exclusively through the Target Chips area

<!-- @trace
source: skill-editor-target-sync-redesign
updated: 2026-06-01
code:
  - src/lib/components/skills/TargetPopover.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/components/skills/SyncInfoBar.tsx
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/sync-status-utils.ts
  - .session/product-backlog.md
  - tests/loader.mjs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillsPage.tsx
tests:
  - tests/sync-status-utils.test.ts
-->