## MODIFIED Requirements

### Requirement: Import skills from ZIP

The system SHALL provide a backend command (`skill_import_scan_zip`) that reads a ZIP file, extracts its contents to a system temporary directory, and scans it for valid skills. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The backend command SHALL return a list of `ImportCandidate` records, pointing to the temporary paths.

The system SHALL use Tauri's open dialog to let the user choose the input ZIP file. When the user selects a ZIP file, the frontend SHALL call the `skill_import_scan_zip` command and populate the valid skill contents into the right "Staging" pane of the import staging dialog (selecting a ZIP is an explicit import intent; routing through Discovered would require a redundant drag step). Same-name conflicts SHALL be resolved by the staging card's built-in overwrite / rename UI, on the same path as candidates discovered from agent directories. The system SHALL NOT write directly to the canonical `~/.felina/skills/` directory during this scanning phase. The system SHALL NOT load `.felina-sync-meta.json` from the ZIP as part of the candidate; the eventual application of the staged skills SHALL generate clean sync metadata.

#### Scenario: User imports skills from ZIP
- **WHEN** user clicks the Import button and selects a valid ZIP file
- **THEN** the system extracts the skills to a temporary directory and loads them into the right "Staging" pane of the import staging dialog
- **AND** does NOT write them to the canonical `~/.felina/skills/` directory

#### Scenario: Import encounters existing skill with same name
- **WHEN** a skill staged for import matches an existing canonical skill
- **THEN** the system SHALL rely on the import staging dialog's inline conflict resolution to determine whether to overwrite or rename

#### Scenario: Import encounters directory without SKILL.md
- **WHEN** a top-level directory in the ZIP does not contain a `SKILL.md` file
- **THEN** the system SHALL skip that directory and continue loading other skills into the dialog

##### Example: ZIP with invalid directories
- **GIVEN** a ZIP containing `/valid-skill/SKILL.md`, `/empty-dir/`, and `/no-skill-md/some-file.txt`
- **WHEN** the user selects this ZIP for import
- **THEN** the system returns only `valid-skill` as an `ImportCandidate`
- **AND** `empty-dir` and `no-skill-md` are skipped

#### Scenario: Import result reporting
- **WHEN** the user executes the final import from the staging dialog
- **THEN** the system SHALL apply the selected skills to the canonical directory
- **AND** the Discovered pane SHALL update accurately to reflect imported and skipped skills
