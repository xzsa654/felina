# coverage-matrix Specification

## Purpose

TBD - created by archiving change 'cross-project-push-and-coverage'. Update Purpose after archive.

## Requirements

### Requirement: Coverage Matrix View

The Skills page SHALL provide a Summary view-mode alongside the existing List view-mode, toggled via a view-mode control in the page header. When Summary mode is active, the page SHALL render a skill × target grid where each row represents a canonical skill and each column represents a unique target combination (agent × scope × project). Each cell SHALL display the sync state of that skill-target pair using the following icons:

- `✓` — synced: a `lastSync` entry exists for this target and the skill is not dirty
- `●` — dirty: a `lastSync` entry exists but the skill is dirty
- `—` — not synced: the target exists in the skill's target list but no `lastSync` entry is present
- `○` — disabled: the target exists but `enabled` is false
- empty — the skill has no target matching this column

Column headers SHALL display the agent name and scope label. For project-scope targets, the column header SHALL show the last path segment as a short project name. Rows SHALL be sorted alphabetically by skill name.

When no skills exist, the Summary view SHALL display an empty state message.

#### Scenario: Toggle between List and Summary

- **GIVEN** the Skills page is showing List mode with 3 canonical skills
- **WHEN** the user clicks the Summary toggle
- **THEN** the page renders a grid with 3 rows (one per skill) and columns for each unique target across all skills

#### Scenario: Cell reflects sync state

- **GIVEN** skill "my-skill" has a target `anthropic:global` with a `lastSync` entry and `dirty` is false
- **WHEN** the Coverage Matrix renders
- **THEN** the cell at row "my-skill", column "anthropic / global" displays `✓`

#### Scenario: Empty skills list

- **GIVEN** no canonical skills exist in the current scope
- **WHEN** Summary mode is active
- **THEN** the grid area displays "No skills to display"

<!-- @trace
source: cross-project-push-and-coverage
updated: 2026-05-24
code:
  - src/lib/utils/path.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/types/skills.ts
  - package.json
  - src-tauri/gen/schemas/desktop-schema.json
  - src-tauri/gen/schemas/capabilities.json
  - src-tauri/src/commands/known_projects.rs
  - src-tauri/src/lib.rs
  - src-tauri/gen/schemas/acl-manifests.json
  - .session/product-backlog.md
  - src-tauri/gen/schemas/windows-schema.json
-->

---
### Requirement: CoverageMatrix Drifted State

The CoverageMatrix SHALL display a `drifted` state for cells where the drift scan reports that the agent-side file has been modified externally since the last push. The `drifted` state SHALL be visually distinct from `synced`, `dirty`, `not-synced`, `disabled`, and `no-target` states. The `drifted` indicator SHALL use a semantic warning color.

#### Scenario: Cell shows drifted when scan reports drift

- **WHEN** the drift scan result contains `drifted` status for a skill's target
- **AND** the target is enabled and tracked
- **THEN** the CoverageMatrix cell for that skill-target pair SHALL display the `drifted` indicator

#### Scenario: Drifted state is visually distinct

- **WHEN** a CoverageMatrix cell is in `drifted` state
- **THEN** the cell SHALL use a warning-class semantic color distinct from synced (success), dirty (info), and not-synced (muted)


<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->

---
### Requirement: TargetEditor Drift Indicator

The TargetEditor SHALL display a per-target drift status indicator when the drift scan reports that a target's agent-side file has drifted. The indicator SHALL be visible in the target row without requiring the user to expand or hover.

#### Scenario: Target row shows drift badge

- **WHEN** the drift scan result contains `drifted` status for a specific target
- **THEN** the TargetEditor row for that target SHALL display a drift indicator badge
- **AND** the badge SHALL use a semantic warning color

<!-- @trace
source: drift-detection-and-conflict-ui
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/dev-docs.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/agent-skill-market-complete.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillImportWizard.tsx
-->