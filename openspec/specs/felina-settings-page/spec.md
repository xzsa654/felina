# felina-settings-page Specification

## Purpose

TBD - created by archiving change 'quick-settings-and-preferences'. Update Purpose after archive.

## Requirements

### Requirement: Felina Settings Page

The app SHALL provide a Felina Settings page at route `/felina-settings`. This page SHALL render within the standard app layout (with Sidebar visible) and SHALL be lazy-loaded. The page SHALL NOT appear in the Sidebar navigation list (`NAV_ITEMS`). The page SHALL display its own in-page title. The page SHALL contain an Agent Paths section, a Custom Project Paths section, a Data Pruning section, and a Skill Library section.

#### Scenario: User navigates to Felina Settings

- **WHEN** the app navigates to `/felina-settings`
- **THEN** the page renders with all four sections: Agent Paths, Custom Project Paths, Data Pruning, and Skill Library


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
### Requirement: Custom Project Paths Listing

The Felina Settings page SHALL display a Custom Project Paths section that lists only the entries from `~/.felina/known-projects.json`. Entries that are only current cwd or only auto-detected from `~/.claude/projects/` SHALL NOT appear in this list. Each entry SHALL display its path and whether the corresponding folder currently exists on the filesystem. This section SHALL be a management surface for user-added project paths, not the complete set of project-scope skill targets.

#### Scenario: Saved entries displayed

- **WHEN** the user opens the Felina Settings page and `~/.felina/known-projects.json` contains paths `C:/proj/alpha` and `D:/proj/beta`
- **THEN** the Custom Project Paths section SHALL display exactly these two entries
- **AND** each entry SHALL show an exists/missing indicator based on whether the folder is present on disk

#### Scenario: Empty saved list

- **WHEN** `~/.felina/known-projects.json` is missing or contains no entries
- **THEN** the Custom Project Paths section SHALL display an empty state message

#### Scenario: Auto-detected projects excluded

- **WHEN** a project path exists only via auto-detection from `~/.claude/projects/` and is NOT in `~/.felina/known-projects.json`
- **THEN** that path SHALL NOT appear in the Custom Project Paths list

---
### Requirement: Custom Project Paths Removal

The Felina Settings page SHALL allow the user to remove a saved entry from the Custom Project Paths list. Before removal, the system SHALL display a confirmation dialog that explicitly states only the Felina saved entry is removed and no folders, agent files, canonical skills, or targets are deleted. Removing an entry SHALL NOT mutate existing `SkillTarget.project` values, invalidate existing targets, or cause a target to be considered missing when its folder still exists on disk. After successful removal, the list SHALL refresh to reflect the change. If removal fails, a non-blocking inline error SHALL be displayed and the entry SHALL remain visible.

#### Scenario: User removes a saved entry

- **WHEN** the user initiates removal of saved entry `C:/proj/alpha` and confirms the action
- **THEN** the entry SHALL be removed from `~/.felina/known-projects.json`
- **AND** the Custom Project Paths list SHALL refresh and no longer show `C:/proj/alpha`
- **AND** the folder `C:/proj/alpha` SHALL NOT be deleted from disk
- **AND** any existing skill targets pointing to `C:/proj/alpha` SHALL remain unchanged

#### Scenario: Removing an existing folder does not invalidate targets

- **GIVEN** `C:/proj/alpha` exists on disk
- **AND** a skill target points to `C:/proj/alpha`
- **WHEN** the user removes `C:/proj/alpha` from the Custom Project Paths list
- **THEN** the target SHALL NOT show a missing-project state solely because the custom path entry was removed
- **AND** push SHALL continue to resolve `C:/proj/alpha` as the target project path

#### Scenario: User cancels removal

- **WHEN** the user initiates removal and then cancels the confirmation dialog
- **THEN** no changes SHALL be made to `~/.felina/known-projects.json`

#### Scenario: Removal fails

- **WHEN** the removal operation fails due to a backend error
- **THEN** the system SHALL display a non-blocking inline error message
- **AND** the entry SHALL remain visible in the list

---
### Requirement: Custom Project Paths Backend Contract

The backend SHALL provide a Tauri command named `known_projects_saved_list` that returns only the entries from `~/.felina/known-projects.json`. The return type SHALL be `Vec<KnownProject>` using the existing serialized shape. Each returned entry SHALL have `sources` containing `saved`. The command SHALL return an empty array when the store file is missing or malformed.

#### Scenario: Store file exists with entries

- **WHEN** `~/.felina/known-projects.json` contains saved paths `C:/proj/alpha` (folder exists) and `D:/proj/gone` (folder missing)
- **THEN** `known_projects_saved_list` SHALL return two entries with `sources` containing `saved`, where `C:/proj/alpha` has `exists: true` and `D:/proj/gone` has `exists: false`

#### Scenario: Store file missing

- **WHEN** `~/.felina/known-projects.json` does not exist
- **THEN** `known_projects_saved_list` SHALL return an empty array

#### Scenario: Store file malformed

- **WHEN** `~/.felina/known-projects.json` contains invalid JSON
- **THEN** `known_projects_saved_list` SHALL return an empty array