## MODIFIED Requirements

### Requirement: Settings Page Agent Paths Section

The Settings page SHALL NOT render the Agent Paths section. The Agent Paths section SHALL be rendered exclusively within the Felina Settings page at `/felina-settings`. All other Settings page behavior (Claude global/project/local settings read/write, Budget, Maintenance/Storage) SHALL remain unchanged.

#### Scenario: Default agent paths shown

- **WHEN** a user opens the Felina Settings page Agent Paths section without having set overrides
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

#### Scenario: Agent Paths absent from Settings page

- **WHEN** the user opens the Settings page at `/settings`
- **THEN** the Agent Paths section SHALL NOT be rendered on that page
