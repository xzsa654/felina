## ADDED Requirements

### Requirement: CoverageMatrix Drifted State

The CoverageMatrix SHALL display a `drifted` state for cells where the drift scan reports that the agent-side file has been modified externally since the last push. The `drifted` state SHALL be visually distinct from `synced`, `dirty`, `not-synced`, `disabled`, and `no-target` states. The `drifted` indicator SHALL use a semantic warning color.

#### Scenario: Cell shows drifted when scan reports drift

- **WHEN** the drift scan result contains `drifted` status for a skill's target
- **AND** the target is enabled and tracked
- **THEN** the CoverageMatrix cell for that skill-target pair SHALL display the `drifted` indicator

#### Scenario: Drifted state is visually distinct

- **WHEN** a CoverageMatrix cell is in `drifted` state
- **THEN** the cell SHALL use a warning-class semantic color distinct from synced (success), dirty (info), and not-synced (muted)

### Requirement: TargetEditor Drift Indicator

The TargetEditor SHALL display a per-target drift status indicator when the drift scan reports that a target's agent-side file has drifted. The indicator SHALL be visible in the target row without requiring the user to expand or hover.

#### Scenario: Target row shows drift badge

- **WHEN** the drift scan result contains `drifted` status for a specific target
- **THEN** the TargetEditor row for that target SHALL display a drift indicator badge
- **AND** the badge SHALL use a semantic warning color
