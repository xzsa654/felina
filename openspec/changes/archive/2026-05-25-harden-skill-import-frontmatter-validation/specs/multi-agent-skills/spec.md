## MODIFIED Requirements

### Requirement: Initial Skill Import

The initial skill import feature SHALL write canonical master files only to `~/.felina/skills/`. The wizard SHALL no longer offer a project-scope import destination. Imports from a specific project's agent directories, such as `<project>/.claude/skills/`, SHALL result in a global master file plus a `SkillTarget` row whose `scope=project` points back at that originating project, recorded in the master file's sync-meta sidecar.

The system SHALL parse source `SKILL.md` frontmatter with support for UTF-8 BOM, LF line endings, and CRLF line endings. The system SHALL distinguish repairable missing canonical fields from malformed source frontmatter. If the source frontmatter is parseable YAML mapping content, the importer SHALL treat the source skill directory name as the canonical identity and SHALL fill or normalize canonical fields using these rules: missing `name` is filled from the source skill directory name, a present-but-mismatched `name` is rewritten to the source skill directory name, missing `description` is filled with an empty string, and missing `agents` is filled with the source agent id. If the source frontmatter has YAML syntax errors, is not a YAML mapping, or contains a nested or repeated frontmatter block before the Markdown body, the importer SHALL write the source content verbatim to canonical storage so the skill surfaces as a broken canonical skill, rather than discarding the content or refusing the import.

A broken canonical skill (one whose `SKILL.md` fails to parse) SHALL NOT be fanned out to any agent directory. The system SHALL allow a user to open a broken skill in a raw editing mode that exposes the full raw `SKILL.md` text, and SHALL re-validate the content on save: when the saved content parses, the skill is no longer broken and becomes eligible for push; when it still fails to parse, the skill remains broken and the system SHALL surface the parse error. App actions that operate on canonical skills — including selection, read, push, raw repair, delete, and target list mutation (set, prune scan, prune apply) — SHALL use a stable canonical identity that continues to resolve the canonical directory even when a stored frontmatter `name` and the directory name diverge. Deep-link selection from the Projects view SHALL match the requested skill name against the canonical directory identity, not the parsed display `name`.

The raw repair editor SHALL provide a Delete action that targets the canonical directory identity, so a `Broken` skill the user does not want to repair can be discarded without leaving the app. The raw repair editor SHALL also display the canonical `SKILL.md` filesystem path with a button that opens the containing folder in the OS file manager. Each row in the per-skill target editor SHALL provide a button that opens the resolved fan-out destination (`<target>/<canonical-id>/`) in the OS file manager, disabled when the destination is missing on disk.

When a raw repair or structured save of an existing skill produces parseable frontmatter whose `name` is missing or differs from the canonical directory identity, the system SHALL normalize `name` to the canonical directory identity before the save is treated as complete and SHALL surface a visible advisory that the YAML name was corrected to match the folder name. The system SHALL use the canonical directory identity, not parsed frontmatter `name`, for fan-out target skill folder names. New skill creation is the only flow where the user-entered `name` establishes a new canonical directory identity; after creation, subsequent edits SHALL NOT implicitly rename the canonical identity.

#### Scenario: Import from a project's agent directory writes the global master plus a project target

- **GIVEN** skill "shared-util" exists in `<projectA>/.claude/skills/shared-util/SKILL.md` and no global canonical master named "shared-util" exists
- **WHEN** the user imports it through either the Skills import wizard or the Projects view "Import to global" action
- **THEN** `~/.felina/skills/shared-util/SKILL.md` is created and its sync-meta sidecar includes a target with `agent=anthropic`, `scope=project`, `project=<projectA absolute path>`

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
