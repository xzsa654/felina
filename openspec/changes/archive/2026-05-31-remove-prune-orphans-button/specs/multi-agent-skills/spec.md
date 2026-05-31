## REMOVED Requirements

### Requirement: Explicit Orphan Prune

**Reason**: The manual prune orphan scan/delete workflow is redundant. Users can already remove agent-side files when deleting a target via "Remove target and delete file". Push-time automatic orphan sibling cleanup (cleanup_orphan_siblings in fan_out) handles the remaining cases.

**Migration**: Users who previously used the "Prune orphans" button to clean up orphaned agent-side files SHALL instead use "Remove target and delete file" when removing a target. No data migration is needed.

## MODIFIED Requirements

### Requirement: Explicit Target Removal Policy

Removing a target row from a skill's target list SHALL require the user to choose Remove target only, Remove target and delete file, or Cancel. Remove target only SHALL remove the target from sync-meta and SHALL leave the resolved agent-side skill directory on disk. Remove target and delete file SHALL remove the target from sync-meta and attempt to delete only that target's resolved agent-side skill directory. Cancel SHALL leave the target list and agent-side files unchanged. When the removed target had a `last_sync` entry, the system SHALL remove that entry from sync-meta after the target row is removed.

#### Scenario: Remove target only leaves files on disk

- **GIVEN** skill `shared-util` has a Gemini project target whose agent-side skill directory exists
- **WHEN** the user removes the target and chooses Remove target only
- **THEN** the target row is removed from the sync-meta target list
- **AND** the Gemini agent-side skill directory remains on disk

#### Scenario: Remove target and delete file deletes only that target destination

- **GIVEN** skill `shared-util` has Anthropic and Gemini targets with agent-side skill directories on disk
- **WHEN** the user removes only the Gemini target and chooses Remove target and delete file
- **THEN** the Gemini target row is removed from sync-meta
- **AND** the Gemini agent-side skill directory for `shared-util` is deleted if it is resolvable
- **AND** the Anthropic target row and Anthropic agent-side skill directory are unchanged

#### Scenario: Cancel target removal preserves state

- **WHEN** the user chooses Cancel in the target removal confirmation
- **THEN** the target list and all agent-side files remain unchanged
