# skill-import-split-view Specification

## Purpose

TBD - created by archiving change 'skill-import-dialog-redesign'. Update Purpose after archive.

## Requirements

### Requirement: Split view staging area for imported skills

The system SHALL provide a two-pane (split view) dialog for importing skills. The left pane SHALL display skills discovered or selected for import. The right pane SHALL display the staging queue of skills designated for actual import.

#### Scenario: User opens import dialog
- **WHEN** user initiates a skill import action
- **THEN** the system displays the two-pane import staging dialog

#### Scenario: User drags skill from discovered to staging
- **WHEN** user drags a skill card from the left pane and drops it into the right pane
- **THEN** the skill is added to the staging queue

#### Scenario: User double-clicks skill to move between panes
- **WHEN** user double-clicks a skill card in either pane
- **THEN** the system moves the skill to the opposite pane

<!-- @trace
source: skill-import-dialog-redesign
updated: 2026-06-01
code:
  - .session/projects-page-ui-adjustment-report.md
  - src-tauri/tauri.conf.json
  - .session/archive/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/import/staging-logic.ts
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/i18n/locales/en.ts
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/assets/logo.png
  - src/lib/assets/logo_.png
  - src/lib/components/projects/ProjectsPage.tsx
tests:
  - tests/staging-logic.test.ts
-->