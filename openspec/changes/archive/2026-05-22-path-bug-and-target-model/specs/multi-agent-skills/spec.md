## MODIFIED Requirements

### Requirement: Fan-Out to Agent Targets

The system SHALL render a canonical skill into each entry of that skill's per-skill target list (see Per-Skill Target Model). Fan-out SHALL be one-directional (canonical to agent); the system SHALL NOT read agent-native files back into canonical in this capability. Targets whose `enabled` field is false or whose `mode` is `detached` SHALL be skipped. For each remaining target, the system SHALL apply that target agent's field mapping as defined by the agent-skills-schema reference: Anthropic SHALL rename snake_case fields to kebab-case and write a single `SKILL.md`; Codex SHALL write `SKILL.md` with `name` and `description` plus a sibling `agents/openai.yaml` for UI metadata; Gemini SHALL write `SKILL.md` containing only `name` and `description` and ignore other fields. When a target directory does not exist, the system SHALL create it. When a target write fails, the system SHALL report that target as failed without aborting the other targets. After a successful per-target write, the system SHALL record the target's pushed content hash and timestamp in the sync-meta sidecar `last_sync` entry for that target.

#### Scenario: Push a skill whose targets cover all three agents

- **WHEN** a user pushes a skill whose target list contains one enabled tracked target per agent (anthropic, codex, gemini) at the same scope
- **THEN** the system SHALL write the Anthropic target with kebab-case frontmatter
- **AND** the system SHALL write the Codex target as a `SKILL.md` plus a sibling `agents/openai.yaml`
- **AND** the system SHALL write the Gemini target containing only `name` and `description`

#### Scenario: Push to a subset of agents

- **WHEN** a user pushes a skill whose target list contains only one enabled tracked target for anthropic
- **THEN** the system SHALL write only the Anthropic target
- **AND** the system SHALL NOT create or modify the Codex or Gemini target directories for that skill

#### Scenario: Disabled or detached targets are skipped

- **WHEN** a user pushes a skill whose target list contains an `enabled: false` target and a `mode: detached` target
- **THEN** the system SHALL NOT write either of those targets
- **AND** the system SHALL still write every other enabled tracked target in the list

#### Scenario: One target fails, others continue

- **WHEN** a push runs and one target directory cannot be written (for example, permission denied)
- **THEN** the system SHALL return a per-target result marking that target as failed with an error message
- **AND** the remaining targets SHALL still be written successfully

##### Example: per-target push results

| Target | Writable | Result |
| ------ | -------- | ------ |
| anthropic (global, tracked, enabled) | yes | success, pushed_hash recorded |
| codex (global, tracked, enabled) | no (permission denied) | failed, error recorded |
| gemini (global, tracked, enabled) | yes | success, pushed_hash recorded |

## ADDED Requirements

### Requirement: Per-Skill Target Model

Each canonical skill SHALL carry a per-skill target list that drives fan-out. The list SHALL be persisted in that skill's sync-meta sidecar (`.felina-sync-meta.json`) as schema version 2 with shape `{ version: 2, targets: [{ agent, scope, project?, enabled, mode }], last_sync: { <targetKey>: { pushed_hash, base_snapshot?, at } }, dirty }`. The `agent` field SHALL be one of `anthropic`, `codex`, `gemini`. The `scope` field SHALL be `global` or `project`; when `scope` is `project` the target SHALL include a `project` field naming the project root path. The `enabled` field SHALL be a boolean defaulting to true. The `mode` field SHALL be one of `tracked` (push overwrites the agent-side file), `detached` (the target is skipped by push), or `forked` (reserved for future overlay-based customization, not implemented by this capability). The `last_sync` map SHALL be keyed by a stable per-target identifier and SHALL store the content hash written at the last successful push, the timestamp of that push, and an optional `base_snapshot` field reserved for future fork resolution. When a sidecar lacks a `version` field or a `targets` array (schema version 1), the system SHALL backfill targets at read time by emitting one `{ agent, scope, project?, enabled: true, mode: tracked }` entry for each value in the skill `agents` frontmatter field paired with the skill own scope and project. Backfill SHALL preserve any existing `dirty` and `last_synced` values from the v1 sidecar into the v2 structure.

#### Scenario: New v2 sidecar round-trips

- **WHEN** the system serializes a sync-meta value with `version: 2`, two enabled tracked targets, and per-target `last_sync` entries
- **AND** the same JSON is read back from disk
- **THEN** the parsed value SHALL contain the same `targets` entries (agent, scope, project, enabled, mode) and the same `last_sync` map (pushed_hash, at)
- **AND** the schema `version` SHALL still be 2

#### Scenario: Legacy v1 sidecar is backfilled at read time

- **WHEN** a project-scope skill on disk has `agents: [anthropic, codex]` and its sidecar predates schema v2 (no `version` field, no `targets` field) and records `dirty: false` with a previous `last_synced` timestamp
- **THEN** the system SHALL produce two backfilled targets, one for `{ agent: anthropic, scope: project, project: <skill project root>, enabled: true, mode: tracked }` and one for `{ agent: codex, scope: project, project: <skill project root>, enabled: true, mode: tracked }`
- **AND** the system SHALL preserve `dirty: false` and the previous `last_synced` value in the v2 structure

#### Scenario: Detached target is excluded from fan-out

- **WHEN** a skill target list contains a target with `mode: detached`
- **THEN** the system SHALL NOT include that target when fan-out enumerates write destinations
- **AND** the system SHALL NOT update that target `last_sync` entry as a result of any push

### Requirement: Project Path Resolution

The system SHALL resolve a Claude Code project hash (folder name under `~/.claude/projects/`) back to its original working directory path. Resolution SHALL try, in order: reading the `cwd` field from the first parseable `.jsonl` session file inside the project folder; reconstructing a Windows drive-letter prefix when the hash begins with a single ASCII letter followed by a double dash (for example a hash beginning with `C--` SHALL resolve to a path anchored at `C:`); resolving segments against the filesystem starting from either a Windows drive root or the POSIX root when no drive prefix applies. When none of these steps yields a path that exists on disk, the system SHALL report the project hash as unresolved. Callers SHALL NOT treat an unresolved hash as a usable filesystem path and SHALL NOT pass it into fan-out, import, or skill detection writes.

#### Scenario: Active project resolves via session jsonl

- **WHEN** a project folder under `~/.claude/projects/` contains a `.jsonl` whose first line is valid JSON with a non-empty `cwd` field
- **THEN** the system SHALL return that `cwd` value as the resolved path
- **AND** the system SHALL NOT fall back to hash decoding

#### Scenario: Windows drive-letter hash is decoded

- **WHEN** a project hash is `C--MyProject-Pershing-felina` and the resolved directory exists on disk
- **AND** no `.jsonl` `cwd` is available for that hash
- **THEN** the system SHALL return a path anchored at the `C:` drive (not `C/` and not `C//`)
- **AND** the returned path SHALL identify the same directory as `C:/MyProject/Pershing/felina`

#### Scenario: Unresolvable hash is reported, not guessed

- **WHEN** a project hash cannot be decoded by the `.jsonl`, drive-letter, or segment-resolution strategies into a directory that exists on disk
- **THEN** the system SHALL report the hash as unresolved
- **AND** the system SHALL NOT return a string containing `C//` or any other malformed path
- **AND** callers SHALL NOT pass the unresolved value as a project root into fan-out, import, or skill detection write paths
