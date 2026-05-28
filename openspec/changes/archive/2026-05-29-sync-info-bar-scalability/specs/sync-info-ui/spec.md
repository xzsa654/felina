## ADDED Requirements

### Requirement: Sync Info Status Grouping

The system SHALL present skill target sync statuses as an aggregated summary in the sync info UI, grouping targets by their synchronization state (Synced, Pending/Not-Synced, Missing/Error). The system SHALL NOT render all individual targets in a flat vertical list by default when multiple targets exist.

#### Scenario: Aggregated summary display

- **GIVEN** a skill with multiple targets
- **WHEN** the user views the skill's sync information
- **THEN** the UI SHALL display a concise row of summary chips representing the counts for each status group

##### Example: Summary chips

- **GIVEN** a skill has 8 targets in Synced state, 1 in Pending state, and 1 in Missing state
- **WHEN** the sync info bar is rendered
- **THEN** the UI displays `[✓ 8 Synced]`, `[— 1 Pending]`, and `[! 1 Missing]` chips

### Requirement: Auto-Expansion of Actionable States

The system SHALL automatically expand and display the detailed list of targets for any state that requires user attention, such as Pending (not-synced) or Missing (project not found). Targets in a healthy (Synced) state SHALL remain collapsed by default to save vertical space.

#### Scenario: Auto-expanding pending items

- **GIVEN** a skill has both Synced and Pending targets
- **WHEN** the sync info bar is rendered
- **THEN** the detailed list of Pending targets SHALL be visible automatically
- **AND** the detailed list of Synced targets SHALL be hidden

### Requirement: Interactive Expansion

The system SHALL allow users to toggle the visibility of the detailed target list for any status group by interacting with its corresponding summary chip.

#### Scenario: Toggling synced details

- **GIVEN** a skill has Synced targets that are currently collapsed
- **WHEN** the user clicks the `Synced` summary chip
- **THEN** the detailed list of Synced targets SHALL become visible
- **AND WHEN** the user clicks the chip again
- **THEN** the detailed list SHALL collapse
