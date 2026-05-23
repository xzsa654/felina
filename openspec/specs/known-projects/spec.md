# known-projects Specification

## Purpose

TBD - created by archiving change 'known-projects-and-multi-target'. Update Purpose after archive.

## Requirements

### Requirement: Known Projects Model

The system SHALL provide a known-projects list that unions three sources and exposes each project's origin. The persistent store SHALL be a JSON file at `~/.felina/known-projects.json` with shape `{ projects: [string] }`, holding only explicitly user-added project root paths. At list time the system SHALL merge three sources: the current selected project working directory (source `cwd`), every project hash directory under `~/.claude/projects/` that resolves to an existing path via the Project Path Resolution rule (source `detected`), and every entry in the JSON `projects` array (source `saved`). The merged result SHALL be deduplicated by normalized path (absolute path, forward-slash separators, no trailing slash, case-folded on Windows) and each resulting entry SHALL carry the set of sources that contributed it. A project hash that resolves as unresolved SHALL NOT appear in the list.

#### Scenario: Three sources merge and deduplicate

- **WHEN** the current working directory is `C:/proj/foo`, `~/.claude/projects/` contains a hash resolving to `C:/proj/foo` and another resolving to `C:/proj/bar`, and the JSON file lists `C:/proj/baz`
- **THEN** the list SHALL contain exactly three entries: `C:/proj/foo`, `C:/proj/bar`, and `C:/proj/baz`
- **AND** the entry for `C:/proj/foo` SHALL carry both the `cwd` and `detected` sources
- **AND** the entry for `C:/proj/baz` SHALL carry the `saved` source

#### Scenario: Unresolved hash is excluded

- **WHEN** `~/.claude/projects/` contains a hash directory that the Project Path Resolution rule reports as unresolved
- **THEN** that hash SHALL NOT contribute any entry to the known-projects list

#### Scenario: Missing or malformed store yields cwd and detected only

- **WHEN** `~/.felina/known-projects.json` does not exist, is not valid JSON, or lacks a `projects` key
- **THEN** the system SHALL treat the saved source as empty and SHALL return only `cwd` and `detected` entries without raising an error


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
### Requirement: Known Projects Mutation

The system SHALL allow adding and removing explicit (saved-source) projects, mutating only the JSON store. Adding a project SHALL append its path to the `projects` array unless an entry with the same normalized path already exists, in which case the operation SHALL be a no-op. Removing a project SHALL delete the entry whose normalized path matches the argument and SHALL leave other entries untouched. Add and remove SHALL NOT affect the `cwd` or `detected` sources.

#### Scenario: Adding an existing project is idempotent

- **WHEN** the JSON store already lists `C:/proj/foo` and the system is asked to add `C:/proj/foo/` (trailing slash) or `c:/proj/foo` (different case on Windows)
- **THEN** the store SHALL remain unchanged with a single `C:/proj/foo` entry

#### Scenario: Removing a saved project deletes only that entry

- **WHEN** the JSON store lists `C:/proj/foo` and `C:/proj/bar` and the system is asked to remove `C:/proj/foo`
- **THEN** the store SHALL list only `C:/proj/bar`

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