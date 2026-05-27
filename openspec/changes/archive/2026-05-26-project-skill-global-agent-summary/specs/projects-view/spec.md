## MODIFIED Requirements

### Requirement: Managed Inventory View

The Projects view's right column SHALL render a "managed inventory" table for the selected project. Each row represents a unique skill name in the union of three sources:

- agent-directory scan results (`.claude/skills/`, `.agents/skills/`, `.gemini/skills/` under the selected project),
- global canonical master files whose `targets` include an entry with `scope=project` and `project=<selected project path>`, and
- global canonical master files whose canonical directory identity matches a skill name found by the selected project's agent-directory scan.

No new backend command SHALL be introduced for this view; the row union and per-agent availability summary SHALL be computed in the frontend from existing commands (`skill_import_scan`, `known_projects_list`, `canonical_skills_list`).

Each row SHALL render two independent axes of state:

- a **managed label** showing "Managed" when a global canonical master has a target pointing at this project, otherwise "Unmanaged";
- a set of three **per-agent chips** (claude, codex, gemini), each showing whether that skill name is available to the corresponding agent from either the selected project's corresponding agent directory or the same-named global canonical master's enabled tracked targets.

For per-agent chip calculation, a project-local agent directory containing `SKILL.md` SHALL set that agent chip to present. A same-named global canonical master target SHALL also set that agent chip to present only when the target has the same `agent`, has `enabled=true`, and has `mode=tracked`. A disabled target, a detached target, a forked target, or an absent target SHALL NOT set an agent chip to present. A same-named global canonical master SHALL be matched by canonical directory identity, not by parsed frontmatter `name`.

The row SHALL provide exactly the following actions:

- when **Unmanaged** and no same-named global canonical master exists, an "Import to global" button that invokes `skill_import_apply` to write `~/.felina/skills/<name>/SKILL.md` and add the appropriate `scope=project` target;
- when **Managed**, clicking the row navigates the user to the Skills view with this skill selected for editing;
- when **Unmanaged** but a same-named global canonical master exists, clicking the row navigates the user to the Skills view with that canonical skill selected for editing, and the row SHALL NOT present the normal import action as the primary action.

The Projects view SHALL NOT provide any in-place target editing, "manage this skill" toggle, or skill deletion action; all target and master-file mutations remain in the Skills view's editor.

Inventory rows SHALL be ordered by, in priority: (1) management status — Managed rows before Unmanaged; (2) action kind — editable same-named canonical rows before importable rows before multi-source deferred rows; (3) skill name, alphabetical. Because status is the primary key, the net order is: Managed rows (alphabetical), then Unmanaged rows that can navigate to an existing same-named canonical skill (alphabetical), then Unmanaged importable rows (alphabetical), then multi-source deferred rows (alphabetical).

#### Scenario: Inventory row ordering

- **GIVEN** the selected project yields rows: `zed` (Managed), `global-match` (Unmanaged with same-named canonical), `alpha` (Unmanaged, single-source), `beta` (Unmanaged, single-source), `multi` (Unmanaged, multi-source/deferred)
- **WHEN** the inventory renders
- **THEN** the row order is `zed`, `global-match`, `alpha`, `beta`, `multi` (Managed first despite `zed` sorting last alphabetically; same-named canonical rows before importable rows; importable before deferred within Unmanaged)

#### Scenario: Row appears for a project-only skill not yet managed globally

- **GIVEN** `<projectA>/.claude/skills/local-only/SKILL.md` exists, no `~/.felina/skills/local-only` exists, and no global master targets `projectA`
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row `local-only` with the **Unmanaged** label, the claude chip set to present, the codex and gemini chips set to absent, and an "Import to global" button visible on the row

#### Scenario: Managed but missing on one project-local agent directory

- **GIVEN** `~/.felina/skills/shared` has targets `[{agent:anthropic,scope:project,project:<projectA>,enabled:true,mode:tracked}, {agent:codex,scope:project,project:<projectA>,enabled:true,mode:tracked}]`, and only `<projectA>/.claude/skills/shared/SKILL.md` exists on disk (the codex copy is absent)
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row `shared` with the **Managed** label, claude chip present, codex chip present, and gemini chip absent

#### Scenario: Same-named global targets supplement project-local chips

- **GIVEN** `<projectA>/.claude/skills/foo/SKILL.md` exists
- **AND** `~/.felina/skills/foo` has targets `[{agent:codex,scope:global,enabled:true,mode:tracked}, {agent:gemini,scope:global,enabled:true,mode:tracked}]`
- **AND** `~/.felina/skills/foo` has no target with `scope=project` and `project=<projectA>`
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row `foo` with the **Unmanaged** label
- **AND** the claude, codex, and gemini chips are all present
- **AND** clicking the row navigates to the Skills view with `foo` selected instead of presenting the normal import action as the primary action

##### Example: local plus global availability union

| Project-local files | Same-named canonical targets | Expected chips | Managed label |
| ----- | ----- | ----- | ----- |
| `<projectA>/.claude/skills/foo/SKILL.md` | `codex:global:enabled:tracked`, `gemini:global:enabled:tracked` | `claude=present`, `codex=present`, `gemini=present` | `Unmanaged` |
| `<projectA>/.agents/skills/foo/SKILL.md` | `anthropic:project:<projectA>:enabled:tracked` | `claude=present`, `codex=present`, `gemini=absent` | `Managed` |
| `<projectA>/.claude/skills/foo/SKILL.md` | `codex:global:disabled:tracked`, `gemini:global:enabled:detached` | `claude=present`, `codex=absent`, `gemini=absent` | `Unmanaged` |

#### Scenario: Disabled or detached global targets do not mark chips present

- **GIVEN** `<projectA>/.claude/skills/foo/SKILL.md` exists
- **AND** `~/.felina/skills/foo` has targets `[{agent:codex,scope:global,enabled:false,mode:tracked}, {agent:gemini,scope:global,enabled:true,mode:detached}]`
- **WHEN** the Projects view selects `projectA`
- **THEN** the inventory contains a row `foo` with claude chip present, codex chip absent, and gemini chip absent

#### Scenario: Import to global action moves an Unmanaged row to Managed

- **GIVEN** an inventory row `local-only` with **Unmanaged** label, only the claude chip present, and no same-named global canonical master
- **WHEN** the user clicks the row's "Import to global" button and confirms
- **THEN** after refresh the same row shows the **Managed** label, the claude chip remains present, and the action button is replaced by the standard managed-row click behavior

#### Scenario: Clicking a Managed row navigates to Skills view with selection

- **GIVEN** an inventory row `shared` with **Managed** label
- **WHEN** the user clicks the row
- **THEN** the application navigates to the Skills view and selects the `shared` skill in the canonical list for editing
