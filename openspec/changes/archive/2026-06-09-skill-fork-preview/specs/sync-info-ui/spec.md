## MODIFIED Requirements

### Requirement: Sync Info Status Grouping

The system SHALL present skill target sync statuses inline within Target Chips rather than in a separate SyncInfoBar component. In collapsed state, each Target Chip SHALL display a status icon indicating its synchronization state: checkmark for synced, filled circle for pending/not-synced, exclamation for missing/project-not-found, and fork icon for Forked targets. Forked targets SHALL display one of four fork sub-status indicators: fork-clean (info color), fork-edited with delta indicator (info color), fork-ahead with warning indicator (warning color), or fork-diverged with warning indicator (deeper warning color). The system SHALL use semantic theme colors from STATUS_CONFIG to differentiate states. The system SHALL display a single area-level siblingsDirty warning indicator at the beginning of the Target Chips row when any sibling has unsaved changes, rather than repeating the warning on each chip.

#### Scenario: Collapsed chip displays sync status icon

- **WHEN** the Target Chips area is rendered in collapsed state
- **THEN** each chip SHALL display its sync status icon alongside the existing agent/location/mode label
- **AND** Forked targets SHALL display the fork status icon instead of a sync status icon

##### Example: Mixed status chips including forked

- **GIVEN** a skill with targets: claude global auto (synced), gemini project manual (pending), codex project forked (edited)
- **WHEN** the Target Chips area renders in collapsed state
- **THEN** chips display as: checkmark claude global auto, circle gemini project manual, fork-delta codex project forked

#### Scenario: siblingsDirty area-level warning

- **GIVEN** a skill where at least one sibling skill has unsaved changes
- **WHEN** the Target Chips area is rendered
- **THEN** a single warning indicator SHALL appear at the start of the Target Chips row
- **AND** individual chips SHALL NOT each display their own siblingsDirty warning
