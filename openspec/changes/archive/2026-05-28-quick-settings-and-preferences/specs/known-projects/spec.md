## ADDED Requirements

### Requirement: Saved-Only Known Projects Listing

The backend SHALL provide a Tauri command named `known_projects_saved_list` that reads `~/.felina/known-projects.json` directly and returns only the saved entries as `Vec<KnownProject>`. Each returned entry SHALL have `sources` containing `saved` and `exists` determined by filesystem stat. The command SHALL return an empty array when the store file is missing or malformed, consistent with the tolerant-read behavior of other known-projects commands. The existing `known_projects_list` three-source merge contract SHALL remain unchanged.

#### Scenario: Saved-only list returns only saved entries

- **WHEN** `~/.felina/known-projects.json` contains `C:/proj/alpha` and the auto-detected source also contains `C:/proj/alpha` and `D:/proj/beta`
- **THEN** `known_projects_saved_list` SHALL return only `C:/proj/alpha` (with `sources` containing `saved`)
- **AND** `D:/proj/beta` SHALL NOT appear in the result

#### Scenario: Saved-only list with missing store

- **WHEN** `~/.felina/known-projects.json` does not exist on disk
- **THEN** `known_projects_saved_list` SHALL return an empty array without error

#### Scenario: Existing three-source merge unaffected

- **WHEN** `known_projects_saved_list` is added to the backend
- **THEN** `known_projects_list` SHALL continue to return the merged L1/L2/L3 result with the same contract as before
