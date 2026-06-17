## ADDED Requirements

### Requirement: Open Agent Identity

The system SHALL use an open string type for agent identity (`AgentId`) instead of a sealed enumeration. Built-in agents SHALL be identified by the string constants "anthropic", "codex", and "gemini". The fan-out renderer dispatch SHALL match built-in agent keys to their specialized renderers and fall back to the generic renderer for all other agent keys.

#### Scenario: Fan-out dispatch for built-in agent

- **GIVEN** a target with agent key "anthropic"
- **WHEN** the system selects a renderer for this target
- **THEN** the system SHALL use the Anthropic-specific renderer (kebab-case frontmatter, full field mapping)

#### Scenario: Fan-out dispatch for custom agent

- **GIVEN** a target with agent key "aider" (not a built-in)
- **WHEN** the system selects a renderer for this target
- **THEN** the system SHALL use the generic renderer (name + description frontmatter only)

#### Scenario: Add Target dialog lists all configured agents

- **GIVEN** the agent paths config contains built-in agents and custom agents
- **WHEN** the user opens the Add Target dialog for a skill
- **THEN** the agent dropdown SHALL list all agent keys from the current config
- **AND** the dropdown SHALL NOT include agents that are not in the config
