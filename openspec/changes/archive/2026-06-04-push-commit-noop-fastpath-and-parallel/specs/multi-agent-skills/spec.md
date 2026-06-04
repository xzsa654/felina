## ADDED Requirements

### Requirement: Push Commit NoOp Fast-Path

When a push commit processes a target whose operation is NoOp, the system SHALL compare the target's current content hash against the last synced pushed hash for that target key. When both hashes are identical, the system SHALL skip the canonical snapshot operation and SHALL skip recomputing sibling file hashes for that target. The system SHALL still update the last sync timestamp to the current attempt time so that downstream mtime-based drift detection fast-paths remain valid. The system SHALL preserve the existing base snapshot identifier and existing sibling hash map from the prior sync entry. When the hashes differ, the system SHALL execute the full NoOp path including snapshot and sibling hash computation.

#### Scenario: NoOp with unchanged hash skips snapshot and sibling hash

- **GIVEN** skill `my-util` has a target with key `claude:global` whose last synced pushed hash is `abc123`
- **AND** the current preview item for that target reports rendered hash `abc123` with operation NoOp
- **WHEN** push commit processes this target
- **THEN** the system does not invoke the canonical snapshot operation for this skill
- **AND** the system does not recompute sibling file hashes for this target
- **AND** the last sync entry for `claude:global` has its timestamp updated to the current attempt time
- **AND** the last sync entry preserves the prior base snapshot identifier and sibling hash map

#### Scenario: NoOp with changed hash executes full path

- **GIVEN** skill `my-util` has a target with key `claude:global` whose last synced pushed hash is `abc123`
- **AND** the current preview item for that target reports rendered hash `def456` with operation NoOp
- **WHEN** push commit processes this target
- **THEN** the system invokes the canonical snapshot operation
- **AND** the system recomputes sibling file hashes for this target directory
- **AND** the last sync entry for `claude:global` records the new snapshot, new sibling hashes, and current attempt time

### Requirement: Push All Inter-Skill Parallel Execution

When push all commit processes multiple skills, the system SHALL execute per-skill push operations concurrently across available threads rather than sequentially. The maximum concurrency SHALL be bounded by the lesser of eight threads and the number of available CPU parallelism units. Each per-skill push SHALL operate on its own independent canonical directory and sync metadata. The collected results SHALL contain the same entries in any order as a sequential execution would produce. Within a single skill, per-target processing SHALL remain sequential to avoid concurrent mutation of shared sync metadata.

#### Scenario: Push All processes skills concurrently

- **GIVEN** skills `alpha`, `beta`, and `gamma` each have one dirty target requiring push
- **WHEN** push all commit is invoked
- **THEN** the system processes the three skills concurrently rather than sequentially
- **AND** the result set contains one SyncResult entry per target across all three skills
- **AND** each skill's sync metadata is updated independently without cross-skill interference

#### Scenario: Push All with single skill behaves identically to single push

- **GIVEN** only skill `alpha` has dirty targets
- **WHEN** push all commit is invoked
- **THEN** the result is identical to invoking single skill push commit for `alpha`
