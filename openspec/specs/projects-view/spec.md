# projects-view Specification

## Purpose

TBD - created by archiving change 'scope-model-simplification'. Update Purpose after archive.

## Requirements

### Requirement: Projects Top-Level View

The application SHALL provide a top-level Projects view, registered as a sibling page to Skills (see `app-pages` capability). The view is read-only with respect to canonical master files and target rows; its purpose is to surface the management state of each Known Project's skills, not to edit master files or target configurations.

The view SHALL render a two-column layout:

- **Left column**: a list of Known Projects sourced from `known_projects_list`, including L1/L2/L3 sources and the `exists` flag.
- **Right column**: the "managed inventory" of the currently selected project (Managed Inventory View requirement below).

Selection state SHALL default to the L1 (current cwd) project when present. When no L1 exists, the default selection SHALL be the first entry in the sorted list. When the Known Projects list is empty, the view SHALL display an empty state inviting the user to add a project via Browse or to manage global skills via the Skills view.

A left-column entry with `exists=false` SHALL display a "project not found" indicator (matching the visual treatment used by `multi-agent-skills` Origin-Project Degradation). Selecting such an entry SHALL still render the left-column entry as selected, but the right column SHALL show an empty inventory with a "找不到該 project 資料夾" message.

#### Scenario: Default selection picks the current cwd project

- **GIVEN** Known Projects returns `[{path:"C:/proj/A", sources:[cwd,saved]}, {path:"D:/proj/B", sources:[saved]}]`
- **WHEN** the user opens the Projects view for the first time in a session
- **THEN** `C:/proj/A` is the selected entry in the left column

#### Scenario: Selecting a missing project shows the empty inventory message

- **GIVEN** the user selects an entry whose `exists=false`
- **WHEN** the right column renders
- **THEN** the inventory area shows the "找不到該 project 資料夾" message and no skill rows


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
### Requirement: Managed Inventory View

The Projects view's right column SHALL render a managed inventory list for the selected project. Each row SHALL represent a unique skill name in the union of:

- agent-directory scan results under the selected project,
- global canonical master files whose targets include an entry with `scope=project` and `project=<selected project path>`,
- global canonical master files whose canonical directory identity matches a skill name found by the selected project's agent-directory scan.

No broad replacement backend command SHALL be introduced for this view. The row union, detected-source grouping, and per-target summary SHALL be computed in the frontend from existing commands.

Each row SHALL render two independent axes of state:

- `Detected sources`: the agent-native sources found by scanning the selected project's configured agent directories. This axis MUST NOT include canonical targets.
- `Felina targets`: relevant targets from a same-named canonical master. This axis SHALL include only global targets and project targets whose normalized project path equals the selected project path. It MUST NOT include targets for other projects.

The row SHALL be treated as Managed only when a same-named canonical master has an enabled project target for the selected project and that target is not detached or forked. A global target SHALL NOT mark the selected project as Managed.

For detected-source calculation, a project-local agent directory containing `SKILL.md` SHALL mark that agent as present for the selected project. When multiple agents resolve to the same physical source path, the row SHALL preserve each agent attribution while displaying the physical source as one grouped source.

The row SHALL provide these actions:

- when the row is local-only and no same-named canonical master exists, an "Import to Felina" action SHALL invoke the existing import flow;
- when the row is managed by a selected-project target, clicking the row SHALL navigate to the Skills view with that canonical skill selected;
- when a same-named canonical master exists but lacks a selected-project target, the primary action SHALL be a single "選擇處理方式…" entry that opens the Same-Name Resolution Dialog (see Same-Name Resolution Dialog requirement);
- the row SHALL NOT display separate Link or Overwrite buttons for same-name canonical rows; all resolution paths SHALL be reachable through the Same-Name Resolution Dialog.

The Projects view SHALL NOT provide in-place target editing beyond what the Same-Name Resolution Dialog offers, and SHALL NOT delete project-local files outside the Discard path defined in Project-Local Skill Discard.

