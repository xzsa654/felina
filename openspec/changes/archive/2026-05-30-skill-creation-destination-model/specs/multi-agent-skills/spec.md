## ADDED Requirements

### Requirement: Interactive Skill Creation Flow

The system SHALL present an interactive creation dialog when the user initiates a new skill creation. The dialog SHALL mandate that the user provides a `Skill Name` and selects an `Initial Target`. The initial target selection SHALL offer Global, a specific Project, or "None". 

When the user submits the dialog, the system SHALL create the canonical skill directory and `SKILL.md` using the provided name, and immediately write the selected initial target (if not "None") into the skill's sync-meta sidecar (`.felina-sync-meta.json`) as an enabled and tracked target. The system SHALL NOT create a skill without this explicit user flow.

#### Scenario: User creates a skill and binds a global target

- **WHEN** the user clicks "New Skill"
- **THEN** the system SHALL display the Create Skill Dialog
- **WHEN** the user inputs "code-reviewer" and selects a Global Anthropic target, then submits
- **THEN** the system SHALL create `~/.felina/skills/code-reviewer/SKILL.md` with `name: code-reviewer`
- **AND** the system SHALL write a sync-meta sidecar containing the Global Anthropic target
- **AND** the system SHALL navigate to the editor for "code-reviewer"

#### Scenario: User creates a skill with no initial target

- **WHEN** the user opens the Create Skill Dialog, inputs "brainstorm-helper", and selects "None" for the target
- **THEN** the system SHALL create the canonical skill
- **AND** the skill's sync-meta sidecar SHALL contain an empty targets array
- **AND** the system SHALL navigate to the editor for "brainstorm-helper"
