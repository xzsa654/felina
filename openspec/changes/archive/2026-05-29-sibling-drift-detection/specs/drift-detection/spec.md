## MODIFIED Requirements

### Requirement: Shared Drift Check Function

MODIFY scenario:

#### Scenario: check_drift detects sibling file changes

- **GIVEN** a skill has been pushed with sibling files and their hashes recorded in sync meta
- **WHEN** an agent-side sibling file's content has been modified since the last push
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift detects sibling file deletion

- **GIVEN** a skill has been pushed with sibling files and their hashes recorded in sync meta
- **WHEN** an agent-side sibling file that existed at push time has been deleted
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift detects new sibling file on agent side

- **GIVEN** a skill has been pushed with sibling hashes recorded in sync meta
- **WHEN** a new file exists in the agent-side skill directory that was not present at push time
- **THEN** `check_drift` SHALL return drifted status

#### Scenario: check_drift treats missing sibling hashes as legacy (no comparison)

- **GIVEN** the sync meta was written before sibling hash tracking was introduced
- **WHEN** the `sibling_hashes` field is absent from the sync meta (`None`)
- **THEN** `check_drift` SHALL skip sibling comparison entirely
- **AND** `check_drift` SHALL NOT report drift due to agent-side sibling files

#### Scenario: check_drift detects agent-side additions when push had no siblings

- **GIVEN** a skill was pushed with no sibling files (`sibling_hashes` is `Some({})`)
- **WHEN** a new file is added on the agent side
- **THEN** `check_drift` SHALL return drifted status

### Requirement: Drift Scan Performance Optimization

ADD scenario:

#### Scenario: Sibling hash computation runs in parallel with SKILL.md check

- **WHEN** the batch drift scan processes a target that requires hash computation
- **THEN** sibling file hashes SHALL be computed as part of the same parallel work unit as the SKILL.md hash
- **AND** the combined result SHALL reflect both SKILL.md and sibling drift status

### Requirement: Canonical Sibling Change Detection

When loading the skill list, the system SHALL compare canonical sibling files against the `sibling_hashes` recorded in each target's `last_sync` entry. If the canonical siblings differ from any target's recorded hashes, the skill SHALL be marked as dirty with `siblings_dirty` set to true. When `sibling_hashes` is absent (legacy meta), the system SHALL NOT compare siblings. When `sibling_hashes` is an empty map (no siblings at push time) and canonical now has siblings, the skill SHALL be marked dirty.

#### Scenario: Canonical sibling added after push triggers dirty

- **GIVEN** a skill was pushed with no sibling files (empty `sibling_hashes`)
- **WHEN** a sibling file is added to the canonical skill directory
- **THEN** the skill list SHALL report `dirty: true` and `siblingsDirty: true`

#### Scenario: Canonical sibling modified after push triggers dirty

- **GIVEN** a skill was pushed with sibling files recorded in `sibling_hashes`
- **WHEN** a canonical sibling file's content changes
- **THEN** the skill list SHALL report `dirty: true` and `siblingsDirty: true`

#### Scenario: Legacy meta does not trigger false dirty

- **GIVEN** a skill's sync meta has no `sibling_hashes` field (legacy)
- **WHEN** the canonical skill directory contains sibling files
- **THEN** the skill list SHALL NOT set `siblingsDirty: true`

### Requirement: Push Preview Considers Sibling Changes

The push preview operation SHALL compare canonical sibling file hashes against `lastSync.siblingHashes`. When SKILL.md content is unchanged but canonical siblings differ from recorded hashes, the preview operation SHALL be Overwrite (not NoOp), ensuring that `copy_bundled_siblings` executes during commit.

#### Scenario: SKILL.md unchanged but siblings changed shows Overwrite

- **GIVEN** a skill's SKILL.md has not changed since last push
- **AND** a sibling file was added, modified, or removed in the canonical directory
- **WHEN** the push preview is computed
- **THEN** the operation SHALL be Overwrite

### Requirement: SyncInfoBar Sibling Dirty Indicator

The SyncInfoBar component SHALL display a warning message when the skill's `siblingsDirty` flag is true, informing the user that bundled files have changed and a push is needed to sync.

#### Scenario: SyncInfoBar shows sibling dirty message

- **WHEN** a skill has `siblingsDirty: true`
- **THEN** the SyncInfoBar SHALL display a localized message indicating bundled files have changed

### Requirement: Sibling Hash Recording on Push

The fan-out push flow SHALL record a hash map of all bundled sibling files in the sync meta after a successful push. The hash map SHALL use forward-slash relative paths as keys and raw SHA-256 hex strings as values. Files named `SKILL.md` and `.felina-sync-meta.json` SHALL be excluded from the sibling hash map.

#### Scenario: Push records sibling hashes in sync meta

- **GIVEN** a canonical skill directory contains SKILL.md and additional files (e.g., `script/run.py`, `templates/prompt.txt`)
- **WHEN** the skill is pushed to a target
- **THEN** the sync meta `last_sync` for that target SHALL include a `sibling_hashes` map
- **AND** each entry SHALL map the file's forward-slash relative path to its raw SHA-256 hex hash

#### Scenario: Push with no siblings records empty hash map

- **GIVEN** a canonical skill directory contains only SKILL.md
- **WHEN** the skill is pushed to a target
- **THEN** the sync meta `last_sync.sibling_hashes` SHALL be an empty map
