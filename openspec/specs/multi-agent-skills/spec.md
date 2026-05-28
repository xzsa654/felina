# multi-agent-skills Specification

## Purpose

TBD - created by archiving change 'multi-agent-skills-foundation'. Update Purpose after archive.

## Requirements

### Requirement: Canonical Skill Storage

Canonical skill master files SHALL be stored exclusively under the global location `~/.felina/skills/<skill-name>/`. The system SHALL NOT maintain a separate project-scoped canonical storage; the previously supported `<project>/.felina/skills/` location is removed.

`canonical_skills_dir_for_scope` and any caller that derived a canonical directory from a scope+project pair SHALL be replaced by a single `canonical_skills_dir` accessor that returns the global path. `paths::felina_project_skills_dir` SHALL be removed entirely. The system SHALL NOT provide any migration of legacy `<project>/.felina/skills/` content: that storage format was never released, so there is no existing user data to migrate; legacy directories are simply ignored and left untouched on disk.

The `SkillScope` enum SHALL remain a two-value enum (`global` and `project`) but its only valid use is as the `scope` field of `SkillTarget`, where `project` means "push destination is a particular project's agent directory", not "canonical master file location".

#### Scenario: Skill is created in global canonical storage

- **GIVEN** the user creates a new skill named "my-skill" through the Skills view
- **WHEN** the create action succeeds
- **THEN** `~/.felina/skills/my-skill/SKILL.md` is created and no file is written to any `<project>/.felina/skills/` location

#### Scenario: Legacy project canonical directory is ignored by Skills view

- **GIVEN** a directory `<project>/.felina/skills/git/SKILL.md` exists on disk before this change ships
- **WHEN** the Skills view loads its canonical skill list
- **THEN** the legacy directory is NOT included in the list, is NOT modified, and is NOT deleted


<!-- @trace
source: scope-model-simplification
updated: 2026-05-24
code:
  - src/lib/components/layout/Header.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src-tauri/Cargo.toml
  - src/lib/components/projects/ProjectsPage.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/types/skills.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/paths.rs
  - src/lib/components/settings/AgentPathsSection.tsx
  - .session/product-backlog.md
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/agent-capability-research.md
  - src/lib/components/skills/SkillList.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/stores/navigation.ts
  - src/lib/stores/skills-store.ts
  - src/lib/tauri/commands.ts
  - src/router.tsx
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

The initial skill import feature SHALL write canonical master files only to `~/.felina/skills/`. The wizard SHALL no longer offer a project-scope import destination. Imports from a specific project's agent directories, such as `<project>/.claude/skills/`, SHALL result in a global master file plus a `SkillTarget` row whose `scope=project` points back at that originating project, recorded in the master file's sync-meta sidecar.

The system SHALL parse source `SKILL.md` frontmatter with support for UTF-8 BOM, LF line endings, and CRLF line endings. The system SHALL distinguish repairable missing canonical fields from malformed source frontmatter. If the source frontmatter is parseable YAML mapping content, the importer SHALL treat the source skill directory name as the canonical identity and SHALL fill or normalize canonical fields using these rules: missing `name` is filled from the source skill directory name, a present-but-mismatched `name` is rewritten to the source skill directory name, missing `description` is filled with an empty string, and missing `agents` is filled with the source agent id. If the source frontmatter has YAML syntax errors, is not a YAML mapping, or contains a nested or repeated frontmatter block before the Markdown body, the importer SHALL write the source content verbatim to canonical storage so the skill surfaces as a broken canonical skill, rather than discarding the content or refusing the import.

