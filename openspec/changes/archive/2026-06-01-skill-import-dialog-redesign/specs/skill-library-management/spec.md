## MODIFIED Requirements

### Requirement: Import skills from ZIP

The system SHALL provide a backend command that reads a ZIP file and extracts canonical skill directories into `~/.felina/skills/`. Each top-level directory in the ZIP SHALL be treated as a skill directory. The system SHALL validate that each extracted directory contains a `SKILL.md` file; directories without `SKILL.md` SHALL be skipped. The system SHALL NOT write `.felina-sync-meta.json` during import; the existing `read_sync_meta_v2` backfill mechanism SHALL generate sync metadata on first read. The system SHALL use Tauri's open dialog to let the user choose the input ZIP file. When the user selects a ZIP file, the system SHALL extract its valid skill contents and populate them into the left "Discovered" pane of the import staging dialog, rather than immediately executing the import to the canonical directory.

#### Scenario: User imports skills from ZIP
- **WHEN** user clicks the Import button and selects a valid ZIP file
- **THEN** the system extracts the skills and loads them into the import staging dialog
- **AND** does NOT immediately write them to the canonical `~/.felina/skills/` directory

#### Scenario: Import encounters existing skill with same name
- **WHEN** a skill staged for import matches an existing canonical skill
- **THEN** the system SHALL rely on the import staging dialog's inline conflict resolution to determine whether to overwrite or rename

#### Scenario: Import encounters directory without SKILL.md
- **WHEN** a top-level directory in the ZIP does not contain a `SKILL.md` file
- **THEN** the system SHALL skip that directory and continue loading other skills into the dialog

#### Scenario: Import result reporting
- **WHEN** the user executes the final import from the staging dialog
- **THEN** the system SHALL return a summary containing the count of skills imported and the count of directories skipped

## ADDED Requirements

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
