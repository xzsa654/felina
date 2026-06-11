# skill-library-management Specification

## Purpose

TBD - created by archiving change 'canonical-skill-export-import'. Update Purpose after archive.

## Requirements

### Requirement: Export all canonical skills as ZIP

The system SHALL provide a backend command that packages all canonical skill directories under `~/.felina/skills/` into a single ZIP file. Each skill SHALL be stored in the ZIP as `<skill-name>/SKILL.md` plus any subdirectories and files within that skill directory. The system SHALL exclude `.felina-sync-meta.json` and the `.git/` directory (snapshot repository) from the ZIP output. The system SHALL use Tauri's save dialog to let the user choose the output file path. The ZIP file SHALL use the default name `felina-skills-backup.zip`. If no canonical skills exist, the system SHALL return an error indicating the library is empty.

#### Scenario: User exports all skills

- **WHEN** user clicks the Export button in the Skill Library section
- **THEN** a save dialog appears for choosing the ZIP file location
- **AND** the system writes a ZIP file containing all canonical skills (excluding `.felina-sync-meta.json` and `.git/`)

#### Scenario: Export with skills containing subdirectories

- **WHEN** a canonical skill directory contains subdirectories (e.g., `schema/`, `scripts/`)
- **THEN** the ZIP SHALL include those subdirectories and all files within them

##### Example: session-handoff skill structure

- **GIVEN** skill `session-handoff` contains `SKILL.md`, `schema/handoff.md`, `scripts/insert_session_entry.py`, `.felina-sync-meta.json`
- **WHEN** user exports
- **THEN** ZIP contains `session-handoff/SKILL.md`, `session-handoff/schema/handoff.md`, `session-handoff/scripts/insert_session_entry.py`
- **AND** ZIP does NOT contain `session-handoff/.felina-sync-meta.json`

#### Scenario: Export with empty library

- **WHEN** user clicks Export and no canonical skills exist under `~/.felina/skills/`
- **THEN** the system SHALL display an error message indicating the library is empty


<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Import skills from ZIP

The system SHALL provide a backend command (`skill_import_scan_zip`) that reads a ZIP file, extracts its contents to a system temporary directory, and scans it for valid skills. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The backend command SHALL return a list of `ImportCandidate` records, pointing to the temporary paths.

The system SHALL use Tauri's open dialog to let the user choose the input ZIP file. When the user selects a ZIP file, the frontend SHALL call the `skill_import_scan_zip` command and populate the valid skill contents into the right "Staging" pane of the import staging dialog (selecting a ZIP is an explicit import intent; routing through Discovered would require a redundant drag step). Same-name conflicts SHALL be resolved by the staging card's built-in overwrite / rename UI, on the same path as candidates discovered from agent directories. The system SHALL NOT write directly to the canonical `~/.felina/skills/` directory during this scanning phase. The system SHALL NOT load `.felina-sync-meta.json` from the ZIP as part of the candidate; the eventual application of the staged skills SHALL generate clean sync metadata.

The import staging dialog SHALL present two separate browse entry points: "Browse ZIP" (file picker filtered to `.zip`) and "Browse Folder" (native directory picker). A single mixed file-and-directory picker SHALL NOT be used.

#### Scenario: User imports skills from ZIP
- **WHEN** user clicks the Import button and selects a valid ZIP file
- **THEN** the system extracts the skills to a temporary directory and loads them into the right "Staging" pane of the import staging dialog
- **AND** does NOT write them to the canonical `~/.felina/skills/` directory

#### Scenario: Import encounters existing skill with same name
- **WHEN** a skill staged for import matches an existing canonical skill
- **THEN** the system SHALL rely on the import staging dialog's inline conflict resolution to determine whether to overwrite or rename

#### Scenario: Import encounters directory without SKILL.md
- **WHEN** a top-level directory in the ZIP does not contain a `SKILL.md` file
- **THEN** the system SHALL skip that directory and continue loading other skills into the dialog

##### Example: ZIP with invalid directories
- **GIVEN** a ZIP containing `/valid-skill/SKILL.md`, `/empty-dir/`, and `/no-skill-md/some-file.txt`
- **WHEN** the user selects this ZIP for import
- **THEN** the system returns only `valid-skill` as an `ImportCandidate`
- **AND** `empty-dir` and `no-skill-md` are skipped

#### Scenario: Import result reporting
- **WHEN** the user executes the final import from the staging dialog
- **THEN** the system SHALL apply the selected skills to the canonical directory
- **AND** the Discovered pane SHALL update accurately to reflect imported and skipped skills


<!-- @trace
source: skill-import-folder-source
updated: 2026-06-11
code:
  - .session/ui-design-guidelines.md
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - .knowledge/milestones.md
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/skill_import.rs
  - .session/release-notes-v1.0.0.md
  - README.md
  - .session/felina_development_report.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - .session/agent-skill-market-complete.md
  - .session/felina_hackathon_ppt_spec_report.md
  - .knowledge/knowledge-base/platform.md
  - src/lib/i18n/locales/en.ts
  - src/lib/tauri/commands.ts
