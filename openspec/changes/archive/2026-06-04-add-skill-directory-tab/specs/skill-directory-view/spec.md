## ADDED Requirements

### Requirement: Skill directory tree retrieval
The system SHALL provide a Tauri command to recursively retrieve the directory structure of a canonical skill.

#### Scenario: Retrieving valid skill directory
- **WHEN** the frontend requests the directory tree for a valid canonical skill ID
- **THEN** the system SHALL return a hierarchical tree of files and directories, excluding `SKILL.md` and `.felina-sync-meta.json`

##### Example: filtered directory contents
- **GIVEN** a skill directory containing `SKILL.md`, `.felina-sync-meta.json`, `scripts/deploy.sh`, and `README.md`
- **WHEN** the directory tree is requested
- **THEN** the system returns a tree containing `scripts/deploy.sh` and `README.md`

#### Scenario: Retrieving missing skill directory
- **WHEN** the frontend requests the directory tree for a non-existent skill ID
- **THEN** the system SHALL return an error indicating the directory cannot be read

### Requirement: Directory view UI
The skill editor UI SHALL display a read-only view of the skill's directory structure in a dedicated tab.

#### Scenario: Viewing the directory tab
- **WHEN** the user switches to the directory tab in the skill editor
- **THEN** the system SHALL display the file structure returned by the backend using a borderless, padding-driven list view conforming to Felina UI guidelines