When the same skill name is found in two or more agent source directories during a single scan, the system SHALL NOT defer those candidates as unimportable. Instead, the import wizard SHALL present a multi-source selection UI that lets the user compare the body preview of each source and choose exactly one as the canonical content. The import resolution for a multi-source group SHALL be `SelectSource`, identifying the chosen source by its index within the grouped candidates. If the multi-source skill name collides with an existing canonical skill, source selection alone SHALL NOT overwrite the canonical skill; the wizard SHALL require an explicit Skip, OverwriteCanonical, or Rename decision after source selection. When the user chooses Rename for a multi-source group, `SelectSource` SHALL include the requested new canonical name, and the backend SHALL write the selected source under that new canonical identity. If the multi-source skill name collides with an existing canonical skill, the wizard SHALL display an inline conflict warning for the row using the same warning semantics as a single-source canonical conflict: canonical path is shown, and the diff summary SHALL describe the currently selected source versus the canonical skill. Before a source is selected, the warning SHALL state that a source must be selected before comparing or choosing OverwriteCanonical/Rename. The `ImportResolution` enum SHALL NOT contain `KeepCanonical` — the previously duplicated no-op semantics of `KeepCanonical` and `Skip` SHALL be consolidated into `Skip` only.

After the user selects one source from a multi-source group, the system SHALL write that source's content to canonical storage and SHALL create a disabled target (`enabled: false`, `mode: tracked`) for each non-selected source. The disabled target's `agent` and `scope` SHALL be derived from the non-selected source's `source_agent` and the scan scope. This ensures that the non-selected agent-side skill files are not flagged as orphans by the prune scan.

A disabled target in the per-skill target editor SHALL provide a "View content" action that reads and displays the agent-side `SKILL.md` content in a read-only in-app modal. The system SHALL resolve the target's agent-side skill directory using the same path resolution logic as fan-out (agent paths configuration, scope, project path, canonical directory identity) and SHALL read `SKILL.md` from that resolved path. When the agent-side file does not exist or the path cannot be resolved, the system SHALL display an error message in the modal rather than silently failing.

A broken canonical skill (one whose `SKILL.md` fails to parse) SHALL NOT be fanned out to any agent directory. The system SHALL allow a user to open a broken skill in a raw editing mode that exposes the full raw `SKILL.md` text, and SHALL re-validate the content on save: when the saved content parses, the skill is no longer broken and becomes eligible for push; when it still fails to parse, the skill remains broken and the system SHALL surface the parse error. App actions that operate on canonical skills — including selection, read, push, raw repair, delete, and target list mutation (set, prune scan, prune apply) — SHALL use a stable canonical identity that continues to resolve the canonical directory even when a stored frontmatter `name` and the directory name diverge. Deep-link selection from the Projects view SHALL match the requested skill name against the canonical directory identity, not the parsed display `name`.

The raw repair editor SHALL provide a Delete action that targets the canonical directory identity, so a `Broken` skill the user does not want to repair can be discarded without leaving the app. The raw repair editor SHALL also display the canonical `SKILL.md` filesystem path with a button that opens the containing folder in the OS file manager. Each row in the per-skill target editor SHALL provide a button that opens the resolved fan-out destination (`<target>/<canonical-id>/`) in the OS file manager, disabled when the destination is missing on disk.

When a raw repair or structured save of an existing skill produces parseable frontmatter whose `name` is missing or differs from the canonical directory identity, the system SHALL normalize `name` to the canonical directory identity before the save is treated as complete and SHALL surface a visible advisory that the YAML name was corrected to match the folder name. The system SHALL use the canonical directory identity, not parsed frontmatter `name`, for fan-out target skill folder names. New skill creation is the only flow where the user-entered `name` establishes a new canonical directory identity; after creation, subsequent edits SHALL NOT implicitly rename the canonical identity.

#### Scenario: Import from a project's agent directory writes the global master plus a project target

- **GIVEN** skill "shared-util" exists in `<projectA>/.claude/skills/shared-util/SKILL.md` and no global canonical master named "shared-util" exists
- **WHEN** the user imports it through either the Skills import wizard or the Projects view "Import to global" action
- **THEN** `~/.felina/skills/shared-util/SKILL.md` is created and its sync-meta sidecar includes a target with `agent=anthropic`, `scope=project`, `project=<projectA absolute path>`

#### Scenario: Multi-source skill is importable with source selection

- **GIVEN** skill "code-review" exists in both `~/.claude/skills/code-review/SKILL.md` (anthropic) and `~/.agents/skills/code-review/SKILL.md` (codex) with different content
- **WHEN** the import wizard scans and finds both sources
- **THEN** the wizard SHALL display a multi-source selection UI for "code-review"
- **AND** the wizard SHALL show the body preview of each source for comparison
- **AND** the user SHALL be able to select exactly one source as the canonical content

