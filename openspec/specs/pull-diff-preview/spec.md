# pull-diff-preview Specification

## Purpose

TBD - created by archiving change 'pull-diff-preview'. Update Purpose after archive.

## Requirements

### Requirement: Pull Diff Preview

The system SHALL provide a diff preview before executing a pull operation, showing the line-level differences between the canonical skill content and the target-side content.

#### Scenario: Preview with base snapshot available

- **GIVEN** a canonical skill with a target whose `base_snapshot` contains a valid commit hash
- **WHEN** the user initiates a pull preview for that target
- **THEN** the system SHALL retrieve the base content from the snapshot, the current canonical body, and the target body
- **AND** return structured diff hunks showing added, deleted, and context lines
- **AND** set `has_base` to true in the preview response

#### Scenario: Preview without base snapshot (two-way fallback)

- **GIVEN** a canonical skill with a target whose `base_snapshot` is null
- **WHEN** the user initiates a pull preview for that target
- **THEN** the system SHALL compare the current canonical body directly against the target body
- **AND** return structured diff hunks for the two-way comparison
- **AND** set `has_base` to false in the preview response

#### Scenario: Preview when target file is missing

- **GIVEN** a canonical skill with a target whose file does not exist on disk
- **WHEN** the user initiates a pull preview for that target
- **THEN** the system SHALL return an error indicating the target file path is missing


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
### Requirement: Pull Confirmation with Diff Display

The system SHALL display the diff preview to the user in an inline unified format before executing the pull operation. The user SHALL explicitly confirm or cancel after reviewing the diff.

#### Scenario: User confirms pull after reviewing diff

- **GIVEN** the pull diff preview is displayed in the confirmation dialog
- **WHEN** the user clicks the confirm button
- **THEN** the system SHALL execute the pull operation (overwriting canonical with target content)

#### Scenario: User cancels pull after reviewing diff

- **GIVEN** the pull diff preview is displayed in the confirmation dialog
- **WHEN** the user clicks the cancel button
- **THEN** the system SHALL NOT modify the canonical SKILL.md
- **AND** the dialog SHALL close

#### Scenario: Diff shows no changes

- **GIVEN** the canonical body and target body are identical
- **WHEN** the pull diff preview is displayed
- **THEN** the system SHALL show a message indicating the content is identical
- **AND** the confirm button SHALL still be available (user may want to update metadata)

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