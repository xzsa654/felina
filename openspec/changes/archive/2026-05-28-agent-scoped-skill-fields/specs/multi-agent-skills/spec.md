## ADDED Requirements

### Requirement: Agent-Scoped Canonical Skill Fields

Canonical skill frontmatter SHALL support an `x_felina_agent_fields` mapping
for target-specific optional fields. The mapping SHALL allow `anthropic`,
`codex`, `gemini`, and `standard` namespaces. The system SHALL keep `name`,
`description`, and retained `agents` metadata outside this mapping. The system
SHALL read existing flat extras for backward compatibility, classify known
fields into the scoped mapping, preserve unknown fields, and write the scoped
mapping on the next structured save.

#### Scenario: Existing flat extras migrate on save

- **GIVEN** a canonical skill has flat extras `allowed_tools: Read` and
  `effort: high`
- **WHEN** the user opens the skill and saves it through the structured editor
- **THEN** the saved canonical frontmatter SHALL contain
  `x_felina_agent_fields.anthropic.allowed-tools: Read`
- **AND** the saved canonical frontmatter SHALL contain
  `x_felina_agent_fields.anthropic.effort: high`
- **AND** the system SHALL preserve unknown flat extras without emitting them to
  unrelated targets

#### Scenario: Scoped fields remain separate from shared fields

- **WHEN** a user saves a skill with shared `name`, shared `description`, and
  Codex `interface.display_name`
- **THEN** `name` and `description` SHALL remain top-level canonical
  frontmatter fields
- **AND** `interface.display_name` SHALL be stored under
  `x_felina_agent_fields.codex.interface.display_name`

### Requirement: Target-Filtered Advanced Field Editor

The visual frontmatter editor SHALL replace free-form Advanced key/value rows
with a target-filtered field picker. The picker SHALL derive available fields
from the selected skill's enabled targets and SHALL group fields by agent when
more than one target agent is present. The editor SHALL render each selected
field with a value control matching its catalog type and SHALL prevent
duplicate fields within the same agent namespace.

#### Scenario: Single target filters field list

- **GIVEN** a skill has one enabled Codex target
- **WHEN** the user opens the Advanced field picker
- **THEN** the picker SHALL show Codex field options
- **AND** the picker SHALL NOT show Claude Code-only fields such as
  `allowed-tools`

#### Scenario: Multiple targets are grouped by agent

- **GIVEN** a skill has enabled Claude Code and Codex targets
- **WHEN** the user opens Advanced fields
- **THEN** the editor SHALL show one group for Claude Code fields and one group
  for Codex fields
- **AND** the editor SHALL store selected values under the corresponding agent
  namespace

#### Scenario: Gemini target has no unsupported extras

- **GIVEN** a skill has only an enabled Gemini CLI target
- **WHEN** the user opens Advanced fields
- **THEN** the editor SHALL show no Gemini-specific optional field choices
  beyond shared canonical fields until the catalog contains documented Gemini
  CLI fields

### Requirement: Target-Scoped Fan-Out Filtering

Fan-out SHALL use the agent-scoped field catalog as an allowlist and SHALL emit
only fields supported by the target agent. Claude Code fan-out SHALL write
allowed Claude Code fields to `SKILL.md`. Codex fan-out SHALL write only `name`
and `description` to `SKILL.md` and SHALL write Codex metadata to
`agents/openai.yaml`. Gemini CLI fan-out SHALL write only documented Gemini CLI
fields. Unknown canonical fields SHALL be preserved in canonical storage but
SHALL NOT be emitted to any agent output.

#### Scenario: Codex fields do not leak to Claude Code

- **GIVEN** a canonical skill contains
  `x_felina_agent_fields.codex.interface.display_name: Helper`
- **AND** the skill has an enabled Claude Code target
- **WHEN** the user pushes the skill
- **THEN** the Claude Code `SKILL.md` output SHALL NOT contain `interface`,
  `display_name`, or `agents/openai.yaml` metadata

#### Scenario: Claude Code fields do not leak to Codex

- **GIVEN** a canonical skill contains
  `x_felina_agent_fields.anthropic.allowed-tools: Read Grep`
- **AND** the skill has an enabled Codex target
- **WHEN** the user pushes the skill
- **THEN** the Codex `SKILL.md` output SHALL contain `name` and `description`
- **AND** the Codex `agents/openai.yaml` output SHALL NOT contain
  `allowed-tools` or `allowed_tools`

#### Scenario: Unknown fields are preserved but not emitted

- **GIVEN** a canonical skill contains an unknown preserved field
  `vendor_future_flag: true`
- **WHEN** the user pushes the skill to Claude Code, Codex, and Gemini CLI
  targets
- **THEN** no target output SHALL contain `vendor_future_flag`
- **AND** the canonical skill SHALL retain the unknown field after saving
  unrelated edits

### Requirement: Source-Agent Import Classification

When importing a skill from an agent-native directory, the system SHALL
classify recognized source fields into the matching agent namespace. Claude
Code imports SHALL classify recognized Claude Code frontmatter fields into
`anthropic`. Codex imports SHALL classify `agents/openai.yaml` interface,
policy, and dependency metadata into `codex`. Gemini CLI imports SHALL classify
only documented Gemini CLI fields. Unknown parseable fields SHALL be preserved
without becoming cross-agent output fields.

#### Scenario: Import Claude Code fields into anthropic namespace

- **GIVEN** a source Claude Code skill has frontmatter
  `allowed-tools: Read Grep` and `effort: high`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL store those values under
  `x_felina_agent_fields.anthropic`

#### Scenario: Import Codex openai metadata into codex namespace

- **GIVEN** a Codex skill directory contains `SKILL.md` and
  `agents/openai.yaml` with `interface.display_name: Helper`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL store `Helper` under
  `x_felina_agent_fields.codex.interface.display_name`

#### Scenario: Import Gemini CLI does not invent extra fields

- **GIVEN** a Gemini CLI skill contains only `name` and `description`
- **WHEN** the user imports the skill
- **THEN** the canonical skill SHALL contain top-level `name` and `description`
- **AND** the canonical skill SHALL NOT create synthetic Gemini optional fields