##### Example: two-source selection

- **GIVEN** anthropic source body preview starts with "# Code Review - Review pull requests..." and codex source body preview starts with "# Code Review - Analyze code changes..."
- **WHEN** the user selects the anthropic source
- **THEN** the canonical `~/.felina/skills/code-review/SKILL.md` SHALL contain the anthropic source content
- **AND** the sync-meta SHALL include a disabled target with `agent=codex`, `enabled=false`, `mode=tracked`

#### Scenario: Non-selected sources become disabled targets

- **GIVEN** skill "my-helper" exists in anthropic (global), codex (global), and gemini (global) agent directories
- **WHEN** the user imports "my-helper" selecting the anthropic source
- **THEN** the canonical skill is created from the anthropic source content
- **AND** the sync-meta includes a disabled target with `agent=codex`, `scope=global`, `enabled=false`, `mode=tracked`
- **AND** the sync-meta includes a disabled target with `agent=gemini`, `scope=global`, `enabled=false`, `mode=tracked`
- **AND** subsequent prune scan SHALL NOT flag the codex or gemini agent-side skill files as orphans

#### Scenario: Multi-source canonical conflict requires explicit overwrite or rename

- **GIVEN** a canonical skill "code-review" already exists in `~/.felina/skills/code-review/SKILL.md`
- **AND** skill "code-review" exists in both anthropic and codex agent source directories with different content
- **WHEN** the import wizard scans and finds both sources
- **THEN** the wizard SHALL let the user select one source for comparison
- **AND** the wizard SHALL also present Skip, OverwriteCanonical, and Rename decisions
- **AND** selecting a source SHALL NOT by itself overwrite the existing canonical skill
- **AND** if the user chooses Rename, the selected source SHALL be written under the requested new canonical name
- **AND** disabled targets for non-selected sources SHALL be recorded under that new canonical skill sidecar

#### Scenario: Multi-source canonical conflict shows selected-source warning

- **GIVEN** a canonical skill "session-update" already exists in `~/.felina/skills/session-update/SKILL.md`
- **AND** skill "session-update" exists in both anthropic and codex agent source directories
- **WHEN** the import wizard scans and renders the multi-source row
- **THEN** the row SHALL display an inline conflict warning with the canonical `SKILL.md` path
- **AND** before the user selects a source, the warning SHALL instruct the user to select a source before comparing or choosing OverwriteCanonical/Rename
- **WHEN** the user selects the anthropic source
- **THEN** the warning SHALL display the anthropic source diff summary against the canonical skill
- **WHEN** the user switches to the codex source
- **THEN** the warning SHALL update to the codex source diff summary against the canonical skill

#### Scenario: Target content is viewable in-app

- **GIVEN** a canonical skill "code-review" has a target for codex at scope global
- **AND** `~/.agents/skills/code-review/SKILL.md` exists on disk
- **WHEN** the user activates "View content" on that target row in the target editor
- **THEN** the system SHALL display the raw content of `~/.agents/skills/code-review/SKILL.md` in a read-only modal
- **AND** the modal SHALL NOT allow editing

#### Scenario: Target content view handles missing file

- **GIVEN** a canonical skill "code-review" has a target for codex at scope global
- **AND** `~/.agents/skills/code-review/SKILL.md` does not exist on disk
- **WHEN** the user activates "View content" on that disabled target row
- **THEN** the system SHALL display an error message indicating the file does not exist or the path cannot be resolved

#### Scenario: KeepCanonical resolution is removed

- **GIVEN** the import wizard presents resolution options for a conflict candidate
- **WHEN** the user views available resolutions
- **THEN** the available options SHALL be Skip, OverwriteCanonical, Rename, or SelectSource
- **AND** KeepCanonical SHALL NOT appear as a resolution option

#### Scenario: Import repairs missing canonical fields in valid source frontmatter