Inventory rows SHALL be ordered by task priority: Managed rows first, then rows that need same-name canonical resolution, then local-only importable rows, then unresolved multi-source rows. Rows within each group SHALL sort alphabetically by skill name.

#### Scenario: Local source and Felina target axes are separate

- **WHEN** the selected project contains `<projectA>/.claude/skills/foo/SKILL.md`
- **AND** `~/.felina/skills/foo` has a global Codex target
- **THEN** the row SHALL show Claude under Detected sources
- **AND** the row SHALL show Codex global under Felina targets
- **AND** the row SHALL NOT mark `foo` as Managed for `projectA`

#### Scenario: Other project target is excluded

- **WHEN** `~/.felina/skills/foo` has a project target for `D:/work/projectB`
- **AND** the selected project is `C:/work/projectA`
- **THEN** the row for `foo` in `projectA` SHALL NOT show the `projectB` target under Felina targets
- **AND** the row SHALL NOT be Managed because of the `projectB` target

#### Scenario: Selected project target makes row Managed

- **WHEN** `~/.felina/skills/foo` has an enabled project target for `C:/work/projectA`
- **AND** the selected project is `C:/work/projectA`
- **THEN** the row for `foo` SHALL appear in the Managed group
- **AND** clicking the row SHALL navigate to the Skills view with `foo` selected

#### Scenario: Same-name canonical row uses single dialog entry

- **WHEN** a discovered skill row has a same-named canonical master without a selected-project target
- **THEN** the row SHALL display a single "選擇處理方式…" primary action
- **AND** the row SHALL NOT display separate Link or Overwrite buttons

#### Scenario: Inventory row ordering

- **WHEN** the selected project yields rows `zed` as Managed, `global-match` as same-name canonical resolution, `alpha` as local-only importable, and `multi` as unresolved multi-source
- **THEN** the row order SHALL be `zed`, `global-match`, `alpha`, `multi`


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Multi-Source Inline Source Selection

The ManagedInventory component SHALL display multi-source import choices using a physical-source-first inline drawer. When multiple candidates share the same normalized `sourcePath`, the drawer SHALL render one source card for that physical file and SHALL present the available agent attributions within that card.

When the user selects an attribution, the system SHALL keep using the existing `selectSource` import resolution. The selected attribution SHALL determine the candidate source index sent to `skill_import_apply`, the imported project target's `agent`, and any agent-specific import side effects.

When candidates use different physical source paths, the drawer SHALL render one source card per physical source path.

#### Scenario: Shared `.agents/skills` source renders as one card

- **WHEN** Codex and Gemini candidates for `foo` both point to `<project>/.agents/skills/foo/SKILL.md`
- **THEN** the drawer SHALL render one shared source card for that path
- **AND** the card SHALL offer Codex and Gemini attribution choices

#### Scenario: Attribution selection maps to selectSource

- **WHEN** the user selects Gemini attribution for a shared source card
- **THEN** the import selection SHALL use `resolution.kind = "selectSource"` with the source index of the Gemini candidate
- **AND** the imported target SHALL be attributed to Gemini

#### Scenario: Distinct physical sources remain separate

- **WHEN** Anthropic and Codex candidates for `foo` point to different physical paths
- **THEN** the drawer SHALL render separate source cards for those paths


<!-- @trace
source: projects-import-existing-canonical-link
updated: 2026-06-02
code:
  - .session/scratch/temp_proposal.md
  - src/lib/assets/logo.png
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/tauri.conf.json
  - tests/loader.mjs
  - .session/scratch/temp_design.md
  - src/lib/assets/logo_.png
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillsPage.tsx
  - .session/scratch/spec1.md
  - src/lib/i18n/locales/en.ts
  - .session/scratch/spec3.md
  - .session/scratch/temp_tasks.md
  - src/lib/components/skills/import/staging-logic.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/index.ts
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - .session/scratch/spec2.md
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/mod.rs
tests:
  - tests/managed-inventory.test.ts
  - tests/skill-import-conflict-warning.test.ts
  - tests/staging-logic.test.ts
