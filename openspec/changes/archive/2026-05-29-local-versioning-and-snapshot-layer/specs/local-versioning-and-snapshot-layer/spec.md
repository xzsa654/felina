## ADDED Requirements

### Requirement: Global Git Repository

The system SHALL initialize and maintain a single hidden Git repository at the root of the canonical skills directory (`~/.felina/skills/.git`).

#### Scenario: Initialization on first use

- **GIVEN** the application needs to commit a snapshot and `~/.felina/skills/.git` does not exist
- **WHEN** the snapshot commit is triggered
- **THEN** the system SHALL initialize a standard git repository in that location

#### Scenario: Existing repository is reused

- **GIVEN** `~/.felina/skills/.git` already exists (whether created by Felina or externally)
- **WHEN** the snapshot commit is triggered
- **THEN** the system SHALL open the existing repository without reinitializing

---

### Requirement: Snapshot Commits on Push

The system SHALL record a new commit in the global Git repository containing the canonical skill files whenever a skill is successfully pushed (fan-out) to a target.

#### Scenario: Successful push creates a commit

- **GIVEN** a canonical skill is modified and a push to a target succeeds
- **WHEN** the push operation completes
- **THEN** the system SHALL stage all files under the skill's canonical directory
- **AND** create a commit with message format `push: <skill-name> → <target-key>`
- **AND** write the resulting 40-character Git commit hash into `lastSync[target].base_snapshot`

#### Scenario: Snapshot failure does not block push

- **GIVEN** a push to a target succeeds but the git commit operation fails (e.g., permission error, corrupt repository)
- **WHEN** the snapshot commit returns an error
- **THEN** the push SHALL still succeed
- **AND** `base_snapshot` SHALL remain unchanged (retaining its previous value or `null`)
- **AND** the system SHALL log a warning

---

### Requirement: Snapshot Content Retrieval

The system SHALL provide an internal API to retrieve the content of a canonical skill file at a specific commit, identified by the 40-character commit hash stored in `base_snapshot`.

#### Scenario: Retrieving base content for diff preview

- **GIVEN** a target's `base_snapshot` contains a valid commit hash
- **WHEN** the system requests the content of `<skill-name>/SKILL.md` at that commit
- **THEN** the system SHALL return the file content as it existed at that commit
- **AND** SHALL NOT require a working-tree checkout

#### Scenario: Missing or invalid base_snapshot

- **GIVEN** a target's `base_snapshot` is `null` or contains an invalid hash
- **WHEN** the system requests snapshot content
- **THEN** the system SHALL return `None` (no content available)
- **AND** SHALL NOT raise an error