- **GIVEN** a valid Anthropic source skill has UTF-8 BOM, CRLF line endings, `name: session-start`, `description: Start session context`, and no `agents` field
- **WHEN** the user imports the skill
- **THEN** the canonical `SKILL.md` SHALL contain `description: Start session context`
- **AND** the canonical frontmatter SHALL contain an `agents` list with `anthropic`
- **AND** the canonical body SHALL NOT contain a second `---` frontmatter block before the Markdown heading

#### Scenario: Import rewrites a mismatched frontmatter name to the source directory identity

- **GIVEN** a parseable source skill exists at `<source>/skills/folder-name/SKILL.md`
- **AND** its frontmatter contains `name: different-name`
- **WHEN** the user imports the skill
- **THEN** the canonical file SHALL be written under `~/.felina/skills/folder-name/SKILL.md`
- **AND** the canonical frontmatter SHALL contain `name: folder-name`
- **AND** the app SHALL use `folder-name` as the canonical identity for later actions on that skill

#### Scenario: Import writes malformed source as a broken canonical skill

- **GIVEN** a source skill has malformed YAML frontmatter or frontmatter whose root is not a mapping
- **WHEN** the user imports it
- **THEN** the system SHALL write the source content verbatim to `~/.felina/skills/<skill-name>/SKILL.md`
- **AND** the skill SHALL surface as a broken canonical skill in the skills list
- **AND** the system SHALL NOT silently normalize the source into a canonical file with an empty `description`

#### Scenario: Import writes nested or repeated frontmatter as a broken canonical skill

- **GIVEN** a source skill begins with a frontmatter block whose Markdown body immediately begins with another `---` frontmatter block
- **WHEN** the user imports it
- **THEN** the system SHALL write the source content verbatim to `~/.felina/skills/<skill-name>/SKILL.md`
- **AND** the skill SHALL surface as a broken canonical skill rather than a normalized canonical file

#### Scenario: A broken canonical skill cannot be pushed

- **GIVEN** a canonical skill whose `SKILL.md` fails to parse
- **WHEN** the user attempts to push that skill, or runs push-all
- **THEN** the system SHALL NOT write that skill to any agent directory
- **AND** a single-skill push attempt SHALL surface the parse error rather than producing a silent or successful result

#### Scenario: A broken canonical skill is repaired in the editor's raw mode

- **GIVEN** a broken canonical skill whose `SKILL.md` fails to parse
- **WHEN** the user opens it in the editor's raw mode, corrects the frontmatter so it is valid, and saves
- **THEN** the saved `SKILL.md` SHALL parse successfully
- **AND** the skill SHALL no longer be broken and SHALL become eligible for push
- **AND** if instead the saved content still fails to parse, the skill SHALL remain broken and the system SHALL surface the parse error

#### Scenario: Raw repair normalizes mismatched YAML name to canonical identity

- **GIVEN** a broken canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** the user repairs the raw text so the frontmatter parses but contains `name: real`
- **WHEN** the user saves the raw repair
- **THEN** the canonical `SKILL.md` SHALL be saved with `name: smoke-nested`
- **AND** the app SHALL keep `smoke-nested` as the selected and actionable canonical identity
- **AND** the system SHALL surface an advisory that the YAML name was corrected to match the folder name
- **AND** the system SHALL NOT create or select `~/.felina/skills/real/`

#### Scenario: A canonical skill with mismatched frontmatter name and directory remains actionable

- **GIVEN** a canonical skill exists at `~/.felina/skills/folder-name/SKILL.md`
- **AND** its frontmatter parses but contains `name: different-name`
- **WHEN** the user selects that skill in the app and attempts push, delete, or repair flows
- **THEN** those actions SHALL continue to resolve `~/.felina/skills/folder-name/` as the canonical target
- **AND** the skill SHALL NOT become stuck in an unpushable or undeletable state solely because `frontmatter.name` differs from the directory name

#### Scenario: Fan-out target folder follows canonical identity