-->

---
### Requirement: Import Button Label Accuracy

The ManagedInventory import button label SHALL read "Import to Felina" (en) / "匯入至 Felina" (zh-TW) instead of "Import to global" / "匯入至 Global". The label SHALL accurately reflect that the import destination is the Felina canonical skill store, not a specific agent's global directory.

#### Scenario: Button label in English locale

- **WHEN** the locale is English and a single-source importable skill is displayed
- **THEN** the import button label SHALL read "Import to Felina"

#### Scenario: Button label in Traditional Chinese locale

- **WHEN** the locale is zh-TW and a single-source importable skill is displayed
- **THEN** the import button label SHALL read "匯入至 Felina"

<!-- @trace
source: resolve-multi-source-skill-import
updated: 2026-05-28
code:
  - .knowledge/knowledge-base/architecture.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/i18n/locales/en.ts
  - .knowledge/_catalog.json
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/i18n/locales/zh-TW.ts
-->

---
### Requirement: Discovered Skill Link Confirmation

When a discovered skill has a same-named canonical master but no selected-project target, the system SHALL require an explicit Link to Project confirmation before appending a project target. The Link path SHALL be initiated from the Same-Name Resolution Dialog (see Same-Name Resolution Dialog requirement). The confirmation SHALL show canonical/local difference information using line-level hunks derived from the existing `ConflictInfo` metadata.

The Link to Project action SHALL append a project-scope target to the existing canonical master's target list, associating the current project with that skill without overwriting canonical content. Duplicate targets with the same agent and normalized project path SHALL NOT be appended.

When the row is multi-source (deferred), the Link path SHALL first open the existing multi-source drawer so the user picks an attribution before the Link confirmation appears. The picked source index SHALL be carried into the Link confirmation and used when the target is appended.

#### Scenario: Link confirmation is shown before target append

- **WHEN** the user picks Link inside the Same-Name Resolution Dialog
- **THEN** the system SHALL show a confirmation panel containing canonical/local line-level diff
- **AND** the system SHALL NOT call `skill_targets_set` until the user confirms

#### Scenario: Link to Project adds a selected-project target

- **WHEN** the user confirms Link to Project
- **THEN** the system SHALL append a project-scope target with `enabled=true` and `mode=manual` to the canonical master's targets
- **AND** the system SHALL call `skill_targets_set` with the updated target list
- **AND** after refresh, the row SHALL appear as Managed

#### Scenario: Duplicate target prevention

- **WHEN** the canonical master already has a target with the same agent and normalized selected project path
- **THEN** Link to Project SHALL NOT append a second equivalent target
- **AND** the system SHALL refresh the inventory

#### Scenario: Multi-source Link goes through drawer first

- **WHEN** the user picks Link inside the Same-Name Resolution Dialog on a deferred row
- **THEN** the multi-source drawer SHALL appear so the user picks one attribution
- **AND** only after the attribution is picked SHALL the Link confirmation appear


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Projects Inventory Presentation Style

The Projects inventory SHALL follow the Felina UI guidelines. The right panel SHALL use a borderless list view with row-integrated status chips and inline drawers. It SHALL NOT use a traditional HTML table, hard grid lines, or a standalone warning/info bar to explain normal row state.

Detected sources, Felina targets, relationship status, and primary action SHALL be visible within each row or its inline drawer. Text and controls SHALL remain non-overlapping at narrow and wide panel widths.

#### Scenario: Inventory uses row-integrated status

- **WHEN** a row is local-only, managed, global duplicate, or needs link
- **THEN** that state SHALL be represented by a compact row badge or chip
- **AND** the page SHALL NOT render a separate warning/info bar solely to explain that normal state

#### Scenario: Inventory avoids table presentation

- **WHEN** the Projects inventory renders rows
- **THEN** the implementation SHALL use list-style row markup and spacing
- **AND** it SHALL NOT render the inventory as a traditional `<table>`

