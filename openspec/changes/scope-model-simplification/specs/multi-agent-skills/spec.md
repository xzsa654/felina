## MODIFIED Requirements

### Requirement: Canonical Skill Storage

Canonical skill master files SHALL be stored exclusively under the global location `~/.felina/skills/<skill-name>/`. The system SHALL NOT maintain a separate project-scoped canonical storage; the previously supported `<project>/.felina/skills/` location is removed.

`canonical_skills_dir_for_scope` and any caller that derived a canonical directory from a scope+project pair SHALL be replaced by a single `canonical_skills_dir` accessor that returns the global path. `paths::felina_project_skills_dir` SHALL be removed except when retained read-only for the project-to-global migration command described in the Project Canonical Migration requirement.

The `SkillScope` enum SHALL remain a two-value enum (`global` and `project`) but its only valid use is as the `scope` field of `SkillTarget`, where `project` means "push destination is a particular project's agent directory", not "canonical master file location".

#### Scenario: Skill is created in global canonical storage

- **GIVEN** the user creates a new skill named "my-skill" through the Skills view
- **WHEN** the create action succeeds
- **THEN** `~/.felina/skills/my-skill/SKILL.md` is created and no file is written to any `<project>/.felina/skills/` location

#### Scenario: Legacy project canonical directory is ignored by Skills view

- **GIVEN** a directory `<project>/.felina/skills/git/SKILL.md` exists on disk before this change ships
- **WHEN** the Skills view loads its canonical skill list
- **THEN** the legacy directory is NOT included in the list, is NOT modified, and is NOT deleted

### Requirement: Initial Skill Import

The initial skill import feature SHALL write canonical master files only to `~/.felina/skills/`. The wizard SHALL no longer offer a project-scope import destination. Imports from a specific project's agent directories (e.g. `<project>/.claude/skills/`) result in a global master file plus a `SkillTarget` row whose `scope=project` points back at that originating project, recorded in the master file's sync-meta sidecar.

#### Scenario: Import from a project's agent directory writes the global master plus a project target

- **GIVEN** skill "shared-util" exists in `<projectA>/.claude/skills/shared-util/SKILL.md` and no global canonical master named "shared-util" exists
- **WHEN** the user imports it through either the Skills import wizard or the Projects view "Import to global" action
- **THEN** `~/.felina/skills/shared-util/SKILL.md` is created and its sync-meta sidecar includes a target with `agent=anthropic`, `scope=project`, `project=<projectA absolute path>`

## ADDED Requirements

### Requirement: Project Canonical Migration

The system SHALL provide a non-destructive one-shot migration that converts each legacy `<project>/.felina/skills/<skill-name>/` master file into a global master at `~/.felina/skills/<skill-name>/` with a `SkillTarget` whose `scope=project` and `project=<originating project path>`. The migration SHALL be exposed as two Rust commands `migrate_project_canonicals_scan` and `migrate_project_canonicals_apply` and SHALL NOT be triggered automatically; it executes only after the user invokes apply with an explicit selection.

The scan command SHALL list every legacy `<project>/.felina/skills/<name>` entry across all Known Projects, including a flag indicating whether a global master file with the same name already exists (a conflict). The apply command SHALL accept per-entry actions (`keep`, `overwrite`, `skip`) and SHALL never silently overwrite a conflicting global master.

The migration SHALL NOT delete the legacy `<project>/.felina/skills/` directories. Cleanup of the legacy directory is intentionally deferred and remains a manual user action or is handled by the cascade behavior introduced by `skill-sync-lifecycle`.

#### Scenario: Migration scan reports both clean and conflicting entries

- **GIVEN** `<projectA>/.felina/skills/foo/SKILL.md` exists and no `~/.felina/skills/foo` exists, AND `<projectA>/.felina/skills/bar/SKILL.md` exists AND `~/.felina/skills/bar/SKILL.md` also exists
- **WHEN** the user runs `migrate_project_canonicals_scan`
- **THEN** the result contains an entry for "foo" with `conflict=false`, and an entry for "bar" with `conflict=true`

#### Scenario: Migration apply skips conflicting entries marked `skip`

- **GIVEN** the scan above and the user submits `apply([{name:"foo", action:keep}, {name:"bar", action:skip}])`
- **WHEN** the apply command runs
- **THEN** `~/.felina/skills/foo/SKILL.md` is created with a target `{scope:project, project:<projectA>}`, `~/.felina/skills/bar/SKILL.md` is unchanged, and neither `<projectA>/.felina/skills/foo/` nor `<projectA>/.felina/skills/bar/` is deleted
