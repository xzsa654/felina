## MODIFIED Requirements

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

## ADDED Requirements

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
