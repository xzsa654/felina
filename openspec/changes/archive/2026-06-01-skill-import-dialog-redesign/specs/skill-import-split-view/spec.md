## ADDED Requirements

### Requirement: Split view staging area for imported skills

The system SHALL provide a two-pane (split view) dialog for importing skills. The left pane SHALL display skills discovered or selected for import. The right pane SHALL display the staging queue of skills designated for actual import.

#### Scenario: User opens import dialog
- **WHEN** user initiates a skill import action
- **THEN** the system displays the two-pane import staging dialog

#### Scenario: User drags skill from discovered to staging
- **WHEN** user drags a skill card from the left pane and drops it into the right pane
- **THEN** the skill is added to the staging queue

#### Scenario: User double-clicks skill to move between panes
- **WHEN** user double-clicks a skill card in either pane
- **THEN** the system moves the skill to the opposite pane
