## MODIFIED Requirements

### Requirement: Pull Preview Shows Sibling Changes

The pull preview SHALL include a list of sibling file changes in addition to the SKILL.md body diff. Each sibling change SHALL indicate the file path and its status: added (exists on agent side only), modified (content differs and canonical side unchanged since push), deleted (removed on agent side), or conflict (both sides changed since push).

#### Scenario: Pull preview includes added sibling

- **GIVEN** a sibling file exists in the agent-side skill directory but not in the canonical directory
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as added

#### Scenario: Pull preview includes deleted sibling

- **GIVEN** a sibling file existed at push time but has been deleted from the agent-side directory
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as deleted

#### Scenario: Pull preview detects conflict

- **GIVEN** a sibling file has been modified on both canonical and agent sides since the last push
- **WHEN** the user requests a pull preview
- **THEN** the preview SHALL list the sibling as conflict

### Requirement: Pull Executes Sibling Sync

The pull operation SHALL synchronize sibling files from the agent-side directory to the canonical directory according to their status and user-specified resolutions for conflicts.

#### Scenario: Pull copies added sibling to canonical

- **GIVEN** the pull preview lists a sibling as added
- **WHEN** the user confirms the pull
- **THEN** the sibling file SHALL be copied from agent side to canonical directory

#### Scenario: Pull deletes removed sibling from canonical

- **GIVEN** the pull preview lists a sibling as deleted
- **WHEN** the user confirms the pull
- **THEN** the sibling file SHALL be removed from canonical directory

#### Scenario: Pull resolves conflict per user choice

- **GIVEN** the pull preview lists a sibling as conflict
- **AND** the user selects "use agent version" for that sibling
- **WHEN** the pull executes
- **THEN** the canonical sibling SHALL be overwritten with the agent-side version

#### Scenario: Pull with legacy meta (no sibling hashes)

- **GIVEN** the sync meta's `sibling_hashes` field is `None` (legacy meta, written before sibling hash tracking)
- **WHEN** the user requests a pull preview
- **THEN** `sibling_changes` SHALL be empty
- **AND** pull behavior SHALL be identical to the current SKILL.md-only flow

#### Scenario: Pull with empty sibling hashes (push had no siblings)

- **GIVEN** the sync meta's `sibling_hashes` is `Some({})` (push recorded no siblings)
- **AND** agent-side skill directory contains sibling files
- **WHEN** the user requests a pull preview
- **THEN** all agent-side siblings SHALL be listed as `added` in `sibling_changes`
