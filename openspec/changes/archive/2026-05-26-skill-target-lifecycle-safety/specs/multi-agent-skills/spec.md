## ADDED Requirements

### Requirement: Push Preview and Drift Guard

The system SHALL require an explicit preview step before writing canonical skill content to agent-side targets from either a single-skill push or push-all action. The preview SHALL enumerate each enabled tracked target that can be resolved, the destination skill directory, the destination `SKILL.md` path, the planned operation (`create`, `overwrite`, `no-op`, `skipped`, `blocked-drift`, or `overwrite-unknown`), and a summary count by operation. The preview UI SHALL present a primary human-readable impact summary that states whether targets need attention and that files are not changed until confirmation; raw operation counts SHALL be secondary detail. The preview SHALL NOT create, overwrite, or delete any file.

For each target with an existing agent-side `SKILL.md`, the system SHALL compare the current file hash with the target's `last_sync.pushed_hash` when a `last_sync` entry exists. If the hashes differ, the target SHALL be reported as `blocked-drift` and the system SHALL NOT overwrite it unless the user explicitly chooses Override for that target. The user SHALL also be able to choose Detach for a drifted target, which updates the target mode to `detached` without writing that agent-side file, or Cancel, which performs no write and no target mutation for that push request. The UI SHALL explain that Detach preserves the file and stops canonical management for that target, while Cancel preserves both file and target configuration for later resolution. A target with no prior `last_sync` entry and an existing destination file SHALL be treated as overwrite-unknown and SHALL require explicit confirmation in the preview before writing.

#### Scenario: Preview lists planned writes without changing files

- **GIVEN** skill `shared-util` has one enabled tracked Anthropic global target whose destination file does not exist and one enabled tracked Codex global target whose destination file already matches the rendered output
- **WHEN** the user invokes push preview for `shared-util`
- **THEN** the preview includes the Anthropic target as `create`
- **AND** the preview includes the Codex target as `no-op`
- **AND** the preview's primary summary states that no files will change until the user confirms the push
- **AND** no target directory, `SKILL.md`, or sync-meta file is modified by the preview

##### Example: preview operation summary

| Target | Destination exists | Current hash relation | Planned operation |
| ------ | ------------------ | --------------------- | ----------------- |
| anthropic/global | no | none | create |
| codex/global | yes | equals rendered output | no-op |
| gemini/global | yes | differs from rendered output and equals last_sync.pushed_hash | overwrite |
| anthropic/project D:/work/app | yes | differs from last_sync.pushed_hash | blocked-drift |

#### Scenario: Drift blocks overwrite until the user resolves it

- **GIVEN** skill `shared-util` has a target whose `last_sync.pushed_hash` is `abc123`
- **AND** that target's current agent-side `SKILL.md` hash is `def456`
- **WHEN** the user previews and confirms push without choosing Override or Detach for that target
- **THEN** the system SHALL NOT overwrite that target file
- **AND** the push result marks that target as blocked by drift
- **AND** the skill remains dirty

#### Scenario: Override writes drifted target and refreshes last sync

- **GIVEN** a preview reports one target as `blocked-drift`
- **WHEN** the user chooses Override for that target and confirms the push
- **THEN** the system overwrites the target's `SKILL.md` with rendered canonical content
- **AND** records the new pushed content hash and timestamp in `last_sync` for that target

#### Scenario: Detach resolution preserves drifted file

- **GIVEN** a preview reports one target as `blocked-drift`
- **WHEN** the user chooses Detach for that target and confirms the push
- **THEN** the system sets that target's mode to `detached`
- **AND** the system does not modify that target's agent-side `SKILL.md`
- **AND** the target is skipped by subsequent pushes until it is changed back to tracked

### Requirement: Explicit Canonical Delete Policy

Deleting a canonical skill SHALL require the user to choose one of three policies: Cascade, Detach, or Cancel. Cascade SHALL delete the canonical skill and every agent-side skill directory that is resolved from the skill's current target list where the target is both enabled and tracked. Cascade SHALL NOT delete agent-side directories for disabled, detached, or forked targets. When the current skill has zero enabled tracked targets, the delete confirmation UI SHALL disable the Cascade option and SHALL still allow Detach or Cancel. Detach SHALL delete only the canonical skill directory and SHALL leave agent-side files on disk. Cancel SHALL leave both canonical and agent-side files unchanged. Cascade deletion SHALL isolate per-target deletion failures: one failed agent-side deletion SHALL NOT delete unrelated target directories, and the final result SHALL surface which paths were deleted and which failed.

