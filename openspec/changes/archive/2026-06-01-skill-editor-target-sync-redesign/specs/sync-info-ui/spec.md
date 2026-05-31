## MODIFIED Requirements

### Requirement: Sync Info Status Grouping

The system SHALL present skill target sync statuses inline within Target Chips rather than in a separate SyncInfoBar component. In collapsed state, each Target Chip SHALL display a status icon indicating its synchronization state: checkmark (✓) for synced, filled circle (●) for pending/not-synced, exclamation (!) for missing/project-not-found. The system SHALL use semantic theme colors from STATUS_CONFIG to differentiate states. The system SHALL display a single area-level siblingsDirty warning indicator at the beginning of the Target Chips row when any sibling has unsaved changes, rather than repeating the warning on each chip.

#### Scenario: Collapsed chip displays sync status icon

- **WHEN** the Target Chips area is rendered in collapsed state
- **THEN** each chip SHALL display its sync status icon (✓, ●, or !) alongside the existing agent/location/mode label

##### Example: Mixed status chips

- **GIVEN** a skill with targets: claude·global·auto (synced), gemini·project·manual (pending), codex·global·auto (missing project)
- **WHEN** the Target Chips area renders in collapsed state
- **THEN** chips display as: [✓ claude·global·auto] [● gemini·project·manual] [! codex·global·auto]

#### Scenario: siblingsDirty area-level warning

- **GIVEN** a skill where at least one sibling skill has unsaved changes
- **WHEN** the Target Chips area is rendered
- **THEN** a single warning indicator (⚠) SHALL appear at the start of the Target Chips row
- **AND** individual chips SHALL NOT each display their own siblingsDirty warning

## ADDED Requirements

### Requirement: Target Detail Popover

The system SHALL display target details in a Popover panel anchored near the clicked Target Chip, instead of inline expansion. The Popover SHALL contain: agent and location labels, a mode selector (dropdown for Auto/Manual/Disabled), last sync timestamp (or "Not synced" in pending color), drift warning (if any), and action buttons (view, open folder, delete) in ghost button style. The Popover interior SHALL use no hard borders, relying on subtle spacing and dividers. Targets with pending or missing states SHALL have their status visually emphasized through semantic theme colors. The Popover SHALL close when the user clicks outside it or presses Escape. Only one Target Popover SHALL be open at a time; opening a new one SHALL close the previous.

#### Scenario: Opening target popover

- **GIVEN** a skill has targets displayed as collapsed chips
- **WHEN** the user clicks a specific Target Chip
- **THEN** a Popover panel SHALL appear anchored near the clicked chip, showing that target's detail fields

#### Scenario: Popover shows sync timestamp

- **WHEN** a Target Popover is open for a synced target
- **THEN** the Popover SHALL display the last sync timestamp

##### Example: Synced target with timestamp

- **GIVEN** a target claude·global·auto with lastSync.at = "2026-06-01T10:30:00Z"
- **WHEN** the user clicks its chip to open the Popover
- **THEN** the Popover displays "Synced 10:30" in the status field

##### Example: Pending target without timestamp

- **GIVEN** a target gemini·project·manual with no lastSync entry
- **WHEN** the user clicks its chip to open the Popover
- **THEN** the Popover displays "Not synced" in pending color in the status field

#### Scenario: Closing popover

- **GIVEN** a Target Popover is open
- **WHEN** the user clicks outside the Popover or presses Escape
- **THEN** the Popover SHALL close

#### Scenario: Only one popover at a time

- **GIVEN** a Target Popover is open for target A
- **WHEN** the user clicks the chip for target B
- **THEN** target A's Popover SHALL close and target B's Popover SHALL open

### Requirement: SyncInfoBar Removal

The independent SyncInfoBar component SHALL be removed from SkillsPage rendering. All sync status information SHALL be accessible exclusively through the Target Chips area (status icons in collapsed state, detail fields in Popover).

#### Scenario: SyncInfoBar removal

- **WHEN** the SkillsPage renders a selected skill
- **THEN** no independent SyncInfoBar component SHALL be rendered
- **AND** all sync status information SHALL be accessible exclusively through the Target Chips area
