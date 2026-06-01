# inline-conflict-resolution Specification

## Purpose

TBD - created by archiving change 'skill-import-dialog-redesign'. Update Purpose after archive.

## Requirements

### Requirement: Inline resolution for staging name conflicts

The system SHALL detect if a skill moved to the staging queue has the same name as an existing canonical skill. When a conflict is detected, the system SHALL NOT block the movement but SHALL immediately display an inline conflict resolution UI on that skill's card in the staging queue, offering "Overwrite" and "Rename" options. The system MUST disable the final "Import" execution button as long as any unresolved conflicts remain in the staging queue.

#### Scenario: Staging a skill with no conflict
- **WHEN** user moves a skill to staging and its name does not match any existing skill
- **THEN** the skill card displays a "Ready" state
- **AND** no conflict UI is shown

#### Scenario: Staging a skill with a name conflict
- **WHEN** user moves a skill to staging and its name matches an existing skill
- **THEN** the skill card displays a conflict warning
- **AND** expands to show "Overwrite" and "Rename" options
- **AND** the final Import button becomes disabled

#### Scenario: User resolves conflict by renaming
- **WHEN** user selects "Rename" on a conflicted skill and provides a new unique name
- **THEN** the conflict warning is cleared
- **AND** the skill is marked as Ready

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