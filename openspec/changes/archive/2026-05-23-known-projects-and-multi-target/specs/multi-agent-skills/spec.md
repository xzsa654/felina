## MODIFIED Requirements

### Requirement: Per-Skill Target Model

Each canonical skill SHALL carry a per-skill target list that drives fan-out. The list SHALL be persisted in that skill's sync-meta sidecar (`.felina-sync-meta.json`) as schema version 2 with shape `{ version: 2, targets: [{ agent, scope, project?, enabled, mode }], last_sync: { <targetKey>: { pushed_hash, base_snapshot?, at } }, dirty }`. The `agent` field SHALL be one of `anthropic`, `codex`, `gemini`. The `scope` field SHALL be `global` or `project`; when `scope` is `project` the target SHALL include a `project` field naming the project root path. The `enabled` field SHALL be a boolean. The `mode` field SHALL be one of `tracked` (push overwrites the agent-side file), `detached` (the target is skipped by push), or `forked` (reserved for future overlay-based customization, not implemented by this capability). The `last_sync` map SHALL be keyed by a stable per-target identifier and SHALL store the content hash written at the last successful push, the timestamp of that push, and an optional `base_snapshot` field reserved for future fork resolution.

The target list SHALL be user-edited, not derived from the skill `agents` frontmatter field. A newly created canonical skill SHALL be written with an empty `targets` array; the system SHALL NOT populate targets from the `agents` field at creation or edit time. The skill `agents` frontmatter field SHALL be retained as metadata and SHALL NOT drive fan-out. A sync-meta sidecar that is schema version 2 with an empty `targets` array SHALL be treated as a skill with no targets (not as an un-backfilled sidecar), and the system SHALL NOT derive targets from `agents` for it.

As a one-time legacy migration, when a sidecar lacks a `version` field or a `targets` array (schema version 1), the system SHALL backfill targets at read time by emitting one `{ agent, scope, project?, enabled: true, mode: tracked }` entry for each value in the skill `agents` frontmatter field paired with the skill own scope and project, and SHALL preserve any existing `dirty` and `last_synced` values into the v2 structure. Once the skill has been written as schema version 2 (including with an empty target list), the system SHALL NOT perform agents-based backfill again.

#### Scenario: New skill is created with empty targets

- **WHEN** a user creates a new canonical skill
- **THEN** the skill's sync-meta sidecar SHALL be schema version 2 with an empty `targets` array
- **AND** the system SHALL NOT derive any target from the skill `agents` frontmatter field

#### Scenario: Empty v2 targets are not backfilled from agents

- **WHEN** a skill has a schema version 2 sidecar with an empty `targets` array and a non-empty `agents` frontmatter field
- **THEN** the system SHALL report the skill as having no targets
- **AND** the system SHALL NOT emit any target derived from the `agents` field

#### Scenario: Legacy v1 sidecar is backfilled once at read time

- **WHEN** a project-scope skill on disk has `agents: [anthropic, codex]` and its sidecar predates schema v2 (no `version` field, no `targets` field) and records `dirty: false` with a previous `last_synced` timestamp
- **THEN** the system SHALL produce two backfilled targets, one for `{ agent: anthropic, scope: project, project: <skill project root>, enabled: true, mode: tracked }` and one for `{ agent: codex, scope: project, project: <skill project root>, enabled: true, mode: tracked }`
- **AND** the system SHALL preserve `dirty: false` and the previous `last_synced` value in the v2 structure

#### Scenario: Detached target is excluded from fan-out

- **WHEN** a skill target list contains a target with `mode: detached`
- **THEN** the system SHALL NOT include that target when fan-out enumerates write destinations
- **AND** the system SHALL NOT update that target `last_sync` entry as a result of any push

### Requirement: Visual Frontmatter Editor

The system SHALL present skill frontmatter through a visual form and SHALL NOT expose a raw YAML editing surface for the canonical SKILL.md. The editor SHALL render one input control per canonical field appropriate to its type (text input, boolean toggle, or enumerated dropdown), with the exception of the `agents` field, which SHALL NOT be rendered as an editable control because fan-out targets are governed by the per-skill target list rather than `agents`. The `agents` field SHALL be retained verbatim in the canonical frontmatter as metadata across edits. Low-frequency optional fields SHALL be grouped under a collapsible advanced section. The Markdown body SHALL be edited in a plain text area. The form SHALL serialize to and deserialize from the canonical snake_case YAML so that the user never needs to know agent-specific field naming.

