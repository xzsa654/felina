## MODIFIED Requirements

### Requirement: Pull from Drifted Target

#### MODIFIED Scenario: Successful pull from a drifted target

- **GIVEN** a canonical skill with a target whose DriftStatus is Drifted
- **WHEN** the user initiates a Pull operation for that target
- **THEN** the system SHALL first display a diff preview showing line-level differences between canonical and target content
- **AND** wait for the user to confirm or cancel
- **WHEN** the user confirms the pull
- **THEN** the system SHALL read the target-side skill file content
- **AND** overwrite the canonical SKILL.md with the target content
- **AND** update the sidecar's pushed_hash to the semantic hash of the new content
- **AND** update the sidecar's lastSync.at to the current timestamp
- **AND** set the sidecar dirty flag to false
