## MODIFIED Requirements

### Requirement: Fan-Out Sync

ADD scenario:

#### Scenario: Auto push after canonical save

- **GIVEN** a canonical skill with one or more targets configured as mode `auto` and `enabled=true`
- **WHEN** the canonical skill is saved via `canonical_skills_write` or `canonical_skills_write_raw`
- **THEN** the system SHALL automatically push the rendered content to all auto-enabled targets without requiring user confirmation
- **AND** update each pushed target's sidecar entry (pushed_hash, lastSync.at)
- **AND** set the skill's dirty flag to false if all auto pushes succeed

#### Scenario: Auto push after pull

- **GIVEN** a canonical skill with auto-enabled targets
- **WHEN** the user pulls content from a drifted target via `skill_pull_from_target`
- **THEN** the system SHALL automatically push the updated canonical content to all auto-enabled targets

#### Scenario: Manual targets unaffected by auto push

- **GIVEN** a canonical skill with both auto and manual targets
- **WHEN** the canonical skill is saved
- **THEN** only targets with mode `auto` and `enabled=true` SHALL receive the automatic push
- **AND** targets with mode `manual` SHALL remain unchanged until the user manually triggers a push

### Requirement: Skill Target Configuration

ADD scenario:

#### Scenario: Target mode includes auto option

- **GIVEN** a user is configuring a skill target in the TargetEditor
- **WHEN** the mode toggle is displayed
- **THEN** the available options SHALL be Auto, Manual, and Disabled
- **AND** Auto SHALL set the target to mode `auto` with `enabled=true`
- **AND** Manual SHALL set the target to mode `manual` with `enabled=true`
- **AND** Disabled SHALL set the target to `enabled=false`

### Requirement: Sidecar Backward Compatibility

ADD scenario:

#### Scenario: Legacy tracked mode read as manual

- **GIVEN** a sidecar JSON file containing a target with mode value `tracked`
- **WHEN** the system reads the sidecar
- **THEN** the target's mode SHALL be interpreted as `manual`
