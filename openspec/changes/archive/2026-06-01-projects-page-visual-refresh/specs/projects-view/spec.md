## MODIFIED Requirements

### Requirement: Project Detail Panel Layout

UPDATE the project detail panel from table-based rendering to a list-based layout. The panel SHALL display a Project Summary Header at the top, followed by vertically stacked Discovered and Managed sections.

#### Scenario: Project detail panel displays summary header

- **GIVEN** a known project is selected in the left column
- **WHEN** the detail panel renders
- **THEN** the panel SHALL display the project directory name as a heading, followed by a status summary line showing discovered and managed skill counts (e.g., "2 Discovered · 5 Managed")

#### Scenario: Discovered section stacks above Managed

- **GIVEN** the selected project has both discovered and managed skills
- **WHEN** the detail panel renders
- **THEN** the Discovered section SHALL render above the Managed section in a vertically stacked layout (not tabbed)
  - Each section SHALL use a list-based layout with Flex and whitespace, not a table element
  - Discovered section SHALL be hidden when the project has zero discovered skills

#### Scenario: Agent chips use brand icons

- **GIVEN** a skill row displays an agent identifier
- **WHEN** the row renders
- **THEN** the agent chip SHALL display a brand icon consistent with SkillList (claude.svg for anthropic, codex.png for codex, antigravity.png for gemini) instead of plain text labels

#### Scenario: Status integrated into list items

- **GIVEN** a managed skill has a sync status
- **WHEN** the row renders
- **THEN** the status SHALL be displayed as an inline Badge within the list item row, not as a separate table column