-->

---
### Requirement: Reset skill library

The system SHALL provide a backend command that deletes all canonical skill directories under `~/.felina/skills/`. The `.git/` directory at the root of `~/.felina/skills/` (snapshot repository) SHALL also be deleted during reset. The system SHALL require a confirmation step before executing the reset. The frontend SHALL display a confirmation dialog warning that all skills will be permanently deleted and recommending export before reset.

#### Scenario: User resets the skill library

- **WHEN** user clicks the Reset button
- **THEN** a confirmation dialog appears warning about permanent deletion and recommending export first
- **AND** if user confirms, the system deletes all contents of `~/.felina/skills/` including `.git/`
- **AND** the system returns the count of skills deleted

#### Scenario: User cancels reset

- **WHEN** user clicks Cancel in the confirmation dialog
- **THEN** no changes are made to the skill library


<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Skill Library section in Felina Settings

The Felina Settings page SHALL display a "Skill Library" section. The section SHALL show the current count of canonical skills. The section SHALL provide three action buttons: Export (download icon), Import (upload icon), and Reset (trash icon). The Reset button SHALL use danger styling. All button labels and messages SHALL use i18n keys under the `felinaSettings.skillLibrary` namespace.

#### Scenario: User views the Skill Library section

- **WHEN** user navigates to the Felina Settings page
- **THEN** the Skill Library section is visible with the current skill count and three action buttons

#### Scenario: Skill count updates after import or reset

- **WHEN** user completes an import or reset operation
- **THEN** the displayed skill count SHALL update to reflect the current state

<!-- @trace
source: canonical-skill-export-import
updated: 2026-05-29
code:
  - src-tauri/src/commands/mod.rs
  - docs/tokscale-backed-token-ingestion.md
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/tokens/storage.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/aggregator.rs
-->

---
### Requirement: Shared `.agents/skills` Convention

Non-Anthropic agents (OpenAI Codex, Google Gemini Antigravity CLI, and any future agent that adopts the OpenAgents convention) MUST use `.agents/skills/` as their shared project-relative skill directory. This is an industry convention, not a Felina coincidence — it is the contract that lets a project ship one folder of skills usable by every non-Anthropic agent without duplication.

Anthropic is the only exception: it uses its own `.claude/skills/` because it pre-dates the OpenAgents convention.

Implementations that scan, push, or otherwise resolve agent skill paths MUST treat this as a structural invariant:

- When two non-Anthropic agents resolve to the same physical `.agents/skills/` directory, that is INTENDED behavior, not a configuration bug. The system SHALL NOT collapse, de-duplicate, or hide the fact that the file is reachable by multiple agents. The user retains the right to choose which agent attribution applies on import, push, or target editing.
- Codex's optional `agents/openai.yaml` sidecar lives inside the shared `.agents/skills/<skill>/` tree. Gemini SHALL ignore the sidecar without error. Fan-out and import logic SHALL treat sidecar handling as agent-specific, not directory-specific.
- The fact that `.agents/skills/` is shared MUST NOT be re-discovered, re-debated, or re-implemented per change. New scanner/fan-out/import code SHALL be written assuming the shared-directory invariant and SHALL document any deviation explicitly.

#### Scenario: Codex and Gemini share project skill directory by design
- **GIVEN** a project contains `.agents/skills/foo/SKILL.md`
- **AND** the agent paths configuration resolves codex and gemini project skill directories to `.agents/skills`
- **WHEN** any subsystem (scan, push, target editing) inspects that directory
- **THEN** the system SHALL recognize `foo` as reachable by both codex and gemini
- **AND** the system SHALL NOT treat the shared resolution as a configuration error or attempt to force them to separate directories


<!-- @trace
source: skill-import-dialog-redesign
updated: 2026-06-01
code:
  - .session/projects-page-ui-adjustment-report.md
  - src-tauri/tauri.conf.json
  - .session/archive/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/import/staging-logic.ts
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/i18n/locales/en.ts
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/assets/logo.png
  - src/lib/assets/logo_.png
  - src/lib/components/projects/ProjectsPage.tsx
tests:
  - tests/staging-logic.test.ts
-->

---
### Requirement: Import scan path deduplication

Agent skill directories MUST be configured through a single source of truth. When an agent has additional legacy global locations to probe beyond its configured global path, those extra locations SHALL be derived from that single source of truth and SHALL exclude any path equal to the agent's configured global path. The import scanner SHALL NOT hard-code agent skill paths independently of the configured agent paths. The same physical directory SHALL NOT be scanned more than once for the same agent.

