## MODIFIED Requirements

### Requirement: Pending-Push Sync State

The system SHALL track, per skill, whether the canonical content has changed since its last successful push (a dirty flag) and the timestamp of the last successful push. Editing and saving a canonical skill SHALL set its dirty flag. A successful push SHALL clear the dirty flag and update the last-synced timestamp. The system SHALL NOT push automatically on save. The Skills page SHALL surface aggregate pending changes through a persistent banner that offers a single action to push all dirty skills, and SHALL also offer a per-skill push action. The Push all preview and confirmation dialog SHALL include only dirty skills that have at least one pushable target.

#### Scenario: Editing marks a skill dirty

- **WHEN** a user edits and saves a canonical skill
- **THEN** the system SHALL set that skill's dirty flag
- **AND** the Skills page SHALL display a dirty indicator on that skill's row

#### Scenario: Pending-push bar reflects dirty count

- **WHEN** three skills are dirty and unpushed
- **THEN** the Skills page SHALL display a banner indicating three skills changed since last sync
- **AND** the banner SHALL offer a single action to push all of them

#### Scenario: Push all preview lists only affected skills

- **GIVEN** skill "alpha" is dirty and has at least one pushable target
- **AND** skill "beta" is clean and has at least one target
- **AND** skill "gamma" is dirty but has no pushable targets
- **WHEN** the user clicks Push all
- **THEN** the preview and confirmation dialog SHALL list "alpha"
- **AND** the preview and confirmation dialog SHALL NOT list "beta"
- **AND** the preview and confirmation dialog SHALL NOT list "gamma"

#### Scenario: Push all commit operates on previewed skills only

- **GIVEN** the Push all preview contains only skill "alpha"
- **WHEN** the user confirms Push all
- **THEN** the system SHALL commit sync only for "alpha"
- **AND** the system SHALL NOT commit sync for clean or targetless skills that were excluded from the preview

#### Scenario: Push clears dirty state

- **WHEN** a user pushes a dirty skill and all its targets succeed
- **THEN** the system SHALL clear that skill's dirty flag
- **AND** the system SHALL update its last-synced timestamp

#### Scenario: Save does not auto-push

- **WHEN** a user saves a canonical skill
- **THEN** the system SHALL NOT write to any agent-native skill directory until the user explicitly pushes
