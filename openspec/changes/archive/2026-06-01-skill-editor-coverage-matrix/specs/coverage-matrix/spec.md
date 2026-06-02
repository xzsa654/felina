## MODIFIED Requirements

### Requirement: Coverage Matrix View

The Skills page SHALL provide a Summary view-mode alongside the existing List view-mode, toggled via a view-mode control in the page header. When Summary mode is active, the page SHALL render a skill x target grid where each row represents a canonical skill and each column represents a unique target combination (agent x scope x project).

Each cell SHALL display the sync state of that skill-target pair using status Badge components instead of plain text symbols. Each Badge SHALL be a rounded-full element with semantic theme background and text colors:

- Synced: checkmark icon with bg-success/10 text-success
- Dirty: filled circle icon with bg-warning/10 text-warning
- Not synced: dash icon with bg-bg-secondary/30 text-text-secondary
- Disabled: open circle icon with bg-bg-secondary/20 text-text-tertiary
- Empty: no Badge rendered

Data rows SHALL NOT use grid lines or cell borders. Instead, rows SHALL use hover:bg-bg-secondary/20 with group hover to provide visual row tracking. The header row SHALL retain a bottom border as the sole divider between header and data rows.

Column headers SHALL display the agent name and scope label. For project-scope targets, the column header SHALL show the last path segment as a short project name. Rows SHALL be sorted alphabetically by skill name.

Skill names in the first column SHALL be interactive: they SHALL display cursor-pointer styling and a hover text color change. When clicked, the system SHALL switch the view mode to List and select the clicked skill for editing. The CoverageMatrix component SHALL accept an onSkillClick callback prop of type (name: string) => void for this purpose.

When no skills exist, the Summary view SHALL display an empty state message.

#### Scenario: Toggle between List and Summary

- **GIVEN** the Skills page is showing List mode with 3 canonical skills
- **WHEN** the user clicks the Summary toggle
- **THEN** the page renders a grid with 3 rows (one per skill) and columns for each unique target across all skills
- **AND** data rows have no visible grid lines or cell borders

#### Scenario: Cell reflects sync state with Badge

- **GIVEN** skill "my-skill" has a target anthropic:global with a lastSync entry and dirty is false
- **WHEN** the Coverage Matrix renders
- **THEN** the cell at row "my-skill", column "anthropic / global" displays a rounded Badge with checkmark icon in success color

#### Scenario: Row hover highlight

- **WHEN** the user hovers over a data row in the Coverage Matrix
- **THEN** the entire row SHALL display a subtle background highlight (bg-bg-secondary/20)

#### Scenario: Skill name click navigates to editor

- **GIVEN** the Coverage Matrix is displayed with skill "code-review" in a row
- **WHEN** the user clicks the "code-review" skill name
- **THEN** the view mode switches to List and the "code-review" skill is selected and expanded in the SkillEditor

#### Scenario: Empty skills list

- **GIVEN** no canonical skills exist in the current scope
- **WHEN** Summary mode is active
- **THEN** the grid area displays "No skills to display"
