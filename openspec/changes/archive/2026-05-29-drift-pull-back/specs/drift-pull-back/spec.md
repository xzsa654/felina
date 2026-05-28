## ADDED Requirements

### Requirement: Pull from Drifted Target

The system SHALL provide a one-shot "Pull" operation that reads the content of a drifted agent target skill file and overwrites the corresponding canonical SKILL.md with that content.

#### Scenario: Successful pull from a drifted target

- **GIVEN** a canonical skill with a target whose DriftStatus is Drifted
- **WHEN** the user initiates a Pull operation for that target
- **THEN** the system SHALL read the target-side skill file content
- **AND** overwrite the canonical SKILL.md with the target content
- **AND** update the sidecar's pushed_hash to the semantic hash of the new content
- **AND** update the sidecar's lastSync.at to the current timestamp
- **AND** set the sidecar dirty flag to false

#### Scenario: Pull when target file is missing

- **GIVEN** a canonical skill with a target whose file does not exist on disk
- **WHEN** the user initiates a Pull operation for that target
- **THEN** the system SHALL return an error indicating the target file path is missing
- **AND** the canonical SKILL.md SHALL remain unchanged

### Requirement: Pull Confirmation

The system SHALL display a confirmation dialog before executing a Pull operation, warning the user that the canonical skill content will be overwritten by the target-side content.

#### Scenario: User confirms pull

- **GIVEN** the Pull confirmation dialog is displayed
- **WHEN** the user confirms the operation
- **THEN** the system SHALL execute the Pull operation

#### Scenario: User cancels pull

- **GIVEN** the Pull confirmation dialog is displayed
- **WHEN** the user cancels the operation
- **THEN** the system SHALL not modify the canonical skill

### Requirement: SkillList Drift Indicator

The system SHALL display a visual drift indicator on each SkillList entry that has at least one target in Drifted state, enabling users to identify drifted skills without selecting them individually.

#### Scenario: Skill with drifted target shows indicator

- **GIVEN** a canonical skill has one or more targets with DriftStatus Drifted
- **WHEN** the SkillList is rendered
- **THEN** the entry for that skill SHALL display a warning indicator icon

#### Scenario: Skill with no drifted targets hides indicator

- **GIVEN** a canonical skill has no targets with DriftStatus Drifted
- **WHEN** the SkillList is rendered
- **THEN** the entry for that skill SHALL NOT display a drift indicator icon

### Requirement: Pull Button in TargetEditor

The system SHALL display a "Pull" button next to each target row in the TargetEditor when that target's DriftStatus is Drifted. The button SHALL be hidden or disabled when the target is not in Drifted state.

#### Scenario: Drifted target shows Pull button

- **GIVEN** a target with DriftStatus Drifted is displayed in the TargetEditor
- **WHEN** the TargetEditor is rendered
- **THEN** a "Pull" button SHALL be visible and enabled for that target

#### Scenario: Synced target hides Pull button

- **GIVEN** a target with DriftStatus Synced is displayed in the TargetEditor
- **WHEN** the TargetEditor is rendered
- **THEN** no "Pull" button SHALL be displayed for that target
