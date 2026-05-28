## MODIFIED Requirements

### Requirement: Batch Drift Scan API

ADD scenario:

#### Scenario: Drift scan results used for SkillList indicator

- **GIVEN** the drift scan has completed and returned DriftStatus per skill per target
- **WHEN** the SkillList is rendered
- **THEN** each skill entry SHALL reflect whether any of its targets are in Drifted state based on the scan results
