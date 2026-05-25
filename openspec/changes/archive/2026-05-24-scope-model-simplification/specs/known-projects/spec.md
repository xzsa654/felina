## MODIFIED Requirements

### Requirement: Known Projects Model

`known_projects_list` SHALL continue to return the three-source merge (L1 current cwd, L2 auto-detected from `~/.claude/projects/<hash>`, L3 saved entries from `~/.felina/known-projects.json`) with normalized-path deduplication, source chips, and the `exists` boolean introduced by `cross-project-push-and-coverage`. In addition, the command's contract SHALL explicitly support consumption by the new Projects top-level view: the list is the data source for that view's left column, and entries SHALL be presented in a stable sort order (alphabetical by normalized path) so the left column does not reshuffle between refreshes.

Each `KnownProject` entry SHALL contain enough information for the Projects view to:

- render the path (display) and resolve it (canonical, normalized);
- show source provenance chips (any subset of `cwd`, `detected`, `saved`);
- flag a "project not found" indicator when `exists=false`.

No new fields are added by this change.

#### Scenario: List order is stable for the Projects view

- **GIVEN** Known Projects contains `D:/work/projectB` and `C:/work/projectA` from any combination of L1/L2/L3 sources
- **WHEN** the Projects view requests `known_projects_list`
- **THEN** the returned array orders `C:/work/projectA` before `D:/work/projectB` (alphabetical by normalized path) regardless of source-merge order

#### Scenario: Selected project's `exists` flag drives the missing-folder indicator

- **GIVEN** the Projects view has selected `D:/work/old-project` from the left column AND its `exists=false`
- **WHEN** the view renders
- **THEN** the left column entry shows a "project not found" indicator and the right column displays "找不到該 project 資料夾" with no inventory rows
