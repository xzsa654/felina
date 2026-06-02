## MODIFIED Requirements

### Requirement: Grouped Skill List with Section Headers

The SkillList component SHALL display skills in four ordered groups separated by section headers:

1. "Needs Attention" — skills that are broken or have at least one drifted target
2. "Needs Push" — skills that are dirty (have unpushed changes) and not in group 1
3. "Not Configured" — skills with no enabled targets (either zero targets, or all targets disabled) and not in groups 1–2
4. "Ready" — all remaining skills

A section header SHALL be rendered as a non-interactive list item above the first skill of that group. If a group has no entries, its header SHALL NOT be rendered. The ordering between groups SHALL always be 1 → 2 → 3 → 4. Inside a group, skills SHALL be sorted alphabetically by name.

#### Scenario: Mixed states yield four headers
- **GIVEN** the list contains a broken skill, a dirty skill, a skill with no enabled targets, and a clean skill
- **WHEN** the list renders
- **THEN** four section headers SHALL appear in order: "Needs Attention", "Needs Push", "Not Configured", "Ready"

##### Example:
- GIVEN entries `[broken-A (broken), beta (dirty), gamma (no targets), delta (clean)]`
- WHEN sorted
- THEN render order is `[header(Needs Attention), broken-A, header(Needs Push), beta, header(Not Configured), gamma, header(Ready), delta]`

#### Scenario: Single-group list omits other headers
- **GIVEN** all skills are clean and have at least one target
- **WHEN** the list renders
- **THEN** only the "Ready" header SHALL be rendered

##### Example:
- GIVEN entries `[a, b, c]` all clean with targets
- WHEN sorted
- THEN render order is `[header(Ready), a, b, c]`

## ADDED Requirements

### Requirement: List Search Input

The SkillList SHALL be preceded by a borderless search input that filters the visible entries in real time. The input SHALL match against each entry's name and description fields using case-insensitive substring matching. An empty query SHALL show all entries. The filtered set SHALL feed into the grouping defined by the "Grouped Skill List with Section Headers" requirement.

The input SHALL NOT use a bordered container, table-style toolbar, or independent information row; it SHALL adopt the document-centric Felina visual language (transparent background, leading icon, focus state replaces border emphasis).

#### Scenario: Typing filters list in real time
- **GIVEN** the list contains skills named `alpha`, `beta-tester`, and `gamma`
- **WHEN** the user types `bet` into the search input
- **THEN** only `beta-tester` SHALL be rendered (plus its group header)

##### Example:
- GIVEN entries `[alpha, beta-tester, gamma]`, query = `bet`
- WHEN filter runs
- THEN visible entries are `[beta-tester]`

#### Scenario: Empty query restores all entries
- **GIVEN** the search query is `bet` and one entry is visible
- **WHEN** the user clears the input
- **THEN** all entries that existed before filtering SHALL be rendered again

##### Example:
- GIVEN visible = `[beta-tester]`, query cleared to ``
- WHEN filter re-runs
- THEN visible entries are `[alpha, beta-tester, gamma]`

#### Scenario: Description match works
- **GIVEN** a skill named `foo` whose description is "handles bar parsing"
- **WHEN** the user types `bar` into the search input
- **THEN** `foo` SHALL be visible

##### Example:
- GIVEN entries `[foo {desc: "handles bar parsing"}, qux]`, query = `bar`
- WHEN filter runs
- THEN visible entries are `[foo]`

### Requirement: Per-Agent Scope Marker in List Row

Each skill list row SHALL display, for each distinct agent in the skill's set of enabled targets, the agent icon followed by one or both scope marker icons indicating whether that agent has a global target, a project target, or both. Specifically:

- A "global scope" marker SHALL appear next to the agent icon when the skill has at least one enabled global-scope target for that agent.
- A "project scope" marker SHALL appear next to the agent icon when the skill has at least one enabled project-scope target for that agent. Multiple project targets for the same agent SHALL collapse to a single marker.
- An agent with zero enabled targets SHALL NOT appear in the row.

The agent icon and its scope marker(s) SHALL be rendered as a single visual unit (no enclosing border or label container), consistent with the Felina design constraint that status information must be embedded into existing elements rather than displayed as a separate information row.

Targets that are disabled, detached, or forked SHALL NOT contribute to the markers.

#### Scenario: Single global target
- **GIVEN** a skill has one enabled target `{agent: anthropic, scope: global}`
- **WHEN** the row renders
- **THEN** the row SHALL display the anthropic icon followed by the global scope marker only

##### Example:
- GIVEN targets `[{anthropic, global, enabled, manual}]`
- WHEN row renders
- THEN visible markers: `<anthropic-icon><Globe>`

#### Scenario: Mixed scope same agent
- **GIVEN** a skill has targets `{anthropic, global}` and `{anthropic, project: /p1}` and `{anthropic, project: /p2}`
- **WHEN** the row renders
- **THEN** the row SHALL display the anthropic icon followed by one global marker and one project marker; the project marker SHALL NOT be duplicated for the two project targets

##### Example:
- GIVEN targets `[{anthropic, global}, {anthropic, project /p1}, {anthropic, project /p2}]`
- WHEN row renders
- THEN visible markers: `<anthropic-icon><Globe><Folder>` (one Folder, not two)

#### Scenario: Multiple agents with different scopes
- **GIVEN** a skill has `{anthropic, global}` and `{codex, project: /p1}`
- **WHEN** the row renders
- **THEN** the row SHALL display the anthropic icon + global marker, then the codex icon + project marker; the two agent groups SHALL be visually separated by a larger gap than the gap between an agent icon and its scope markers

##### Example:
- GIVEN targets `[{anthropic, global}, {codex, project /p1}]`
- WHEN row renders
- THEN visible markers: `<anthropic-icon><Globe>` <larger-gap> `<codex-icon><Folder>`

#### Scenario: Disabled target excluded
- **GIVEN** a skill has `{anthropic, global, enabled: false}` and `{anthropic, project: /p1, enabled: true}`
- **WHEN** the row renders
- **THEN** the global marker SHALL NOT appear; only the project marker SHALL appear next to the anthropic icon

##### Example:
- GIVEN targets `[{anthropic, global, disabled}, {anthropic, project /p1, enabled}]`
- WHEN row renders
- THEN visible markers: `<anthropic-icon><Folder>` (no Globe)
