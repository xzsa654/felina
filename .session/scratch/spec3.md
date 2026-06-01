## MODIFIED Requirements

### Requirement: Import skills from ZIP

The system SHALL provide a backend command that reads a ZIP file and extracts canonical skill directories into `~/.felina/skills/`. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The system SHALL NOT write `.felina-sync-meta.json` during import; the existing `read_sync_meta_v2` backfill mechanism SHALL generate sync metadata on first read. The system SHALL use Tauri's open dialog to let the user choose the input ZIP file. When the user selects a ZIP file, the system SHALL extract its valid skill contents and populate them into the left "Discovered" pane of the import staging dialog, rather than immediately executing the import to the canonical directory.

#### Scenario: User imports skills from ZIP
- **WHEN** user clicks the Import button and selects a valid ZIP file
- **THEN** the system extracts the skills and loads them into the import staging dialog
- **AND** does NOT immediately write them to the canonical `~/.felina/skills/` directory

#### Scenario: Import encounters existing skill with same name
- **WHEN** a skill staged for import matches an existing canonical skill
- **THEN** the system SHALL rely on the import staging dialog's inline conflict resolution to determine whether to overwrite or rename

#### Scenario: Import encounters directory without SKILL.md
- **WHEN** a top-level directory in the ZIP does not contain a `SKILL.md` file
- **THEN** the system SHALL skip that directory and continue loading other skills into the dialog

#### Scenario: Import result reporting
- **WHEN** the user executes the final import from the staging dialog
- **THEN** the system SHALL return a summary containing the count of skills imported and the count of directories skipped