#### Scenario: Detach delete leaves agent-side files

- **GIVEN** skill `shared-util` exists in canonical storage and has Anthropic and Codex targets with agent-side files on disk
- **WHEN** the user chooses Detach in the canonical delete confirmation
- **THEN** the canonical directory `~/.felina/skills/shared-util/` is deleted
- **AND** the Anthropic and Codex agent-side skill directories remain on disk

#### Scenario: Cascade delete removes only enabled tracked target directories

- **GIVEN** skill `shared-util` exists in canonical storage and has one enabled tracked Anthropic target, one disabled Codex target, and one detached Gemini target with resolvable agent-side skill directories
- **WHEN** the user chooses Cascade in the canonical delete confirmation
- **THEN** the system deletes the canonical directory
- **AND** the system attempts to delete the Anthropic agent-side skill directory
- **AND** the system does not delete the disabled Codex or detached Gemini agent-side skill directories
- **AND** the result reports each deleted path and each failed path

#### Scenario: Cascade delete unavailable when no enabled tracked targets exist

- **GIVEN** skill `shared-util` exists in canonical storage and has only disabled, detached, or forked targets
- **WHEN** the canonical delete confirmation opens
- **THEN** the Cascade option is disabled
- **AND** the user can still choose Detach or Cancel

#### Scenario: Cancel delete leaves all files unchanged

- **GIVEN** skill `shared-util` exists in canonical storage and has agent-side files on disk
- **WHEN** the user chooses Cancel in the canonical delete confirmation
- **THEN** the canonical directory remains on disk
- **AND** all agent-side files remain unchanged

### Requirement: Explicit Target Removal Policy

Removing a target row from a skill's target list SHALL require the user to choose Remove target only, Remove target and delete file, or Cancel. Remove target only SHALL remove the target from sync-meta and SHALL leave the resolved agent-side skill directory on disk. Remove target and delete file SHALL remove the target from sync-meta and attempt to delete only that target's resolved agent-side skill directory. Cancel SHALL leave the target list and agent-side files unchanged. When the removed target had a `last_sync` entry, the system SHALL remove that entry from sync-meta after the target row is removed.

#### Scenario: Remove target only creates an orphan

- **GIVEN** skill `shared-util` has a Gemini project target whose agent-side skill directory exists
- **WHEN** the user removes the target and chooses Remove target only
- **THEN** the target row is removed from the sync-meta target list
- **AND** the Gemini agent-side skill directory remains on disk as an orphan eligible for explicit orphan prune

#### Scenario: Remove target and delete file deletes only that target destination

- **GIVEN** skill `shared-util` has Anthropic and Gemini targets with agent-side skill directories on disk
- **WHEN** the user removes only the Gemini target and chooses Remove target and delete file
- **THEN** the Gemini target row is removed from sync-meta
- **AND** the Gemini agent-side skill directory for `shared-util` is deleted if it is resolvable
- **AND** the Anthropic target row and Anthropic agent-side skill directory are unchanged

#### Scenario: Cancel target removal preserves state

- **GIVEN** skill `shared-util` has a target row selected for removal
- **WHEN** the user chooses Cancel in the target removal confirmation
- **THEN** the target row remains in sync-meta
- **AND** no agent-side file is deleted

### Requirement: Missing Project Target Repoint

When a project-scope target's project path is missing or absent from Known Projects, the Target editor SHALL provide an in-place Repoint action. Repoint SHALL let the user select a replacement project root path and SHALL update only that target's `project` field while preserving `agent`, `scope`, `enabled`, and `mode`. Repoint SHALL prune the old target key's `last_sync` entry, mark the skill dirty, and allow the new target to be previewed and pushed like any other tracked target. Repoint SHALL NOT delete files from the old project path.

#### Scenario: Repoint missing project target to a new path

- **GIVEN** skill `shared-util` has an Anthropic project target pointing to `D:/work/old-project`
- **AND** `D:/work/old-project` no longer exists
- **WHEN** the user chooses Repoint and selects `D:/work/new-project`
- **THEN** the target remains Anthropic project scoped and keeps its enabled and mode values
- **AND** the target's project field becomes `D:/work/new-project`
- **AND** the old target key's `last_sync` entry is removed
- **AND** the skill is marked dirty

#### Scenario: Repoint does not delete old destination files

- **GIVEN** an old project path becomes available again after a target was repointed away from it
- **WHEN** the user inspects the old project path on disk
- **THEN** Felina has not deleted any agent-side skill directory from the old project path as part of repoint
