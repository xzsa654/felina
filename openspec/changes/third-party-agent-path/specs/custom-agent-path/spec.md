## ADDED Requirements

### Requirement: Custom Agent Path CRUD

The system SHALL allow users to create, edit, and delete custom agent path entries via the Settings page. Each entry SHALL have a unique kebab-case agent key, a global path, a project-relative path, an optional display label, and an optional icon file path. The system SHALL persist entries in the settings JSON under an `agents` key as a `HashMap<String, AgentPathPair>`. Built-in agents (anthropic, codex, gemini) SHALL NOT be deletable.

#### Scenario: Adding a custom agent path

- **WHEN** the user opens Settings → Agent Paths and clicks "Add Agent Path"
- **AND** enters agent key "aider", global path "~/.aider/skills", project-relative path ".aider/skills"
- **THEN** the system SHALL persist the new entry and display it in the Agent Paths list

##### Example: Agent path entries after adding custom

| Agent Key | Global | Project Relative | Deletable |
| --------- | ------ | ---------------- | --------- |
| anthropic | ~/.claude/skills | .claude/skills | no |
| codex | ~/.codex/skills | .agents/skills | no |
| gemini | ~/.gemini/antigravity-cli/skills | .agents/skills | no |
| aider | ~/.aider/skills | .aider/skills | yes |

#### Scenario: Rejecting duplicate agent key

- **GIVEN** an agent path entry with key "aider" already exists
- **WHEN** the user attempts to add another entry with key "aider"
- **THEN** the system SHALL reject the creation and display a validation error

#### Scenario: Rejecting invalid agent key

- **GIVEN** the user enters an agent key containing `..` or path separator characters
- **WHEN** the user submits the Add Agent Path form
- **THEN** the system SHALL reject the creation with a validation error

#### Scenario: Deleting a custom agent path (without disk cleanup)

- **GIVEN** a custom agent "aider" exists with targets on 2 skills
- **WHEN** the user clicks delete on the "aider" entry
- **THEN** the system SHALL display a confirmation dialog listing 2 affected skills and a "Delete disk files" checkbox (unchecked by default)
- **AND WHEN** the user confirms without checking the checkbox
- **THEN** the system SHALL remove the agent entry from config and remove all "aider" targets from all skill sync-meta files
- **AND** the system SHALL NOT delete any files on disk

#### Scenario: Deleting a custom agent path (with disk cleanup)

- **GIVEN** a custom agent "aider" with global path "~/.aider/skills" exists and no other agent shares that global path
- **WHEN** the user clicks delete, checks "Delete disk files", and confirms
- **THEN** the system SHALL remove the agent entry from config, remove all targets from sync-meta, and delete the "~/.aider/skills" directory from disk
- **AND** the system SHALL display a note that project-relative paths need manual cleanup

#### Scenario: Shared global path prevents disk cleanup

- **GIVEN** a custom agent "aider" with global path "~/.shared/skills" exists
- **AND** another agent "other-tool" also has global path "~/.shared/skills"
- **WHEN** the user clicks delete on the "aider" entry
- **THEN** the "Delete disk files" checkbox SHALL be disabled
- **AND** the system SHALL display a message indicating the path is shared by "other-tool"

#### Scenario: Preventing deletion of built-in agents

- **WHEN** the system renders Settings → Agent Paths
- **THEN** built-in agent entries (anthropic, codex, gemini) SHALL NOT display a delete control

### Requirement: Generic Fan-Out Renderer

The system SHALL provide a generic fan-out renderer for agents that are not built-in (anthropic, codex, gemini). The generic renderer SHALL output a single SKILL.md file containing YAML frontmatter with `name` and `description` fields copied from the canonical skill, followed by the body content. The generic renderer SHALL NOT produce sibling files and SHALL NOT perform agent-specific field transformations.

#### Scenario: Pushing a skill to a custom agent target

- **GIVEN** a canonical skill "my-skill" with name "My Skill", description "Does things", and body "# Instructions\n\nDo stuff"
- **AND** a custom agent "aider" with global path "~/.aider/skills"
- **WHEN** the system pushes "my-skill" to the aider global target
- **THEN** the file at "~/.aider/skills/my-skill/SKILL.md" SHALL contain frontmatter with `name: My Skill` and `description: Does things` followed by the body

#### Scenario: Generic renderer does not produce sibling files

- **GIVEN** a canonical skill with bundled sibling files (e.g., helper.sh)
- **WHEN** the system pushes to a custom agent target using the generic renderer
- **THEN** sibling files SHALL be copied to the target directory as-is (via the shared `copy_bundled_siblings` mechanism)
- **AND** the generic renderer itself SHALL NOT generate additional sibling files (unlike Codex renderer which generates agents/openai.yaml)

### Requirement: Settings JSON Migration

The system SHALL support reading the legacy settings format where agent paths are stored as three top-level keys (`anthropic`, `codex`, `gemini`) and the new format where paths are stored under a single `agents` key as a HashMap. When reading, the system SHALL attempt the new format first, then fall back to the legacy format. The system SHALL NOT perform a write-back migration; the next user-initiated save SHALL write the new format.

#### Scenario: Reading legacy settings format

- **GIVEN** settings JSON contains `{ "anthropic": {"global": "~/.claude/skills", "projectRelative": ".claude/skills"}, "codex": {...}, "gemini": {...} }`
- **WHEN** the system reads agent paths config
- **THEN** the system SHALL return a HashMap with three entries matching the legacy values

#### Scenario: Reading new settings format

- **GIVEN** settings JSON contains `{ "agents": { "anthropic": {...}, "codex": {...}, "gemini": {...}, "aider": {...} } }`
- **WHEN** the system reads agent paths config
- **THEN** the system SHALL return a HashMap with four entries including the custom "aider" entry

### Requirement: Custom Agent Icon Display

The system SHALL display an icon for custom agents in TargetChips and other agent-identifying UI. The system SHALL resolve the icon using this priority: (1) custom icon file path from the agent's config `icon` field, (2) built-in icon asset for built-in agents, (3) the agent's `label` text, (4) the agent key as capitalized text. The icon file path SHALL be converted to a webview-accessible URL via Tauri's asset protocol.

#### Scenario: Displaying custom agent icon

- **GIVEN** a custom agent "aider" with icon path "~/.felina/icons/aider.png"
- **WHEN** the system renders a target chip for the "aider" agent
- **THEN** the chip SHALL display the image from the specified icon path

#### Scenario: Fallback when icon path is missing

- **GIVEN** a custom agent "my-agent" with no icon configured and label "My Agent"
- **WHEN** the system renders a target chip for "my-agent"
- **THEN** the chip SHALL display the text "My Agent"

#### Scenario: Fallback when both icon and label are missing

- **GIVEN** a custom agent "my-agent" with no icon and no label configured
- **WHEN** the system renders a target chip for "my-agent"
- **THEN** the chip SHALL display "my-agent" as capitalized text
