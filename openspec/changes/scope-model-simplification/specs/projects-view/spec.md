## ADDED Requirements

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

### Requirement: Managed Inventory View

The Projects view's right column SHALL render a "managed inventory" table for the selected project. Each row represents a unique skill name in the union of two sources:

- agent-directory scan results (`.claude/skills/`, `.codex/skills/`, `.gemini/skills/` under the selected project), and
- global canonical master files whose `targets` include an entry with `scope=project` and `project=<selected project path>`.

No new backend command SHALL be introduced for this view; the row union SHALL be computed in the frontend from existing commands (`skill_import_scan`, `known_projects_list`, `canonical_skills_list`).

Each row SHALL render two independent axes of state:

- a **managed label** showing "Managed" when a global canonical master has a target pointing at this project, otherwise "Unmanaged";
- a set of three **per-agent chips** (claude, codex, gemini), each showing whether the selected project's corresponding agent directory currently contains a SKILL.md for this skill name.

The row SHALL provide exactly the following actions:

- when **Unmanaged**, an "Import to global" button that invokes `skill_import_apply` to write `~/.felina/skills/<name>/SKILL.md` and add the appropriate `scope=project` target;
- when **Managed**, clicking the row navigates the user to the Skills view with this skill selected for editing.

The Projects view SHALL NOT provide any in-place target editing, "manage this skill" toggle, or skill deletion action; all target and master-file mutations remain in the Skills view's editor.

#### Scenario: Row appears for a project-only skill not yet managed globally

- **GIVEN** `<projectA>/.claude/skills/local-only/SKILL.md` exists, no `~/.felina/skills/local-only` exists, and no global master targets `projectA`
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row "local-only" with the **Unmanaged** label, the claude chip set to "present", the codex and gemini chips set to "absent", and an "Import to global" button visible on the row

#### Scenario: Managed but missing on one agent

- **GIVEN** `~/.felina/skills/shared` has targets `[{agent:anthropic,scope:project,project:<projectA>}, {agent:codex,scope:project,project:<projectA>}]`, AND only `<projectA>/.claude/skills/shared/SKILL.md` exists on disk (the codex copy is absent)
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row "shared" with the **Managed** label, claude chip "present", codex chip "absent", and gemini chip "absent"

#### Scenario: Import to global action moves an Unmanaged row to Managed

- **GIVEN** an inventory row "local-only" with **Unmanaged** label and only the claude chip present
- **WHEN** the user clicks the row's "Import to global" button and confirms
- **THEN** after refresh the same row shows the **Managed** label, the claude chip remains "present", and the action button is replaced by the standard managed-row click behavior

#### Scenario: Clicking a Managed row navigates to Skills view with selection

- **GIVEN** an inventory row "shared" with **Managed** label
- **WHEN** the user clicks the row
- **THEN** the application navigates to the Skills view and selects the `shared` skill in the canonical list for editing
