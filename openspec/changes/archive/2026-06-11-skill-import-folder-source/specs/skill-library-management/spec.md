## MODIFIED Requirements

### Requirement: Import skills from ZIP

The system SHALL provide a backend command (`skill_import_scan_zip`) that reads a ZIP file, extracts its contents to a system temporary directory, and scans it for valid skills. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The backend command SHALL return a list of `ImportCandidate` records, pointing to the temporary paths.

The system SHALL use Tauri's open dialog to let the user choose the input ZIP file. When the user selects a ZIP file, the frontend SHALL call the `skill_import_scan_zip` command and populate the valid skill contents into the right "Staging" pane of the import staging dialog (selecting a ZIP is an explicit import intent; routing through Discovered would require a redundant drag step). Same-name conflicts SHALL be resolved by the staging card's built-in overwrite / rename UI, on the same path as candidates discovered from agent directories. The system SHALL NOT write directly to the canonical `~/.felina/skills/` directory during this scanning phase. The system SHALL NOT load `.felina-sync-meta.json` from the ZIP as part of the candidate; the eventual application of the staged skills SHALL generate clean sync metadata.

The import staging dialog SHALL present two separate browse entry points: "Browse ZIP" (file picker filtered to `.zip`) and "Browse Folder" (native directory picker). A single mixed file-and-directory picker SHALL NOT be used.

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

## ADDED Requirements

### Requirement: Import skills from folder

The system SHALL provide a backend command (`skill_import_scan_dir`) that scans a user-selected directory for valid skills and returns a list of `ImportCandidate` records whose `source_path` points directly at the original on-disk locations. The command SHALL NOT copy the directory contents to a temporary location and SHALL NOT write to the canonical `~/.felina/skills/` directory during scanning.

The scan SHALL apply the following resolution order:

1. If the selected directory itself contains a `SKILL.md` file, the command SHALL return exactly one candidate whose skill name is the selected directory's name.
2. Otherwise, the command SHALL scan only the first-level subdirectories of the selected directory and return one candidate per subdirectory containing a `SKILL.md` file; subdirectories without `SKILL.md` SHALL be skipped. The scan SHALL NOT recurse deeper than the first level.
3. If neither rule yields a candidate, the command SHALL return an empty list, which the frontend SHALL treat as "no skills found" rather than an error.

If the provided path does not exist or is not a directory, the command SHALL return an error string, which the frontend SHALL display in the import staging dialog's existing error area.

Candidates produced from a folder scan SHALL flow through the same staging, conflict resolution, and apply pipeline as ZIP-sourced candidates: they SHALL be placed directly into the right "Staging" pane, and same-name conflicts SHALL be resolved by the staging card's built-in overwrite / rename UI. The system SHALL NOT load `.felina-sync-meta.json` from the source folder as part of the candidate; applying staged skills SHALL generate clean sync metadata.

#### Scenario: User selects a folder that is itself a skill directory
- **WHEN** user clicks "Browse Folder" and selects a directory that directly contains a `SKILL.md`
- **THEN** the system returns exactly one `ImportCandidate` named after the selected directory
- **AND** the candidate appears in the right "Staging" pane

#### Scenario: User selects a folder containing multiple skill directories
- **WHEN** user clicks "Browse Folder" and selects a directory whose first-level subdirectories contain `SKILL.md` files
- **THEN** the system returns one `ImportCandidate` per qualifying subdirectory
- **AND** subdirectories without `SKILL.md` are skipped

##### Example: mixed parent folder
- **GIVEN** a selected folder containing `alpha/SKILL.md`, `beta/SKILL.md`, `notes/readme.txt`, and a loose file `stray.md`
- **WHEN** the user selects this folder via "Browse Folder"
- **THEN** the system returns candidates `alpha` and `beta` only
- **AND** `notes` and `stray.md` are ignored

#### Scenario: Selected folder contains no skills
- **WHEN** user selects a directory where neither the directory itself nor any first-level subdirectory contains a `SKILL.md`
- **THEN** the command returns an empty list
- **AND** the Staging pane is unchanged and no error is shown

#### Scenario: Source folder deleted before apply
- **WHEN** the user stages a folder-sourced candidate and the source directory is deleted before executing the import
- **THEN** the apply step SHALL fail with an explicit error message for that candidate rather than silently skipping it
