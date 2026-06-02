## MODIFIED Requirements

### Requirement: Managed Inventory View

The Projects view's right column SHALL render a managed inventory list for the selected project. Each row SHALL represent a unique skill name in the union of:

- agent-directory scan results under the selected project,
- global canonical master files whose targets include an entry with `scope=project` and `project=<selected project path>`,
- global canonical master files whose canonical directory identity matches a skill name found by the selected project's agent-directory scan.

No broad replacement backend command SHALL be introduced for this view. The row union, detected-source grouping, and per-target summary SHALL be computed in the frontend from existing commands unless a narrow preview-only diff command is required for Link confirmation.

Each row SHALL render two independent axes of state:

- `Detected sources`: the agent-native sources found by scanning the selected project's configured agent directories. This axis MUST NOT include canonical targets.
- `Felina targets`: relevant targets from a same-named canonical master. This axis SHALL include only global targets and project targets whose normalized project path equals the selected project path. It MUST NOT include targets for other projects.

The row SHALL be treated as Managed only when a same-named canonical master has an enabled project target for the selected project and that target is not detached or forked. A global target SHALL NOT mark the selected project as Managed.

For detected-source calculation, a project-local agent directory containing `SKILL.md` SHALL mark that agent as present for the selected project. When multiple agents resolve to the same physical source path, the row SHALL preserve each agent attribution while displaying the physical source as one grouped source.

The row SHALL provide these actions:

- when the row is local-only and no same-named canonical master exists, an "Import to Felina" action SHALL invoke the existing import flow;
- when the row is managed by a selected-project target, clicking the row SHALL navigate to the Skills view with that canonical skill selected;
- when a same-named canonical master exists but lacks a selected-project target, the primary action SHALL be Link to Project, and the normal Import to Felina overwrite path SHALL NOT be the primary action;
- when the row has a same-named canonical global target but no selected-project target, the row SHALL show a global duplicate or resolve state rather than Managed;
- overwrite SHALL remain available only as an explicit secondary action for same-name canonical rows.

The Projects view SHALL NOT provide in-place target editing beyond the Link to Project append flow, SHALL NOT provide skill deletion, and SHALL NOT delete project-local files.

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

#### Scenario: Same-name canonical without selected project target requires resolution

- **WHEN** a discovered skill row has a same-named canonical master
- **AND** the canonical master has no selected-project target
- **THEN** the row SHALL display a Link to Project or resolve action as the primary action
- **AND** the row SHALL NOT display the normal Import to Felina action as the primary action

#### Scenario: Inventory row ordering

- **WHEN** the selected project yields rows `zed` as Managed, `global-match` as same-name canonical resolution, `alpha` as local-only importable, and `multi` as unresolved multi-source
- **THEN** the row order SHALL be `zed`, `global-match`, `alpha`, `multi`

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

## ADDED Requirements

### Requirement: Discovered Skill Link Confirmation

When a discovered skill has a same-named canonical master but no selected-project target, the system SHALL require an explicit Link to Project confirmation before appending a project target. The confirmation SHALL show canonical/local difference information derived from the existing import conflict metadata or from a narrow preview-only command.

The Link to Project action SHALL append a project-scope target to the existing canonical master's target list, associating the current project with that skill without overwriting canonical content. Duplicate targets with the same agent and normalized project path SHALL NOT be appended.

A secondary overwrite option SHALL remain available for users who explicitly want to replace canonical master content with the project-local version.

#### Scenario: Link confirmation is shown before target append

- **WHEN** the user clicks Link to Project on a discovered same-name canonical row
- **THEN** the system SHALL show a confirmation panel or drawer containing canonical/local difference information
- **AND** the system SHALL NOT call `skill_targets_set` until the user confirms

#### Scenario: Link to Project adds a selected-project target

- **WHEN** the user confirms Link to Project
- **THEN** the system SHALL append `{ agent, scope: "project", project: <selected project path>, enabled: true, mode: "manual" }` to the canonical master's targets
- **AND** the system SHALL call `skill_targets_set` with the updated target list
- **AND** after refresh, the row SHALL appear as Managed

#### Scenario: Duplicate target prevention

- **WHEN** the canonical master already has a target with the same agent and normalized selected project path
- **THEN** Link to Project SHALL NOT append a second equivalent target
- **AND** the system SHALL refresh the inventory

#### Scenario: Overwrite remains explicit

- **WHEN** the user chooses the overwrite secondary action
- **THEN** the system SHALL use the existing overwrite confirmation flow
- **AND** the overwrite action SHALL remain visually secondary to Link to Project

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
