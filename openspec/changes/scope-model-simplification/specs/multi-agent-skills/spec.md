## MODIFIED Requirements

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

### Requirement: Initial Skill Import

The initial skill import feature SHALL write canonical master files only to `~/.felina/skills/`. The wizard SHALL no longer offer a project-scope import destination. Imports from a specific project's agent directories (e.g. `<project>/.claude/skills/`) result in a global master file plus a `SkillTarget` row whose `scope=project` points back at that originating project, recorded in the master file's sync-meta sidecar.

#### Scenario: Import from a project's agent directory writes the global master plus a project target

- **GIVEN** skill "shared-util" exists in `<projectA>/.claude/skills/shared-util/SKILL.md` and no global canonical master named "shared-util" exists
- **WHEN** the user imports it through either the Skills import wizard or the Projects view "Import to global" action
- **THEN** `~/.felina/skills/shared-util/SKILL.md` is created and its sync-meta sidecar includes a target with `agent=anthropic`, `scope=project`, `project=<projectA absolute path>`