<!-- @trace
source: projects-import-existing-canonical-link
updated: 2026-06-02
-->

<!-- @trace
source: projects-import-existing-canonical-link
updated: 2026-06-02
code:
  - .session/scratch/temp_proposal.md
  - src/lib/assets/logo.png
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/tauri.conf.json
  - tests/loader.mjs
  - .session/scratch/temp_design.md
  - src/lib/assets/logo_.png
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillsPage.tsx
  - .session/scratch/spec1.md
  - src/lib/i18n/locales/en.ts
  - .session/scratch/spec3.md
  - .session/scratch/temp_tasks.md
  - src/lib/components/skills/import/staging-logic.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/types/index.ts
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - .session/scratch/spec2.md
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/mod.rs
tests:
  - tests/managed-inventory.test.ts
  - tests/skill-import-conflict-warning.test.ts
  - tests/staging-logic.test.ts
-->

---
### Requirement: Same-Name Resolution Dialog

When a discovered skill row has a same-named canonical master but no selected-project target, clicking the row's "選擇處理方式…" action SHALL open a Same-Name Resolution Dialog. The dialog SHALL list the available resolution paths as separate options, with options determined by the row's relationship:

- When the row is `canonicalGlobalOnly` (the canonical master has at least one enabled global target whose agent's user-level skill directory exists as a runtime fallback), the dialog SHALL offer Link, Overwrite, Rename, and Discard.
- When the row is `canonicalExistsUnlinked` (the canonical master has no enabled global target), the dialog SHALL offer Link, Overwrite, and Rename. The dialog SHALL NOT offer Discard, because no global runtime fallback exists and discarding the project-local copy would leave the project without this skill.

The dialog SHALL be the only entry point to Rename and Discard from the Projects inventory. The dialog SHALL NOT execute any path on open; each path SHALL require its own confirmation step.

#### Scenario: canonicalGlobalOnly row shows four options

- **GIVEN** a row whose canonical master has an enabled global target for at least one agent
- **WHEN** the user opens the Same-Name Resolution Dialog
- **THEN** the dialog SHALL show Link, Overwrite, Rename, and Discard options

#### Scenario: canonicalExistsUnlinked row hides Discard

- **GIVEN** a row whose canonical master has no enabled global target
- **WHEN** the user opens the Same-Name Resolution Dialog
- **THEN** the dialog SHALL show Link, Overwrite, and Rename
- **AND** the dialog SHALL NOT show Discard

#### Scenario: Dialog open does not mutate state

- **WHEN** the user opens the Same-Name Resolution Dialog
- **THEN** the system SHALL NOT call any backend command that modifies canonical or project-local state
- **AND** no path SHALL run until the user picks it and confirms its own confirmation step


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Project-Local Skill Rename

The system SHALL provide a Tauri command that renames a project-local skill directory and updates its `SKILL.md` frontmatter `name` field in one operation. The rename SHALL be reachable from the Same-Name Resolution Dialog's Rename path.

The rename SHALL validate that the new name is non-empty, does not contain path traversal characters (`..`, `/`, `\`), and does not collide with an existing skill directory in the same project-local agent directory. On any validation failure, the system SHALL NOT modify any file on disk and SHALL return an error surfaced to the dialog as an inline error.

The rename SHALL NOT modify the canonical master or its sync metadata, because a project-local-only skill is not under canonical management. When the rename targets a skill inside `.agents/skills/` (shared by Codex and Gemini), the dialog SHALL warn the user that the rename will affect both Codex and Gemini, but SHALL NOT block the operation.

When folder rename succeeds but the frontmatter rewrite fails, the system SHALL attempt a best-effort rollback to restore the original folder name and SHALL return an error reporting which step failed.

After a successful rename, the inventory SHALL be refreshed so the renamed skill no longer appears as the same-name conflict row.

#### Scenario: Rename succeeds and updates inventory

- **GIVEN** a `canonicalGlobalOnly` row for `foo` whose project-local copy lives at `<project>/.claude/skills/foo/SKILL.md`
- **WHEN** the user picks Rename in the Same-Name Resolution Dialog and enters `foo-local`
- **THEN** the system SHALL rename the directory to `<project>/.claude/skills/foo-local/`
- **AND** the system SHALL update the frontmatter `name` field to `foo-local`
- **AND** the canonical master `foo` SHALL remain unchanged
- **AND** after refresh, the original `foo` row SHALL no longer appear as a same-name conflict

#### Scenario: Rename rejects collision

- **GIVEN** a project-local `foo` and an existing project-local `foo-local` in the same agent directory
- **WHEN** the user attempts to rename `foo` to `foo-local`
- **THEN** the command SHALL return an error
- **AND** no file on disk SHALL be modified
- **AND** the dialog SHALL display the error inline

#### Scenario: Rename rejects path traversal

- **GIVEN** the user enters a new name containing `..`, `/`, or `\`
- **WHEN** the rename command is invoked
- **THEN** the command SHALL return an error
- **AND** no file on disk SHALL be modified

#### Scenario: Shared `.agents/skills` rename warns about both agents

- **GIVEN** a project-local skill under `.agents/skills/` shared by Codex and Gemini
- **WHEN** the user opens the Rename path
- **THEN** the dialog SHALL display a warning that the rename will affect both Codex and Gemini
- **AND** the dialog SHALL still allow the user to confirm


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Project-Local Skill Discard

The system SHALL provide a Tauri command that deletes a project-local skill directory in one operation. The discard SHALL be reachable only from the Same-Name Resolution Dialog's Discard path, and only when the row's relationship is `canonicalGlobalOnly`.

The discard SHALL validate that the skill name does not contain path traversal characters (`..`, `/`, `\`). On validation failure, the system SHALL NOT modify any file on disk.

The discard SHALL NOT modify the canonical master or its sync metadata. When the directory is already absent (race condition), the command SHALL return success and treat the operation as idempotent.

When discarding inside `.agents/skills/`, the dialog SHALL warn the user that the discard will remove the skill from both Codex and Gemini, but SHALL NOT block the operation.

After a successful discard, the inventory SHALL be refreshed so the discarded row no longer appears.

#### Scenario: Discard removes project-local copy and keeps canonical

- **GIVEN** a `canonicalGlobalOnly` row for `foo` with project-local copy at `<project>/.claude/skills/foo/`
- **AND** the canonical master `foo` has an enabled global Claude target at `~/.claude/skills/foo/`
- **WHEN** the user confirms Discard
- **THEN** the system SHALL delete `<project>/.claude/skills/foo/` entirely
- **AND** the canonical master `foo` SHALL remain unchanged
- **AND** after refresh, the `foo` row SHALL no longer appear in the inventory
- **AND** the user-level Claude global fallback at `~/.claude/skills/foo/` SHALL remain so the agent can still find the skill

#### Scenario: Discard is unavailable when no global fallback exists

- **GIVEN** a `canonicalExistsUnlinked` row (canonical master has no enabled global target)
- **WHEN** the user opens the Same-Name Resolution Dialog
- **THEN** the dialog SHALL NOT offer Discard

#### Scenario: Discard treats missing directory as success

- **GIVEN** the project-local directory has already been removed externally
- **WHEN** the discard command runs
- **THEN** the command SHALL return success
- **AND** no error SHALL be raised

#### Scenario: Shared `.agents/skills` discard warns about both agents

- **GIVEN** a project-local skill under `.agents/skills/` shared by Codex and Gemini
- **WHEN** the user opens the Discard path
- **THEN** the dialog SHALL display a warning that the discard will remove the skill from both Codex and Gemini
- **AND** the dialog SHALL still allow the user to confirm


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Multi-Source Overwrite Path

The Same-Name Resolution Dialog's Overwrite path SHALL be available regardless of whether the row is single-source or multi-source. When the row is multi-source (deferred), the Overwrite path SHALL first open the existing multi-source drawer so the user picks an attribution before the Overwrite confirmation appears. The picked source index SHALL be carried into the Overwrite confirmation and used as the resolution source for `skill_import_apply`.

When the row is single-source, the Overwrite path SHALL skip the drawer and go directly to the Overwrite confirmation.

The Overwrite confirmation SHALL display the canonical/local line-level diff with direction `Felina master = base, this project = incoming`, regardless of whether the user arrived from a single-source or multi-source row.

#### Scenario: Multi-source Overwrite goes through drawer first

- **GIVEN** a `canonicalGlobalOnly` row where `foo` is found in both `<project>/.claude/skills/foo/` and `<project>/.agents/skills/foo/`
- **WHEN** the user picks Overwrite in the Same-Name Resolution Dialog
- **THEN** the multi-source drawer SHALL appear so the user picks one attribution
- **AND** only after the attribution is picked SHALL the Overwrite confirmation appear

#### Scenario: Single-source Overwrite skips drawer

- **GIVEN** a `canonicalGlobalOnly` row where `foo` is only found in `<project>/.claude/skills/foo/`
- **WHEN** the user picks Overwrite in the Same-Name Resolution Dialog
- **THEN** the multi-source drawer SHALL NOT appear
- **AND** the Overwrite confirmation SHALL appear directly


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Conflict Diff Direction Convention

The backend `ConflictInfo.hunks` field SHALL be computed with a fixed direction: `old = project source content`, `new = canonical master content`. This direction SHALL NOT vary with the dialog context.

The frontend SHALL flip the diff render direction per dialog context:

- The Link confirmation dialog SHALL render with `base = this project, incoming = Felina master`. To achieve this, the dialog SHALL swap each hunk line's `add` and `delete` kinds before applying line colors and prefix glyphs.
- The Overwrite confirmation dialog SHALL render with `base = Felina master, incoming = this project`. The dialog SHALL render hunk lines using the backend's original `add` and `delete` kinds.

The legend text below each dialog's diff SHALL match the dialog's base/incoming direction.

#### Scenario: Link dialog flips diff direction

- **GIVEN** a `ConflictInfo` whose backend hunks mark a line as `add` because the canonical master has it and the project source does not
- **WHEN** the line is rendered in the Link confirmation dialog
- **THEN** the line SHALL be displayed as an incoming addition (Felina side)
- **AND** the legend SHALL identify base as `this project` and incoming as `Felina master`

#### Scenario: Overwrite dialog keeps diff direction

- **GIVEN** a `ConflictInfo` whose backend hunks mark a line as `add` because the canonical master has it and the project source does not
- **WHEN** the line is rendered in the Overwrite confirmation dialog
- **THEN** the line SHALL be displayed using the backend's original `add` kind
- **AND** the legend SHALL identify base as `Felina master` and incoming as `this project`


<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->

---
### Requirement: Overwrite Confirmation Inline Diff

The Overwrite confirmation dialog SHALL display the canonical/local difference using the same inline line-level diff component as the Link confirmation dialog, instead of using a plain text summary. The dialog SHALL fall back to the textual `diffSummary` when `ConflictInfo.hunks` is empty.

The dialog SHALL continue to display the short directional message explaining "this project → Felina master" and the side-effect note about other enabled targets.

#### Scenario: Overwrite dialog renders inline hunks

- **GIVEN** a `ConflictInfo` whose `hunks` field is non-empty
- **WHEN** the Overwrite confirmation dialog is shown
- **THEN** the dialog SHALL render an inline line-level diff using the hunks
- **AND** the dialog SHALL NOT render only the textual `diffSummary`

#### Scenario: Overwrite dialog falls back to summary when hunks empty

- **WHEN** the `ConflictInfo.hunks` field is empty
- **THEN** the Overwrite confirmation dialog SHALL display the textual `diffSummary`

<!-- @trace
source: projects-local-skill-resolution
updated: 2026-06-02
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - .session/product-backlog.md
tests:
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
-->