#### Scenario: Edit frontmatter via the form

- **WHEN** a user opens a skill in the editor
- **THEN** the system SHALL render the frontmatter as form controls, not as raw YAML text
- **AND** saving the form SHALL serialize the values back into canonical snake_case YAML

#### Scenario: Agents field is not an editable control

- **WHEN** a user opens a skill in the editor
- **THEN** the system SHALL NOT render an `agents` selection control in the frontmatter form
- **AND** saving the form SHALL preserve the existing `agents` value in the canonical frontmatter unchanged

#### Scenario: No raw YAML surface

- **WHEN** a user is editing a skill
- **THEN** the system SHALL NOT provide a raw YAML editing tab or a switch-to-YAML mode for the frontmatter

## ADDED Requirements

### Requirement: Per-Skill Target Editor

The system SHALL allow a user to explicitly edit a canonical skill's target list. The system SHALL support adding a target by choosing an agent (`anthropic`, `codex`, or `gemini`) and a scope (`global` or `project`); a target added through this capability SHALL default to `enabled: true` and `mode: tracked`. For a `project`-scope target, the project SHALL be chosen from the known-projects list, restricted in this capability to the current project; selecting a project other than the current one SHALL NOT be permitted in this capability. The system SHALL support setting each target's state to exactly one of Tracked (`enabled: true`, `mode: tracked`), Detached (`enabled: true`, `mode: detached`), or Disabled (`enabled: false`). The `forked` mode SHALL NOT be selectable in this capability. The system SHALL support removing a single target from the list. Saving an edited target list SHALL overwrite the sidecar `targets` array and SHALL prune any `last_sync` entry whose key no longer corresponds to a target in the new list, while preserving `last_sync` entries for targets that remain.

#### Scenario: Add a target to an empty skill

- **WHEN** a skill has an empty target list and the user adds an anthropic global target
- **THEN** the sidecar `targets` array SHALL contain one entry `{ agent: anthropic, scope: global, enabled: true, mode: tracked }`
- **AND** a subsequent push SHALL write the anthropic global target

#### Scenario: Removing a target prunes its last_sync entry

- **WHEN** a skill has two targets each with a recorded `last_sync` entry and the user removes one target
- **THEN** the saved `targets` array SHALL contain only the remaining target
- **AND** the `last_sync` map SHALL retain the remaining target's entry and SHALL NOT contain the removed target's key

#### Scenario: Setting a target to Disabled excludes it from push

- **WHEN** the user sets a target's state to Disabled
- **THEN** the target SHALL be persisted with `enabled: false`
- **AND** a subsequent push SHALL skip that target

### Requirement: Explicit Orphan Prune

The system SHALL provide an explicit action that scans for and removes orphaned agent-side skill files for a given canonical skill. An orphan SHALL be defined as an agent-side `SKILL.md` (under an agent skill directory resolved for the skill's reachable scopes) belonging to the skill but whose corresponding target is absent from the current target list or is in `detached` or `disabled` state. The scan SHALL return the list of orphan paths without deleting anything. Deletion SHALL occur only after explicit user confirmation and SHALL remove each confirmed orphan together with its skill subdirectory, isolating per-file failures so that one failed deletion does not abort the others. The system SHALL NOT delete agent-side files automatically when a target is toggled to Detached or Disabled.

#### Scenario: Scan identifies orphaned agent files

- **WHEN** a skill's target list no longer contains a gemini target but a gemini agent directory still holds that skill's `SKILL.md`
- **THEN** the scan SHALL include that gemini `SKILL.md` path in its result
- **AND** the scan SHALL NOT include agent files for targets still present and tracked in the list

#### Scenario: Prune deletes only confirmed orphans

- **WHEN** the scan returns two orphan paths and the user confirms deletion of both
- **THEN** the system SHALL delete both orphan files and their skill subdirectories
- **AND** agent files for targets remaining in the list SHALL NOT be deleted

#### Scenario: Toggling Detached does not auto-delete

- **WHEN** the user sets a target's state to Detached
- **THEN** the corresponding agent-side `SKILL.md` SHALL remain on disk
- **AND** removal SHALL require running the explicit prune action with confirmation
