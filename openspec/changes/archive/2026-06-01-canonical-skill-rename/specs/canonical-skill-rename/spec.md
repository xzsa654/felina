## ADDED Requirements

### Requirement: Rename canonical skill

The system SHALL provide an IPC command that renames a canonical skill from an old name to a new name. The rename SHALL validate that the new name is non-empty, does not contain path traversal characters (`..\`, `/`, `\`), and does not collide with an existing canonical skill directory. The rename SHALL update the canonical directory name, the SKILL.md frontmatter `name` field, and create a git commit in the canonical repo recording the rename. The rename SHALL delete all agent-side skill directories that correspond to the old name across all targets defined in the skill's sync-meta. Agent-side deletion failures SHALL be non-fatal and reported in the result. After rename, the sync-meta SHALL have `dirty` set to `true` and all `last_sync` entries cleared so that the next push writes to the new name location.

#### Scenario: Successful rename updates canonical and cleans agent-side

- **GIVEN** a canonical skill named `code-review` with two targets (Anthropic global, Gemini project) that have been pushed
- **WHEN** the user renames it to `pr-review`
- **THEN** the canonical directory is `~/.felina/skills/pr-review/`
- **AND** the SKILL.md frontmatter `name` field is `pr-review`
- **AND** a git commit exists in the canonical repo with message containing `code-review` and `pr-review`
- **AND** the old agent-side directories (`.claude/skills/code-review/`, `.gemini/skills/code-review/`) are deleted
- **AND** sync-meta `dirty` is `true` and `last_sync` is empty

##### Example: rename result shape

- **GIVEN** skill `code-review` with 2 targets both previously pushed
- **WHEN** renamed to `pr-review`
- **THEN** result contains `old_name: "code-review"`, `new_name: "pr-review"`, `commit_hash` (40-char hex), `targets_cleaned: 2`, `targets_failed: []`

#### Scenario: Reject invalid new name

- **WHEN** the user attempts to rename a skill to a name containing `..` or `/` or `\`
- **THEN** the system SHALL return an error without modifying any files

#### Scenario: Reject duplicate name

- **GIVEN** canonical skills `code-review` and `pr-review` both exist
- **WHEN** the user attempts to rename `code-review` to `pr-review`
- **THEN** the system SHALL return an error without modifying any files

#### Scenario: Reject empty name

- **WHEN** the user attempts to rename a skill to an empty string
- **THEN** the system SHALL return an error without modifying any files

#### Scenario: Agent-side deletion partial failure is non-fatal

- **GIVEN** skill `code-review` with 2 targets, one pointing to an inaccessible directory
- **WHEN** the user renames it to `pr-review`
- **THEN** the canonical rename and git commit succeed
- **AND** the accessible target's old agent-side directory is deleted
- **AND** the inaccessible target's path appears in `targets_failed`
- **AND** sync-meta is still updated (dirty = true, last_sync cleared)

### Requirement: Rename skill UI

The SkillEditor toolbar SHALL display a Rename button alongside Delete and Save when editing an existing skill. Clicking the button SHALL open a dialog where the user enters the new name. The dialog SHALL validate the input in real-time: reject empty input, input identical to the current name, and input containing path traversal characters. On confirmation, the system SHALL call the rename command and, on success, refresh the skill list and select the renamed skill. On failure, the system SHALL display the error message in the dialog.

#### Scenario: Rename button visible only for existing skills

- **WHEN** the user is editing an existing skill
- **THEN** the Rename button is visible in the toolbar

#### Scenario: Rename button hidden for new skills

- **WHEN** the user is creating a new skill
- **THEN** the Rename button is not rendered

#### Scenario: Dialog validates input

- **WHEN** the user enters an empty name or the same name or a name with `/`
- **THEN** the confirm button is disabled

#### Scenario: Successful rename refreshes list

- **GIVEN** the user renames `code-review` to `pr-review` via the dialog
- **WHEN** the rename command succeeds
- **THEN** the skill list reloads and `pr-review` is selected
