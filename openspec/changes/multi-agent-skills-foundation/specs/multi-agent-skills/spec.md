## ADDED Requirements

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

### Requirement: Fan-Out to Agent Targets

The system SHALL render a canonical skill into each agent-native skill directory listed in the skill's `agents` field. Fan-out SHALL be one-directional (canonical to agent); the system SHALL NOT read agent-native files back into canonical in this capability. Each agent target SHALL apply that agent's field mapping as defined by the agent-skills-schema reference: Anthropic SHALL rename snake_case fields to kebab-case and write a single `SKILL.md`; Codex SHALL write `SKILL.md` with `name` and `description` plus a sibling `agents/openai.yaml` for UI metadata; Gemini SHALL write `SKILL.md` containing only `name` and `description` and ignore other fields. When a target directory does not exist, the system SHALL create it. When a target write fails, the system SHALL report that target as failed without aborting the other targets.

#### Scenario: Push a skill to all three agents

- **WHEN** a user pushes a skill whose `agents` field is `[anthropic, codex, gemini]`
- **THEN** the system SHALL write the Anthropic target with kebab-case frontmatter
- **AND** the system SHALL write the Codex target as a `SKILL.md` plus a sibling `agents/openai.yaml`
- **AND** the system SHALL write the Gemini target containing only `name` and `description`

#### Scenario: Push to a subset of agents

- **WHEN** a user pushes a skill whose `agents` field is `[anthropic]`
- **THEN** the system SHALL write only the Anthropic target
- **AND** the system SHALL NOT create or modify the Codex or Gemini target directories for that skill

#### Scenario: One target fails, others continue

- **WHEN** a push runs and the Codex target directory cannot be written (for example, permission denied)
- **THEN** the system SHALL return a per-agent result marking Codex as failed with an error message
- **AND** the Anthropic and Gemini targets SHALL still be written successfully

##### Example: per-agent push results

| Agent | Target writable | Result |
| ----- | --------------- | ------ |
| anthropic | yes | success |
| codex | no (permission denied) | failed, error recorded |
| gemini | yes | success |

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

### Requirement: Visual Frontmatter Editor

The system SHALL present skill frontmatter through a visual form and SHALL NOT expose a raw YAML editing surface for the canonical SKILL.md. The editor SHALL render one input control per canonical field appropriate to its type (text input, multi-select, boolean toggle, or enumerated dropdown). Low-frequency optional fields SHALL be grouped under a collapsible advanced section. The Markdown body SHALL be edited in a plain text area. The form SHALL serialize to and deserialize from the canonical snake_case YAML so that the user never needs to know agent-specific field naming.

#### Scenario: Edit frontmatter via the form

- **WHEN** a user opens a skill in the editor
- **THEN** the system SHALL render the frontmatter as form controls, not as raw YAML text
- **AND** saving the form SHALL serialize the values back into canonical snake_case YAML

#### Scenario: Advanced fields are collapsed by default

- **WHEN** a user opens the editor for a skill
- **THEN** the required fields SHALL be visible
- **AND** low-frequency optional fields SHALL be hidden under a collapsible advanced section that is collapsed by default

#### Scenario: No raw YAML surface

- **WHEN** a user is editing a skill
- **THEN** the system SHALL NOT provide a raw YAML editing tab or a switch-to-YAML mode for the frontmatter
