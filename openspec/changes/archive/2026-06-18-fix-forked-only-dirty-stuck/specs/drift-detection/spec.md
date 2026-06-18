## ADDED Requirements

### Requirement: Dirty Flag Excludes Forked-Only Skills

The system SHALL NOT set the dirty flag to true on a canonical skill when all enabled targets are in Forked or Detached mode. The dirty flag SHALL only be set to true when at least one enabled target is in Auto or Manual mode.

#### Scenario: Forked-only skill canonical edit does not set dirty

- **GIVEN** a canonical skill with one enabled target in Forked mode and no Auto or Manual targets
- **WHEN** the user modifies the canonical skill content (e.g., via target repoint or rename)
- **THEN** the system SHALL NOT set dirty to true on the sync metadata

##### Example: forked-only dirty table

| Enabled Targets | Modes | Canonical modified | Expected dirty |
| --- | --- | --- | --- |
| 1 | Forked | yes | false |
| 2 | Forked, Detached | yes | false |
| 2 | Auto, Forked | yes | true |
| 1 | Auto | yes | true |
| 1 | Manual | yes | true |

#### Scenario: Mixed targets still set dirty when pushable exists

- **GIVEN** a canonical skill with two enabled targets: one Auto and one Forked
- **WHEN** the user modifies the canonical skill content
- **THEN** the system SHALL set dirty to true because an Auto target exists

### Requirement: Push Preview Clears Stale Dirty When Nothing To Sync

When generating a push preview for a canonical skill whose dirty flag is currently true, the system SHALL clear the dirty flag to false and persist the sync metadata if every preview item resolves to a no-op or skipped operation (no Create, Overwrite, BlockedDrift, or OverwriteUnknown item). If any preview item is a pending write operation (Create, Overwrite, BlockedDrift, or OverwriteUnknown), the system SHALL leave the dirty flag unchanged.

This recovers skills that are effectively in sync but whose dirty flag was left stuck because the frontend does not invoke the commit path when the preview contains nothing to write.

#### Scenario: Unchanged-manual plus forked preview clears stuck dirty

- **GIVEN** a canonical skill with dirty currently true and two enabled targets: one Manual whose rendered output matches the already-pushed content (NoOp) and one Forked (Skipped)
- **WHEN** the system generates the push preview for that skill
- **THEN** the system SHALL set dirty to false and persist the sync metadata

#### Scenario: Pending write in preview leaves dirty unchanged

- **GIVEN** a canonical skill with dirty currently true and one enabled Manual target whose rendered output differs from the already-pushed content (Overwrite)
- **WHEN** the system generates the push preview for that skill
- **THEN** the system SHALL leave dirty as true because a pending write operation exists

##### Example: preview dirty-recovery table

| Dirty before | Item operations | Expected dirty after preview |
| --- | --- | --- |
| true | NoOp, Skipped | false |
| true | Skipped | false |
| true | NoOp | false |
| true | Overwrite | true |
| true | NoOp, Overwrite | true |
| false | NoOp, Skipped | false |
