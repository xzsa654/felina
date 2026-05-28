# known-projects Specification

## Purpose

TBD - created by archiving change 'known-projects-and-multi-target'. Update Purpose after archive.

## Requirements

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


<!-- @trace
source: scope-model-simplification
updated: 2026-05-24
code:
  - src/lib/components/layout/Header.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src-tauri/Cargo.toml
  - src/lib/components/projects/ProjectsPage.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/types/skills.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/paths.rs
  - src/lib/components/settings/AgentPathsSection.tsx
  - .session/product-backlog.md
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/agent-capability-research.md
  - src/lib/components/skills/SkillList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/stores/navigation.ts
  - src/lib/stores/skills-store.ts
  - src/lib/tauri/commands.ts
  - src/router.tsx
-->

---
### Requirement: Known Projects Mutation

The system SHALL allow adding and removing explicit (saved-source) projects, mutating only the JSON store. Adding a project SHALL append its path to the `projects` array unless an entry with the same normalized path already exists, in which case the operation SHALL be a no-op. Removing a project SHALL delete the entry whose normalized path matches the argument and SHALL leave other entries untouched. Add and remove SHALL NOT affect the `cwd` or `detected` sources, existing `SkillTarget` rows, or fan-out routing for targets that already store the project path.

#### Scenario: Adding an existing project is idempotent

- **WHEN** the JSON store already lists `C:/proj/foo` and the system is asked to add `C:/proj/foo/` (trailing slash) or `c:/proj/foo` (different case on Windows)
- **THEN** the store SHALL remain unchanged with a single `C:/proj/foo` entry

#### Scenario: Removing a saved project deletes only that entry

- **WHEN** the JSON store lists `C:/proj/foo` and `C:/proj/bar` and the system is asked to remove `C:/proj/foo`
- **THEN** the store SHALL list only `C:/proj/bar`
- **AND** existing skill targets pointing to `C:/proj/foo` SHALL remain unchanged

<!-- @trace
source: known-projects-and-multi-target
updated: 2026-05-23
code:
  - src/lib/components/skills/SkillList.tsx
  - src/lib/stores/skills-store.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/mod.rs
  - .session/product-backlog.md
  - src/lib/types/skills.ts
  - src/lib/components/skills/AddTargetDialog.tsx
-->

---
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

<!-- @trace
source: cross-project-push-and-coverage
updated: 2026-05-24
code:
  - src/lib/utils/path.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/types/skills.ts
  - package.json
  - src-tauri/gen/schemas/desktop-schema.json
  - src-tauri/gen/schemas/capabilities.json
  - src-tauri/src/commands/known_projects.rs
  - src-tauri/src/lib.rs
  - src-tauri/gen/schemas/acl-manifests.json
  - .session/product-backlog.md
  - src-tauri/gen/schemas/windows-schema.json
-->

---
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
