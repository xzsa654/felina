## ADDED Requirements

### Requirement: Coverage Matrix View

The Skills page SHALL provide a Summary view-mode alongside the existing List view-mode, toggled via a view-mode control in the page header. When Summary mode is active, the page SHALL render a skill × target grid where each row represents a canonical skill and each column represents a unique target combination (agent × scope × project). Each cell SHALL display the sync state of that skill-target pair using the following icons:

- `✓` — synced: a `lastSync` entry exists for this target and the skill is not dirty
- `●` — dirty: a `lastSync` entry exists but the skill is dirty
- `—` — not synced: the target exists in the skill's target list but no `lastSync` entry is present
- `○` — disabled: the target exists but `enabled` is false
- empty — the skill has no target matching this column

Column headers SHALL display the agent name and scope label. For project-scope targets, the column header SHALL show the last path segment as a short project name. Rows SHALL be sorted alphabetically by skill name.

When no skills exist, the Summary view SHALL display an empty state message.

#### Scenario: Toggle between List and Summary

- **GIVEN** the Skills page is showing List mode with 3 canonical skills
- **WHEN** the user clicks the Summary toggle
- **THEN** the page renders a grid with 3 rows (one per skill) and columns for each unique target across all skills

#### Scenario: Cell reflects sync state

- **GIVEN** skill "my-skill" has a target `anthropic:global` with a `lastSync` entry and `dirty` is false
- **WHEN** the Coverage Matrix renders
- **THEN** the cell at row "my-skill", column "anthropic / global" displays `✓`

#### Scenario: Empty skills list

- **GIVEN** no canonical skills exist in the current scope
- **WHEN** Summary mode is active
- **THEN** the grid area displays "No skills to display"