- **GIVEN** a canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** its parseable frontmatter contains `name: real`
- **AND** the skill has an enabled tracked target pointing to `~/.claude/skills/`
- **WHEN** the user pushes the skill
- **THEN** the rendered skill SHALL be written to `~/.claude/skills/smoke-nested/SKILL.md`
- **AND** the system SHALL NOT create or update `~/.claude/skills/real/SKILL.md` for that push

#### Scenario: New skill creation establishes canonical identity once

- **GIVEN** no canonical skill named `new-helper` exists
- **WHEN** the user creates a new skill with `name: new-helper`
- **THEN** the system SHALL create `~/.felina/skills/new-helper/SKILL.md`
- **AND** the new skill frontmatter SHALL contain `name: new-helper`
- **AND** later saves of that existing skill SHALL continue using `new-helper` as the canonical identity unless a separate explicit rename flow is implemented

#### Scenario: Target list mutation uses canonical identity, not parsed name

- **GIVEN** a canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** its parseable frontmatter contains `name: real`
- **AND** the skill has a Tracked target for `anthropic` at scope `global`
- **WHEN** the user toggles that target from Tracked to Disabled in the per-skill target editor
- **THEN** the system SHALL update `~/.felina/skills/smoke-nested/.felina-sync-meta.json` to set `enabled: false`
- **AND** the operation SHALL NOT error with "skill not found" against a `~/.felina/skills/real/` lookup
- **AND** subsequent target additions, removals, and orphan prune scans against this skill SHALL likewise target the `smoke-nested` canonical sidecar

#### Scenario: Broken canonical skill is deleted from the raw repair editor

- **GIVEN** a `Broken` canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** the user has opened it in the editor's raw repair mode
- **WHEN** the user clicks the Delete action in the raw repair editor and confirms the prompt
- **THEN** the system SHALL remove `~/.felina/skills/smoke-nested/` and its contents
- **AND** the delete confirmation SHALL identify the skill by its canonical directory name `smoke-nested`, not by any parsed frontmatter `name`
- **AND** the editor view SHALL return to the placeholder state after deletion succeeds

#### Scenario: Projects deep-link resolves a mismatched skill by canonical identity

- **GIVEN** a canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** its parseable frontmatter contains `name: real`
- **AND** the Projects view emits a deep-link `/skills?select=smoke-nested` to open that skill for editing
- **WHEN** the Skills page consumes the deep-link
- **THEN** the system SHALL select the skill whose canonical directory identity equals `smoke-nested`
- **AND** selection SHALL succeed even though no canonical skill has parsed `frontmatter.name === "smoke-nested"`

#### Scenario: Raw repair editor opens the canonical folder in the OS file manager

- **GIVEN** a `Broken` canonical skill exists at `~/.felina/skills/smoke-nested/SKILL.md`
- **AND** the user has opened it in the editor's raw repair mode
- **WHEN** the user activates the "Open in folder" button next to the displayed canonical path
- **THEN** the system SHALL request the OS to open `~/.felina/skills/smoke-nested/` in the platform's default file manager
- **AND** the action SHALL NOT modify the canonical skill content

#### Scenario: Target editor opens the resolved fan-out destination in the OS file manager

- **GIVEN** a canonical skill `smoke-nested` has an enabled tracked target with `agent: anthropic`, `scope: project`, `project: <projectA absolute path>`
- **AND** `<projectA>/.claude/skills/smoke-nested/SKILL.md` exists from a prior successful push
- **WHEN** the user activates the "Open target folder" button on that target row
- **THEN** the system SHALL request the OS to open `<projectA>/.claude/skills/smoke-nested/` in the platform's default file manager
- **AND** the button SHALL be disabled with a tooltip when the destination path does not exist on disk


<!-- @trace
source: skill-identity-namespace-strategy
updated: 2026-05-26
code:
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/types/index.ts
  - .knowledge/knowledge-base/_index.json
  - src/lib/components/skills/SkillsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - .github/workflows/ci.yml
  - .github/ISSUE_TEMPLATE/bug_report.md
  - src-tauri/src/commands/known_projects.rs
  - src/lib/types/skills.ts
  - .github/workflows/release.yml
  - .session/design-backlog.md
  - src-tauri/src/tokens/ccusage.rs
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/architecture.md
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src-tauri/src/commands/mod.rs
  - .gitattributes
  - README.md
  - .github/ISSUE_TEMPLATE/feature_request.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src/lib/components/skills/SkillList.tsx
  - .session/agent-capability-research.md
  - .session/product-backlog.md
  - src/lib/components/skills/PendingPushBar.tsx
  - .github/pull_request_template.md
  - src-tauri/src/paths.rs
  - .knowledge/_catalog.json
