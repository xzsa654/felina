# skill-library-management Specification

## Purpose

TBD - created by archiving change 'canonical-skill-export-import'. Update Purpose after archive.

## Requirements

### Requirement: Export all canonical skills as ZIP

The system SHALL provide a backend command that packages all canonical skill directories under `~/.felina/skills/` into a single ZIP file. Each skill SHALL be stored in the ZIP as `<skill-name>/SKILL.md` plus any subdirectories and files within that skill directory. The system SHALL exclude `.felina-sync-meta.json` and the `.git/` directory (snapshot repository) from the ZIP output. The system SHALL use Tauri's save dialog to let the user choose the output file path. The ZIP file SHALL use the default name `felina-skills-backup.zip`. If no canonical skills exist, the system SHALL return an error indicating the library is empty.

#### Scenario: User exports all skills

- **WHEN** user clicks the Export button in the Skill Library section
- **THEN** a save dialog appears for choosing the ZIP file location
- **AND** the system writes a ZIP file containing all canonical skills (excluding `.felina-sync-meta.json` and `.git/`)

#### Scenario: Export with skills containing subdirectories

- **WHEN** a canonical skill directory contains subdirectories (e.g., `schema/`, `scripts/`)
- **THEN** the ZIP SHALL include those subdirectories and all files within them

##### Example: session-handoff skill structure

- **GIVEN** skill `session-handoff` contains `SKILL.md`, `schema/handoff.md`, `scripts/insert_session_entry.py`, `.felina-sync-meta.json`
- **WHEN** user exports
- **THEN** ZIP contains `session-handoff/SKILL.md`, `session-handoff/schema/handoff.md`, `session-handoff/scripts/insert_session_entry.py`
- **AND** ZIP does NOT contain `session-handoff/.felina-sync-meta.json`

#### Scenario: Export with empty library

- **WHEN** user clicks Export and no canonical skills exist under `~/.felina/skills/`
- **THEN** the system SHALL display an error message indicating the library is empty


<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Import skills from ZIP

The system SHALL provide a backend command that reads a ZIP file and extracts canonical skill directories into `~/.felina/skills/`. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The system SHALL NOT write `.felina-sync-meta.json` during import; the existing `read_sync_meta_v2` backfill mechanism SHALL generate sync metadata on first read. The system SHALL use Tauri's open dialog to let the user choose the input ZIP file.

#### Scenario: User imports skills from ZIP

- **WHEN** user clicks the Import button and selects a valid ZIP file
- **THEN** the system extracts each skill directory into `~/.felina/skills/`
- **AND** sync metadata is NOT written during import (backfilled on first read)

#### Scenario: Import encounters existing skill with same name

- **WHEN** the ZIP contains a skill directory whose name matches an existing canonical skill
- **THEN** the system SHALL overwrite the existing skill directory contents with the imported files

#### Scenario: Import encounters directory without SKILL.md

- **WHEN** a top-level directory in the ZIP does not contain a `SKILL.md` file
- **THEN** the system SHALL skip that directory and continue importing other skills

#### Scenario: Import result reporting

- **WHEN** import completes
- **THEN** the system SHALL return a summary containing the count of skills imported and the count of directories skipped


<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Reset skill library

The system SHALL provide a backend command that deletes all canonical skill directories under `~/.felina/skills/`. The `.git/` directory at the root of `~/.felina/skills/` (snapshot repository) SHALL also be deleted during reset. The system SHALL require a confirmation step before executing the reset. The frontend SHALL display a confirmation dialog warning that all skills will be permanently deleted and recommending export before reset.

#### Scenario: User resets the skill library

- **WHEN** user clicks the Reset button
- **THEN** a confirmation dialog appears warning about permanent deletion and recommending export first
- **AND** if user confirms, the system deletes all contents of `~/.felina/skills/` including `.git/`
- **AND** the system returns the count of skills deleted

#### Scenario: User cancels reset

- **WHEN** user clicks Cancel in the confirmation dialog
- **THEN** no changes are made to the skill library


<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Skill Library section in Felina Settings

The Felina Settings page SHALL display a "Skill Library" section. The section SHALL show the current count of canonical skills. The section SHALL provide three action buttons: Export (download icon), Import (upload icon), and Reset (trash icon). The Reset button SHALL use danger styling. All button labels and messages SHALL use i18n keys under the `felinaSettings.skillLibrary` namespace.

#### Scenario: User views the Skill Library section

- **WHEN** user navigates to the Felina Settings page
- **THEN** the Skill Library section is visible with the current skill count and three action buttons

#### Scenario: Skill count updates after import or reset

- **WHEN** user completes an import or reset operation
- **THEN** the displayed skill count SHALL update to reflect the current state

<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->