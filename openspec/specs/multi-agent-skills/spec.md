# multi-agent-skills Specification

## Purpose

TBD - created by archiving change 'multi-agent-skills-foundation'. Update Purpose after archive.

## Requirements

### Requirement: Canonical Skill Storage

The system SHALL store skill main files in a canonical location separate from any agent-native skill directory. The global scope canonical path SHALL be `~/.glyphic/skills/<name>/SKILL.md` and the project scope canonical path SHALL be `<project>/.glyphic/skills/<name>/SKILL.md`. The canonical SKILL.md SHALL be the single source of truth: it contains YAML frontmatter using snake_case field names plus a Markdown body. The frontmatter SHALL include the required fields `name`, `description`, and `agents` (a list whose values are a subset of `anthropic`, `codex`, `gemini`), and MAY include any optional fields defined by the agent-skills-schema canonical schema.

#### Scenario: Create a canonical skill

- **WHEN** a user creates a new skill named `search-helper` in global scope
- **THEN** the system SHALL write `~/.glyphic/skills/search-helper/SKILL.md` containing snake_case YAML frontmatter and a Markdown body
- **AND** the frontmatter SHALL contain `name`, `description`, and `agents`

#### Scenario: List canonical skills by scope

- **WHEN** a user views the Skills page filtered to project scope
- **THEN** the system SHALL list only skills found under `<project>/.glyphic/skills/`
- **AND** a canonical directory that does not yet exist SHALL produce an empty list rather than an error

#### Scenario: Canonical directory absent on first write

- **WHEN** a user creates the first skill and `~/.glyphic/skills/` does not exist
- **THEN** the system SHALL create the directory before writing the SKILL.md
- **AND** the write SHALL succeed without requiring a separate setup step

#### Scenario: Frontmatter fails to parse

- **WHEN** a canonical SKILL.md contains YAML frontmatter that cannot be parsed
- **THEN** the read operation SHALL return an error for that skill
- **AND** the Skills page SHALL mark the skill as broken rather than crashing the list


<!-- @trace
source: multi-agent-skills-foundation
updated: 2026-05-22
code:
  - src/lib/types/index.ts
  - package.json
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/stores/locale.ts
  - .knowledge/knowledge-base/_index.json
  - src-tauri/tauri.conf.json
  - src/lib/components/layout/UpdateBanner.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - index.html
  - src/lib/components/shared/PageScaffold.tsx
  - .knowledge/experience/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/skills/SkillImportBanner.tsx
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/main.rs
  - src/lib/components/layout/Sidebar.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/router.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/stores/skills-store.ts
  - src/lib/stores/theme.ts
  - .session/product-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/mod.rs
-->

---
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


<!-- @trace
source: path-bug-and-target-model
updated: 2026-05-22
code:
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/canonical_skills.rs
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/paths.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src-tauri/Cargo.toml
-->

---
### Requirement: Pending-Push Sync State

The system SHALL track, per skill, whether the canonical content has changed since its last successful push (a dirty flag) and the timestamp of the last successful push. Editing and saving a canonical skill SHALL set its dirty flag. A successful push SHALL clear the dirty flag and update the last-synced timestamp. The system SHALL NOT push automatically on save. The Skills page SHALL surface aggregate pending changes through a persistent banner that offers a single action to push all dirty skills, and SHALL also offer a per-skill push action.

#### Scenario: Editing marks a skill dirty

- **WHEN** a user edits and saves a canonical skill
- **THEN** the system SHALL set that skill's dirty flag
- **AND** the Skills page SHALL display a dirty indicator on that skill's row

#### Scenario: Pending-push bar reflects dirty count

- **WHEN** three skills are dirty and unpushed
- **THEN** the Skills page SHALL display a banner indicating three skills changed since last sync
- **AND** the banner SHALL offer a single action to push all of them

#### Scenario: Push clears dirty state

- **WHEN** a user pushes a dirty skill and all its targets succeed
- **THEN** the system SHALL clear that skill's dirty flag
- **AND** the system SHALL update its last-synced timestamp

#### Scenario: Save does not auto-push

- **WHEN** a user saves a canonical skill edit
- **THEN** the system SHALL NOT write to any agent target until the user invokes a push action


