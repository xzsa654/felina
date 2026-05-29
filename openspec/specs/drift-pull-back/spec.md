# drift-pull-back Specification

## Purpose

Provides a "Pull" operation that reads a drifted agent target's skill file and overwrites the canonical SKILL.md, enabling users to accept external edits made directly in agent-native directories.

## Requirements

### Requirement: Pull from Drifted Target

#### MODIFIED Scenario: Successful pull from a drifted target

- **GIVEN** a canonical skill with a target whose DriftStatus is Drifted
- **WHEN** the user initiates a Pull operation for that target
- **THEN** the system SHALL first display a diff preview showing line-level differences between canonical and target content
- **AND** wait for the user to confirm or cancel
- **WHEN** the user confirms the pull
- **THEN** the system SHALL read the target-side skill file content
- **AND** overwrite the canonical SKILL.md with the target content
- **AND** update the sidecar's pushed_hash to the semantic hash of the new content
- **AND** update the sidecar's lastSync.at to the current timestamp
- **AND** set the sidecar dirty flag to false


<!-- @trace
source: pull-diff-preview
updated: 2026-05-29
code:
  - src/lib/components/skills/PullConfirmDialog.tsx
  - .knowledge/knowledge-base/architecture.md
  - .session/product-backlog.md
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - .knowledge/knowledge-base/_index.json
  - src/lib/types/skills.ts
  - src/lib/types/index.ts
  - src/lib/tauri/commands.ts
  - .knowledge/knowledge-base/dev-docs.md
  - .knowledge/_catalog.json
  - src-tauri/src/commands/fan_out/mod.rs
  - .knowledge/knowledge-base/platform.md
  - src-tauri/Cargo.toml
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Pull Preview Shows Sibling Changes

The pull preview SHALL include a list of sibling file changes in addition to the SKILL.md body diff. Each sibling change SHALL indicate the file path and its status: added (exists on agent side only), modified (content differs and canonical side unchanged since push), deleted (removed on agent side), or conflict (both sides changed since push).

#### Scenario: Pull preview includes added sibling

- **GIVEN** a sibling file exists in the agent-side skill directory but not in the canonical directory
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as added

#### Scenario: Pull preview includes deleted sibling

- **GIVEN** a sibling file existed at push time but has been deleted from the agent-side directory
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as deleted

#### Scenario: Pull preview detects conflict

- **GIVEN** a sibling file has been modified on both canonical and agent sides since the last push
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as conflict


<!-- @trace
source: sibling-pull-sync
updated: 2026-05-29
code:
  - src/lib/i18n/locales/zh-TW.ts
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skill_library.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/types/skills.ts
  - .knowledge/_catalog.json
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/mod.rs
  - .knowledge/knowledge-base/dev-docs.md
-->

---
### Requirement: Pull Executes Sibling Sync

The pull operation SHALL synchronize sibling files from the agent-side directory to the canonical directory according to their status and user-specified resolutions for conflicts.

#### Scenario: Pull copies added sibling to canonical

- **GIVEN** the pull preview lists a sibling as added
- **WHEN** the user confirms the pull
- **THEN** the sibling file SHALL be copied from agent side to canonical directory

#### Scenario: Pull deletes removed sibling from canonical

- **GIVEN** the pull preview lists a sibling as deleted
- **WHEN** the user confirms the pull
- **THEN** the sibling file SHALL be removed from canonical directory

#### Scenario: Pull resolves conflict per user choice

- **GIVEN** the pull preview lists a sibling as conflict
- **AND** the user selects "use agent version" for that sibling
- **WHEN** the pull executes
- **THEN** the canonical sibling SHALL be overwritten with the agent-side version

#### Scenario: Pull with legacy meta (no sibling hashes)

- **GIVEN** the sync meta's `sibling_hashes` field is `None` (legacy meta, written before sibling hash tracking)
- **WHEN** the user requests a pull preview
- **THEN** `sibling_changes` SHALL be empty
- **AND** pull behavior SHALL be identical to the current SKILL.md-only flow

#### Scenario: Pull with empty sibling hashes (push had no siblings)

- **GIVEN** the sync meta's `sibling_hashes` is `Some({})` (push recorded no siblings)
- **AND** agent-side skill directory contains sibling files
- **WHEN** the user requests a pull preview
- **THEN** all agent-side siblings SHALL be listed as `added` in `sibling_changes`


<!-- @trace
source: sibling-pull-sync
updated: 2026-05-29
code:
  - src/lib/i18n/locales/zh-TW.ts
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/commands/skill_library.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/types/skills.ts
  - .knowledge/_catalog.json
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/tokens.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/mod.rs
  - .knowledge/knowledge-base/dev-docs.md
-->

---
### Requirement: Pull Confirmation

The system SHALL display a confirmation dialog before executing a Pull operation, warning the user that the canonical skill content will be overwritten by the target-side content.

#### Scenario: User confirms pull

- **GIVEN** the Pull confirmation dialog is displayed
- **WHEN** the user confirms the operation
- **THEN** the system SHALL execute the Pull operation

#### Scenario: User cancels pull

- **GIVEN** the Pull confirmation dialog is displayed
- **WHEN** the user cancels the operation
- **THEN** the system SHALL not modify the canonical skill

<!-- @trace
source: drift-pull-back
updated: 2026-05-29
-->


<!-- @trace
source: drift-pull-back
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/skills/TargetEditor.tsx
  - .session/product-backlog.md
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/architecture.md
-->

---
### Requirement: SkillList Drift Indicator

The system SHALL display a visual drift indicator on each SkillList entry that has at least one target in Drifted state, enabling users to identify drifted skills without selecting them individually.

#### Scenario: Skill with drifted target shows indicator

- **GIVEN** a canonical skill has one or more targets with DriftStatus Drifted
- **WHEN** the SkillList is rendered
- **THEN** the entry for that skill SHALL display a warning indicator icon

#### Scenario: Skill with no drifted targets hides indicator

- **GIVEN** a canonical skill has no targets with DriftStatus Drifted
- **WHEN** the SkillList is rendered
- **THEN** the entry for that skill SHALL NOT display a drift indicator icon

<!-- @trace
source: drift-pull-back
updated: 2026-05-29
-->


<!-- @trace
source: drift-pull-back
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/skills/TargetEditor.tsx
  - .session/product-backlog.md
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/architecture.md
-->

---
### Requirement: Pull Button in TargetEditor

The system SHALL display a "Pull" button next to each target row in the TargetEditor when that target's DriftStatus is Drifted. The button SHALL be hidden or disabled when the target is not in Drifted state.

#### Scenario: Drifted target shows Pull button

- **GIVEN** a target with DriftStatus Drifted is displayed in the TargetEditor
- **WHEN** the TargetEditor is rendered
- **THEN** a "Pull" button SHALL be visible and enabled for that target

#### Scenario: Synced target hides Pull button

- **GIVEN** a target with DriftStatus Synced is displayed in the TargetEditor
- **WHEN** the TargetEditor is rendered
- **THEN** no "Pull" button SHALL be displayed for that target

<!-- @trace
source: drift-pull-back
updated: 2026-05-29
-->

<!-- @trace
source: drift-pull-back
updated: 2026-05-29
code:
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/skills/TargetEditor.tsx
  - .session/product-backlog.md
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/architecture.md
-->