tests:
  - tests/skill-import-conflict-warning.test.ts
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

A project-scope target SHALL be shown with a "project not found" indicator (instead of "Not synced") in the Sync info bar, the per-skill Target editor row, and the Coverage matrix when the backend has an explicit filesystem-stat result for that project path and `exists` is false. Absence from the Known Projects list SHALL NOT by itself mark the target missing, because users can remove a custom project path from that management list while existing targets still legitimately point at the folder. The Target editor indicator SHALL carry guidance that the user can either restore the folder or remove the target and re-point it. When a target's destination project path no longer exists, the system SHALL NOT automatically delete the target row or modify the target's `enabled` state; the target row SHALL remain editable. Fan-out push SHALL skip an unresolvable target and produce a `SyncResult` with `success: false`.

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

#### Scenario: Custom project path removed while target folder still exists

- **GIVEN** skill "shared-util" has a project target pointing to `D:/work/custom-project`
- **AND** `D:/work/custom-project` exists on disk
- **WHEN** the user removes `D:/work/custom-project` from the Felina Settings Custom Project Paths list
- **THEN** the target SHALL NOT display "project not found" solely because the path is absent from Known Projects
- **AND** fan-out push SHALL continue to resolve and write to the target project path

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

---
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

---
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

---
### Requirement: Missing Project Target Repoint

When a project-scope target's project path is missing on disk, the Target editor SHALL provide an in-place Repoint action. Absence from Known Projects SHALL NOT by itself make a target eligible for missing-project repoint. Repoint SHALL let the user select a replacement project root path and SHALL update only that target's `project` field while preserving `agent`, `scope`, `enabled`, and `mode`. Repoint SHALL prune the old target key's `last_sync` entry, mark the skill dirty, and allow the new target to be previewed and pushed like any other tracked target. Repoint SHALL NOT delete files from the old project path.

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

---
### Requirement: Agent-Scoped Canonical Skill Fields

Canonical skill frontmatter SHALL support an `x_felina_agent_fields` mapping for target-specific optional fields. The mapping SHALL allow `anthropic`, `codex`, `gemini`, and `standard` namespaces. The system SHALL keep `name`, `description`, and retained `agents` metadata outside this mapping. The system SHALL read existing flat extras for backward compatibility, classify known fields into the scoped mapping, preserve unknown fields, and write the scoped mapping on the next structured save.

#### Scenario: Existing flat extras migrate on save

- **GIVEN** a canonical skill has flat extras `allowed_tools: Read` and `effort: high`
- **WHEN** the user opens the skill and saves it through the structured editor
- **THEN** the saved canonical frontmatter SHALL contain `x_felina_agent_fields.anthropic.allowed-tools: Read`
- **AND** the saved canonical frontmatter SHALL contain `x_felina_agent_fields.anthropic.effort: high`
- **AND** the system SHALL preserve unknown flat extras without emitting them to unrelated targets

#### Scenario: Scoped fields remain separate from shared fields

- **WHEN** a user saves a skill with shared `name`, shared `description`, and Codex `interface.display_name`
- **THEN** `name` and `description` SHALL remain top-level canonical frontmatter fields
- **AND** `interface.display_name` SHALL be stored under `x_felina_agent_fields.codex.interface.display_name`


<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->

---
### Requirement: Target-Filtered Advanced Field Editor

The visual frontmatter editor SHALL replace free-form Advanced key/value rows with a target-filtered field picker. The picker SHALL derive available fields from the selected skill's enabled targets and SHALL group fields by agent when more than one target agent is present. The editor SHALL render each selected field with a value control matching its catalog type and SHALL prevent duplicate fields within the same agent namespace.