When two distinct agents are configured to read the same physical directory (for example, a shared project-relative directory like `.agents/skills`), the scanner SHALL surface the shared file once per configured agent. The resulting multi-source candidate SHALL allow the user to choose which agent attribution the import is recorded under; the user's selection determines the imported `SkillTarget`'s `agent` field and which agent-specific import side-effects run (e.g. Codex `openai.yaml` merging only runs when the selected source agent is Codex).

#### Scenario: Gemini global path probed once when legacy equals configured
- **WHEN** the import scanner probes Gemini global locations and the configured Gemini global path equals a legacy probe path
- **THEN** the scanner SHALL probe that directory exactly once
- **AND** a single Gemini skill SHALL appear as one candidate, not a duplicated multi-source row

#### Scenario: Shared project-relative directory surfaces as multi-source for user selection
- **WHEN** codex and gemini are both configured to resolve their project skill directory to the same path (e.g. `.agents/skills`)
- **AND** a SKILL.md exists in that shared directory
- **THEN** the scanner SHALL surface the skill as a multi-source candidate listing both codex and gemini
- **AND** the user SHALL select which agent the import is attributed to

<!-- @trace
source: skill-import-dialog-redesign
updated: 2026-06-01
code:
  - .session/projects-page-ui-adjustment-report.md
  - src-tauri/tauri.conf.json
  - .session/archive/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/skill_import.rs
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/import/staging-logic.ts
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/i18n/locales/en.ts
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/assets/logo.png
  - src/lib/assets/logo_.png
  - src/lib/components/projects/ProjectsPage.tsx
tests:
  - tests/staging-logic.test.ts
-->

---
### Requirement: Import skills from folder

The system SHALL provide a backend command (`skill_import_scan_dir`) that scans a user-selected directory for valid skills and returns a list of `ImportCandidate` records whose `source_path` points directly at the original on-disk locations. The command SHALL NOT copy the directory contents to a temporary location and SHALL NOT write to the canonical `~/.felina/skills/` directory during scanning.

The scan SHALL apply the following resolution order:

1. If the selected directory itself contains a `SKILL.md` file, the command SHALL return exactly one candidate whose skill name is the selected directory's name.
2. Otherwise, the command SHALL scan only the first-level subdirectories of the selected directory and return one candidate per subdirectory containing a `SKILL.md` file; subdirectories without `SKILL.md` SHALL be skipped. The scan SHALL NOT recurse deeper than the first level.
3. If neither rule yields a candidate, the command SHALL return an empty list, which the frontend SHALL treat as "no skills found" rather than an error.

If the provided path does not exist or is not a directory, the command SHALL return an error string, which the frontend SHALL display in the import staging dialog's existing error area.

Candidates produced from a folder scan SHALL flow through the same staging, conflict resolution, and apply pipeline as ZIP-sourced candidates: they SHALL be placed directly into the right "Staging" pane, and same-name conflicts SHALL be resolved by the staging card's built-in overwrite / rename UI. The system SHALL NOT load `.felina-sync-meta.json` from the source folder as part of the candidate; applying staged skills SHALL generate clean sync metadata.

#### Scenario: User selects a folder that is itself a skill directory
- **WHEN** user clicks "Browse Folder" and selects a directory that directly contains a `SKILL.md`
- **THEN** the system returns exactly one `ImportCandidate` named after the selected directory
- **AND** the candidate appears in the right "Staging" pane

#### Scenario: User selects a folder containing multiple skill directories
- **WHEN** user clicks "Browse Folder" and selects a directory whose first-level subdirectories contain `SKILL.md` files
- **THEN** the system returns one `ImportCandidate` per qualifying subdirectory
- **AND** subdirectories without `SKILL.md` are skipped

##### Example: mixed parent folder
- **GIVEN** a selected folder containing `alpha/SKILL.md`, `beta/SKILL.md`, `notes/readme.txt`, and a loose file `stray.md`
- **WHEN** the user selects this folder via "Browse Folder"
- **THEN** the system returns candidates `alpha` and `beta` only
- **AND** `notes` and `stray.md` are ignored

#### Scenario: Selected folder contains no skills
- **WHEN** user selects a directory where neither the directory itself nor any first-level subdirectory contains a `SKILL.md`
- **THEN** the command returns an empty list
- **AND** the Staging pane is unchanged and no error is shown

#### Scenario: Source folder deleted before apply
- **WHEN** the user stages a folder-sourced candidate and the source directory is deleted before executing the import
- **THEN** the apply step SHALL fail with an explicit error message for that candidate rather than silently skipping it

<!-- @trace
source: skill-import-folder-source
updated: 2026-06-11
code:
  - .session/ui-design-guidelines.md
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - .knowledge/milestones.md
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/skill_import.rs
  - .session/release-notes-v1.0.0.md
  - README.md
  - .session/felina_development_report.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/architecture.md
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - .session/agent-skill-market-complete.md
  - .session/felina_hackathon_ppt_spec_report.md
  - .knowledge/knowledge-base/platform.md
  - src/lib/i18n/locales/en.ts
  - src/lib/tauri/commands.ts
-->