<!-- @trace
source: multi-agent-skills-foundation
updated: 2026-05-22
code:
  - src/lib/types/index.ts
  - package.json
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/stores/locale.ts
  - .knowledge/knowledge-base/_index.json
  - src-tauri/tauri.conf.json
  - src/lib/components/layout/UpdateBanner.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - index.html
  - src/lib/components/shared/PageScaffold.tsx
  - .knowledge/experience/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/skills/SkillImportBanner.tsx
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/main.rs
  - src/lib/components/layout/Sidebar.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/router.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/stores/skills-store.ts
  - src/lib/stores/theme.ts
  - .session/product-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/mod.rs
-->

---
### Requirement: Initial Skill Import

The system SHALL detect existing skills in known agent-native directories and offer a manual import path into canonical storage. On the Skills page, when the canonical store is empty and at least one known agent directory contains skill subdirectories, the system SHALL display a dismissable banner reporting the count of detected skills. The detection SHALL count directories without reading their contents. Import SHALL be user-initiated through a wizard that presents candidates, shows a difference summary for any name that already exists in canonical, and lets the user choose a resolution per candidate. Importing a skill SHALL NOT delete the original agent-native file. Dismissing the banner SHALL persist so it is not shown again until the user re-enables it.

#### Scenario: Banner appears when existing skills are detected

- **WHEN** the canonical store is empty and `~/.claude/skills/` contains two skill directories
- **THEN** the Skills page SHALL display a dismissable banner reporting two detected skills
- **AND** the banner SHALL offer an action to open the import wizard

#### Scenario: Banner suppressed when nothing to import

- **WHEN** the canonical store is empty and no known agent directory contains any skill subdirectory
- **THEN** the Skills page SHALL NOT display the import banner

#### Scenario: Import resolves a name conflict

- **WHEN** a user imports a skill whose name already exists in canonical
- **THEN** the wizard SHALL show a difference summary between the candidate and the existing canonical skill
- **AND** the user SHALL choose to keep canonical, overwrite canonical, skip, or rename before the import proceeds

#### Scenario: Import preserves the source file

- **WHEN** a user imports a skill from `~/.claude/skills/foo/SKILL.md`
- **THEN** the system SHALL write the canonical copy
- **AND** the system SHALL leave `~/.claude/skills/foo/SKILL.md` unchanged

#### Scenario: Dismissed banner stays dismissed

- **WHEN** a user dismisses the import banner
- **THEN** the system SHALL NOT show the banner again on subsequent visits until the user re-enables it


<!-- @trace
source: multi-agent-skills-foundation
updated: 2026-05-22
code:
  - src/lib/types/index.ts
  - package.json
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/stores/locale.ts
  - .knowledge/knowledge-base/_index.json
  - src-tauri/tauri.conf.json
  - src/lib/components/layout/UpdateBanner.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - index.html
  - src/lib/components/shared/PageScaffold.tsx
  - .knowledge/experience/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/skills/SkillImportBanner.tsx
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/main.rs
  - src/lib/components/layout/Sidebar.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/router.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/stores/skills-store.ts
  - src/lib/stores/theme.ts
  - .session/product-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/mod.rs
-->

---
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


<!-- @trace
source: known-projects-and-multi-target
updated: 2026-05-23
code:
  - src/lib/components/skills/SkillList.tsx
  - src/lib/stores/skills-store.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/mod.rs
  - .session/product-backlog.md
  - src/lib/types/skills.ts
  - src/lib/components/skills/AddTargetDialog.tsx
-->

---
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


<!-- @trace
source: known-projects-and-multi-target
updated: 2026-05-23
code:
  - src/lib/components/skills/SkillList.tsx
  - src/lib/stores/skills-store.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/mod.rs
  - .session/product-backlog.md
  - src/lib/types/skills.ts
  - src/lib/components/skills/AddTargetDialog.tsx
-->

---
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

<!-- @trace
source: path-bug-and-target-model
updated: 2026-05-22
-->

<!-- @trace
source: path-bug-and-target-model
updated: 2026-05-22
code:
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - .session/product-backlog.md
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/canonical_skills.rs
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/paths.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/gemini.rs
  - src-tauri/Cargo.toml
-->

---
### Requirement: Per-Skill Target Editor

The AddTargetDialog SHALL allow selecting any project from the Known Projects list as a target destination, not only the current project. The "cross-project: Phase 1.5 (b)" disabled label SHALL be removed. When a cross-project target is added, the target's `project` field SHALL contain the selected project's path. Fan-out push SHALL write the rendered SKILL.md to the selected project's agent skill directory using the existing `resolve_pair` routing (which already accepts arbitrary `project_path`).

#### Scenario: Add a cross-project target

