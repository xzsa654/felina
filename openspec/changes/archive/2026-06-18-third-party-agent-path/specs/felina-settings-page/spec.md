## ADDED Requirements

### Requirement: Agent Paths Settings Section

The Settings page SHALL display an Agent Paths section that lists all configured agent path entries as a dynamic list. Built-in agents (anthropic, codex, gemini) SHALL appear first, followed by custom agents sorted alphabetically by key. Each entry SHALL display the agent key (or label if set), global path, and project-relative path as editable fields. Custom entries SHALL include a delete button; built-in entries SHALL NOT. The section SHALL include an "Add Agent Path" button that opens a creation dialog.

#### Scenario: Rendering agent paths with custom entries

- **GIVEN** the agent paths config contains 3 built-in entries and 2 custom entries ("aider", "continue")
- **WHEN** the Settings page renders the Agent Paths section
- **THEN** the section SHALL display 5 entries: anthropic, codex, gemini (in fixed order), then aider, continue (alphabetical)
- **AND** only aider and continue SHALL have delete buttons

#### Scenario: Editing a custom agent path

- **GIVEN** a custom agent "aider" with global path "~/.aider/skills"
- **WHEN** the user changes the global path to "~/.aider/v2/skills" and saves
- **THEN** the system SHALL persist the updated path