#### Scenario: Single target filters field list

- **GIVEN** a skill has one enabled Codex target
- **WHEN** the user opens the Advanced field picker
- **THEN** the picker SHALL show Codex field options
- **AND** the picker SHALL NOT show Claude Code-only fields such as `allowed-tools`

#### Scenario: Multiple targets are grouped by agent

- **GIVEN** a skill has enabled Claude Code and Codex targets
- **WHEN** the user opens Advanced fields
- **THEN** the editor SHALL show one group for Claude Code fields and one group for Codex fields
- **AND** the editor SHALL store selected values under the corresponding agent namespace

#### Scenario: Gemini target has no unsupported extras

- **GIVEN** a skill has only an enabled Gemini CLI target
- **WHEN** the user opens Advanced fields
- **THEN** the editor SHALL show no Gemini-specific optional field choices beyond shared canonical fields until the catalog contains documented Gemini CLI fields


<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->

---
### Requirement: Target-Scoped Fan-Out Filtering

Fan-out SHALL use the agent-scoped field catalog as an allowlist and SHALL emit only fields supported by the target agent. Claude Code fan-out SHALL write allowed Claude Code fields to `SKILL.md`. Codex fan-out SHALL write only `name` and `description` to `SKILL.md` and SHALL write Codex metadata to `agents/openai.yaml`. Gemini CLI fan-out SHALL write only documented Gemini CLI fields. Unknown canonical fields SHALL be preserved in canonical storage but SHALL NOT be emitted to any agent output.

#### Scenario: Codex fields do not leak to Claude Code

- **GIVEN** a canonical skill contains `x_felina_agent_fields.codex.interface.display_name: Helper`
- **AND** the skill has an enabled Claude Code target
- **WHEN** the user pushes the skill
- **THEN** the Claude Code `SKILL.md` output SHALL NOT contain `interface`, `display_name`, or `agents/openai.yaml` metadata

#### Scenario: Claude Code fields do not leak to Codex

- **GIVEN** a canonical skill contains `x_felina_agent_fields.anthropic.allowed-tools: Read Grep`
- **AND** the skill has an enabled Codex target
- **WHEN** the user pushes the skill
- **THEN** the Codex `SKILL.md` output SHALL contain `name` and `description`
- **AND** the Codex `agents/openai.yaml` output SHALL NOT contain `allowed-tools` or `allowed_tools`

#### Scenario: Unknown fields are preserved but not emitted

- **GIVEN** a canonical skill contains an unknown preserved field `vendor_future_flag: true`
- **WHEN** the user pushes the skill to Claude Code, Codex, and Gemini CLI targets
- **THEN** no target output SHALL contain `vendor_future_flag`
- **AND** the canonical skill SHALL retain the unknown field after saving unrelated edits


<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->

---
### Requirement: Source-Agent Import Classification

When importing a skill from an agent-native directory, the system SHALL classify recognized source fields into the matching agent namespace. Claude Code imports SHALL classify recognized Claude Code frontmatter fields into `anthropic`. Codex imports SHALL classify `agents/openai.yaml` interface, policy, and dependency metadata into `codex`. Gemini CLI imports SHALL classify only documented Gemini CLI fields. Unknown parseable fields SHALL be preserved without becoming cross-agent output fields.

#### Scenario: Import Claude Code fields into anthropic namespace

- **GIVEN** a source Claude Code skill has frontmatter `allowed-tools: Read Grep` and `effort: high`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL store those values under `x_felina_agent_fields.anthropic`

#### Scenario: Import Codex openai metadata into codex namespace

- **GIVEN** a Codex skill directory contains `SKILL.md` and `agents/openai.yaml` with `interface.display_name: Helper`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL store `Helper` under `x_felina_agent_fields.codex.interface.display_name`

#### Scenario: Import Gemini CLI does not invent extra fields

- **GIVEN** a Gemini CLI skill contains only `name` and `description`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL contain top-level `name` and `description`
- **AND** the canonical skill SHALL NOT create synthetic Gemini optional fields

<!-- @trace source: agent-scoped-skill-fields updated: 2026-05-28 -->

<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->