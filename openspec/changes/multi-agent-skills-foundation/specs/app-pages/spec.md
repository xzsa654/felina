## ADDED Requirements

### Requirement: Settings Page Agent Paths Section

The Settings page SHALL provide a section that lets the user view and override the skill directory paths for each supported agent. The section SHALL expose, for each of the three supported agents (Anthropic, Codex, Gemini), a global path field and a project-relative path field, for six fields total. Each field SHALL default to the value defined by the agent-skills-schema reference. The system SHALL persist overrides and SHALL use the configured paths both for fan-out target locations and for import detection scope. The system SHALL reject a path that contains a parent-directory traversal segment or that escapes the user home or project root, falling back to the previous valid value and surfacing a warning. The section SHALL NOT expose configuration for any fourth agent.

#### Scenario: Default agent paths shown

- **WHEN** a user opens the Settings page Agent Paths section without having set overrides
- **THEN** the system SHALL display the schema-reference default paths for Anthropic, Codex, and Gemini
- **AND** the section SHALL show exactly six path fields (global and project for each of the three agents)

#### Scenario: Override changes fan-out target

- **WHEN** a user changes the Gemini project path to the `.agents/skills/` alias and saves
- **THEN** a subsequent push of a Gemini-targeted skill SHALL write to the new path
- **AND** import detection SHALL scan the new path

#### Scenario: Reject path traversal

- **WHEN** a user enters a path containing a parent-directory traversal segment
- **THEN** the system SHALL reject the value
- **AND** the system SHALL retain the previous valid value and surface a warning

#### Scenario: Fourth agent not configurable

- **WHEN** a user views the Agent Paths section
- **THEN** the system SHALL show configuration only for Anthropic, Codex, and Gemini
- **AND** the section SHALL NOT present fields for any other agent
