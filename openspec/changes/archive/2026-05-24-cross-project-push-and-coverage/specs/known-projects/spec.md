## ADDED Requirements

### Requirement: Manual Project Path Entry

The AddTargetDialog SHALL provide a "Browse..." button adjacent to the project dropdown. When clicked, the button SHALL open a native OS folder selection dialog via Tauri's dialog plugin. When a folder is selected, the system SHALL call `known_projects_add` with the selected path to persist it as an L3 (explicit/saved) entry, then refresh the project dropdown so the newly added path appears and is automatically selected. If the user cancels the folder dialog, no action SHALL be taken.

#### Scenario: Browse and add a new project path

- **GIVEN** the AddTargetDialog is open with scope set to "project"
- **WHEN** the user clicks "Browse...", selects folder `D:/work/other-project`, and confirms
- **THEN** the path `D:/work/other-project` is written to `~/.felina/known-projects.json` projects array, the project dropdown refreshes to include `D:/work/other-project`, and `D:/work/other-project` is auto-selected

#### Scenario: Browse dialog cancelled

- **GIVEN** the AddTargetDialog is open with scope set to "project"
- **WHEN** the user clicks "Browse..." and cancels the OS folder dialog
- **THEN** no path is added, the dropdown selection remains unchanged
