## ADDED Requirements

### Requirement: Grouped Skill List with Section Headers

The SkillList component SHALL display skills in two groups separated by section headers: "Action Required" for skills that are broken, dirty, have no targets configured, or have at least one drifted target, and "All Skills" for the remaining skills. If all skills belong to a single group, only that group's header SHALL be displayed. Section headers SHALL be non-interactive list items rendered above their respective group.

#### Scenario: Two groups with section headers

- **GIVEN** 2 skills are dirty and 3 skills are clean with targets
- **WHEN** the SkillList renders
- **THEN** an "Action Required" header appears above the 2 dirty skills and an "All Skills" header appears above the 3 clean skills

#### Scenario: Single group only

- **GIVEN** all 5 skills are clean with targets configured
- **WHEN** the SkillList renders
- **THEN** only an "All Skills" header is displayed with no "Action Required" header

#### Scenario: Drifted skill is grouped under Action Required

- **GIVEN** a skill is clean and not dirty but has at least one target whose drift status is "drifted"
- **WHEN** the SkillList renders
- **THEN** that skill appears under the "Action Required" header

### Requirement: Rounded Selection Indicator

The SkillList SHALL use a rounded-md background fill to indicate the selected skill item instead of a left border indicator. The selected item SHALL use bg-bg-secondary background. Non-selected items SHALL display hover:bg-bg-secondary/50 on hover. Items SHALL have horizontal margin (mx-2) to inset from the sidebar edges.

#### Scenario: Selected skill appearance

- **WHEN** a skill is selected in the SkillList
- **THEN** the selected row displays with rounded corners and a filled secondary background, without any left border indicator

### Requirement: Compact Agent Chip Format

Each skill row in the SkillList SHALL display agent target information as compact chips identifying only the agent, omitting both the location and the mode fields to conserve horizontal space. A chip SHALL render the agent's brand icon when one is available for that agent, and SHALL fall back to the agent's text identifier when no icon is available. In both forms the agent name SHALL remain accessible via the element's title/alt text. Chips SHALL be de-duplicated by agent, so a skill with multiple targets sharing the same agent displays that agent once.

#### Scenario: Agent chip displays the agent icon

- **GIVEN** a skill has a target whose agent has a brand icon available
- **WHEN** the SkillList renders that skill's row
- **THEN** the agent chip displays that agent's icon (with the agent name as its title/alt text) and no location or mode

#### Scenario: Agent chip falls back to text

- **GIVEN** a skill has a target whose agent has no brand icon available
- **WHEN** the SkillList renders that skill's row
- **THEN** the agent chip displays the agent's text identifier without the location or mode fields

#### Scenario: Multiple targets of the same agent collapse to one chip

- **GIVEN** a skill has two targets both with agent "claude" but different projects
- **WHEN** the SkillList renders that skill's row
- **THEN** a single "claude" chip is displayed

### Requirement: Contextual Push Button Visibility

The push button on each skill row SHALL be permanently visible when the skill is dirty. When the skill is not dirty, the push button SHALL be hidden by default and only appear when the user hovers over the skill row.

#### Scenario: Dirty skill shows push button always

- **GIVEN** a skill is dirty (has unsaved changes)
- **WHEN** the SkillList renders that row without hover
- **THEN** the push button is visible

#### Scenario: Clean skill shows push button on hover only

- **GIVEN** a skill is not dirty
- **WHEN** the user does not hover over the skill row
- **THEN** the push button is hidden
- **AND WHEN** the user hovers over the row
- **THEN** the push button becomes visible