- **GIVEN** skill "shared-util" exists in project A and Known Projects contains project B at `D:/work/project-b`
- **WHEN** the user opens AddTargetDialog, selects agent "anthropic", scope "project", and project "D:/work/project-b", then confirms
- **THEN** a new target `{ agent: "anthropic", scope: "project", project: "D:/work/project-b", enabled: true, mode: "tracked" }` is added to the skill's target list

#### Scenario: Cross-project push writes to destination

- **GIVEN** skill "shared-util" has a cross-project target pointing to `D:/work/project-b` with agent "anthropic"
- **WHEN** the user pushes the skill
- **THEN** the rendered SKILL.md is written to `D:/work/project-b/.claude/skills/shared-util/SKILL.md`


<!-- @trace
source: cross-project-push-and-coverage
updated: 2026-05-24
code:
  - src/lib/utils/path.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/types/skills.ts
  - package.json
  - src-tauri/gen/schemas/desktop-schema.json
  - src-tauri/gen/schemas/capabilities.json
  - src-tauri/src/commands/known_projects.rs
  - src-tauri/src/lib.rs
  - src-tauri/gen/schemas/acl-manifests.json
  - .session/product-backlog.md
  - src-tauri/gen/schemas/windows-schema.json
-->

---
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

<!-- @trace
source: known-projects-and-multi-target
updated: 2026-05-23
code:
  - src/lib/components/skills/SkillList.tsx
  - src/lib/stores/skills-store.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/TargetEditor.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/types/index.ts
  - src-tauri/src/commands/mod.rs
  - .session/product-backlog.md
  - src/lib/types/skills.ts
  - src/lib/components/skills/AddTargetDialog.tsx
-->

---
### Requirement: Origin-Project Degradation

Project-scope target existence SHALL be determined by actual filesystem existence of the target's project path, NOT by Known Projects list membership (an explicitly-saved L3 entry persists in `known-projects.json` after its folder is renamed or deleted, so list membership cannot detect on-disk removal). The `known_projects_list` command SHALL annotate each returned project with an `exists` boolean computed via a filesystem stat (`Path::exists()`), without adding a new command. This stat SHALL be evaluated whenever the list is loaded — on Skills page mount, on manual Reload, on window focus regain, and after target/push operations change the skill entries — and SHALL NOT use a file watcher or polling.

A project-scope target SHALL be shown with a "project not found" indicator (instead of "Not synced") in the Sync info bar, the per-skill Target editor row, and the Coverage matrix when its project path is present in the list with `exists` false, OR is absent from the list. The Target editor indicator SHALL carry guidance that the user can either restore the folder or remove the target and re-point it. When a target's destination project path no longer exists, the system SHALL NOT automatically delete the target row or modify the target's `enabled` state; the target row SHALL remain editable. Fan-out push SHALL skip an unresolvable target and produce a `SyncResult` with `success: false`.

#### Scenario: Destination project folder renamed or deleted

- **GIVEN** skill "shared-util" has a target pointing to `D:/work/old-project`, and that folder is then renamed or deleted on disk while it remains an entry in `known-projects.json`
- **WHEN** the Known Projects list is reloaded (Skills page mount, Reload, or window focus)
- **THEN** `known_projects_list` reports that project with `exists` false, and the Sync info bar and Coverage matrix display "project not found" for that target rather than "Not synced"

#### Scenario: Push skips a missing destination

- **GIVEN** skill "shared-util" has a target pointing to `D:/work/old-project` which no longer exists
- **WHEN** the user pushes the skill
- **THEN** push skips that target with a `success: false` result and `dirty` remains true for the skill

#### Scenario: Destination project restored

- **GIVEN** a target previously showed "project not found" because `D:/work/old-project` was missing
- **WHEN** the folder `D:/work/old-project` is recreated and the Known Projects list is reloaded
- **THEN** `known_projects_list` reports that project with `exists` true and the indicator returns to its normal sync state

<!-- @trace
source: cross-project-push-and-coverage
updated: 2026-05-24
code:
  - src/lib/utils/path.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src-tauri/Cargo.toml
  - src-tauri/capabilities/default.json
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/types/skills.ts
  - package.json
  - src-tauri/gen/schemas/desktop-schema.json
  - src-tauri/gen/schemas/capabilities.json
  - src-tauri/src/commands/known_projects.rs
  - src-tauri/src/lib.rs
  - src-tauri/gen/schemas/acl-manifests.json
  - .session/product-backlog.md
  - src-tauri/gen/schemas/windows-schema.json
-->