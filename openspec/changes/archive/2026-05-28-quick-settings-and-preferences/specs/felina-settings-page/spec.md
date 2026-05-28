## ADDED Requirements

### Requirement: Felina Settings Page

The app SHALL provide a Felina Settings page at route `/felina-settings`. This page SHALL render within the standard app layout (with Sidebar visible) and SHALL be lazy-loaded. The page SHALL NOT appear in the Sidebar navigation list (`NAV_ITEMS`). The page SHALL display its own in-page title. The page SHALL contain an Agent Paths section and a Saved Known Projects section.

#### Scenario: User navigates to Felina Settings

- **WHEN** the app navigates to `/felina-settings`
- **THEN** the Felina Settings page SHALL render within the app layout
- **AND** the page SHALL display an in-page title
- **AND** the Sidebar SHALL remain visible but SHALL NOT highlight any nav item as active

#### Scenario: Felina Settings not in sidebar navigation

- **WHEN** an inspector reads the `NAV_ITEMS` array
- **THEN** `felina-settings` SHALL NOT appear as an entry

### Requirement: Saved Known Projects Listing

The Felina Settings page SHALL display a Saved Known Projects section that lists only the entries from `~/.felina/known-projects.json`. Entries that are only current cwd or only auto-detected from `~/.claude/projects/` SHALL NOT appear in this list. Each entry SHALL display its path and whether the corresponding folder currently exists on the filesystem.

#### Scenario: Saved entries displayed

- **WHEN** the user opens the Felina Settings page and `~/.felina/known-projects.json` contains paths `C:/proj/alpha` and `D:/proj/beta`
- **THEN** the Saved Known Projects section SHALL display exactly these two entries
- **AND** each entry SHALL show an exists/missing indicator based on whether the folder is present on disk

#### Scenario: Empty saved list

- **WHEN** `~/.felina/known-projects.json` is missing or contains no entries
- **THEN** the Saved Known Projects section SHALL display an empty state message

#### Scenario: Auto-detected projects excluded

- **WHEN** a project path exists only via auto-detection from `~/.claude/projects/` and is NOT in `~/.felina/known-projects.json`
- **THEN** that path SHALL NOT appear in the Saved Known Projects list

### Requirement: Saved Known Projects Removal

The Felina Settings page SHALL allow the user to remove a saved entry from the list. Before removal, the system SHALL display a confirmation dialog that explicitly states only the Felina saved entry is removed and no folders, agent files, canonical skills, or targets are deleted. After successful removal, the list SHALL refresh to reflect the change. If removal fails, a non-blocking inline error SHALL be displayed and the entry SHALL remain visible.

#### Scenario: User removes a saved entry

- **WHEN** the user initiates removal of saved entry `C:/proj/alpha` and confirms the action
- **THEN** the entry SHALL be removed from `~/.felina/known-projects.json`
- **AND** the Saved Known Projects list SHALL refresh and no longer show `C:/proj/alpha`
- **AND** the folder `C:/proj/alpha` SHALL NOT be deleted from disk

#### Scenario: User cancels removal

- **WHEN** the user initiates removal and then cancels the confirmation dialog
- **THEN** no changes SHALL be made to `~/.felina/known-projects.json`

#### Scenario: Removal fails

- **WHEN** the removal operation fails due to a backend error
- **THEN** the system SHALL display a non-blocking inline error message
- **AND** the entry SHALL remain visible in the list

### Requirement: Saved Known Projects Backend Contract

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
