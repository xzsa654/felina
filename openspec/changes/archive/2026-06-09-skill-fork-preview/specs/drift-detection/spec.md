## MODIFIED Requirements

### Requirement: Batch Drift Scan API

The batch drift scan SHALL classify Forked targets into four sub-statuses (clean, edited, canonicalAhead, diverged) rather than treating them as non-drifted. The drift scan SHALL compute fork status by comparing canonical hash against base_snapshot and forked hash against pushed_hash. Forked targets SHALL NOT trigger pull-back suggestions regardless of their fork status.

#### Scenario: Drift scan results used for SkillList indicator

- **GIVEN** the drift scan has completed and returned DriftStatus per skill per target
- **WHEN** the SkillList is rendered
- **THEN** each skill entry SHALL reflect whether any of its targets are in Drifted state based on the scan results

#### Scenario: Drift scan classifies forked target

- **GIVEN** a skill with a Forked target whose agent-side content differs from pushed_hash
- **WHEN** the batch drift scan runs
- **THEN** the Forked target SHALL be classified with fork_status edited
- **AND** the target SHALL NOT be classified as drifted (drift is for Auto/Manual targets only)

#### Scenario: Drift scan with forked-diverged target

- **GIVEN** a Forked target where both canonical has changed since base_snapshot and agent-side has changed since pushed_hash
- **WHEN** the batch drift scan runs
- **THEN** the Forked target SHALL be classified with fork_status diverged
