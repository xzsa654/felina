## ADDED Requirements

### Requirement: Install Skill Action

The Hub page SHALL provide an "Install" button on each skill card that triggers the local installation process via a Tauri command.

#### Scenario: Initiating a skill install

- **WHEN** the user clicks "Install" on a skill card
- **THEN** the frontend SHALL invoke the `install_market_skill` Tauri command with the skill ID

### Requirement: Local Package Extraction

The `install_market_skill` Tauri command SHALL download the skill package from the local API and extract it to the user's `~/.felina/skills/<skill-name>` directory, overwriting existing files if present.

#### Scenario: Successful extraction

- **WHEN** the `install_market_skill` command executes successfully
- **THEN** the skill's markdown and manifest files SHALL be written to the canonical skill directory

### Requirement: Directory Hash Recording on Install

The `install_market_skill` command SHALL compute a `directory_hash` of the installed skill directory (SHA-256 of `semantic_hash(SKILL.md)` concatenated with sorted sibling file hashes) and write it to `.felina-sync-meta.json` immediately after extraction. This enables the Hub page to compare local content against the Hub version without maintaining a persistent link.

#### Scenario: Hash written after install

- **WHEN** the `install_market_skill` command completes extraction
- **THEN** the `.felina-sync-meta.json` in the skill directory SHALL contain a `directoryHash` field with the SHA-256 hex digest representing the full directory content

##### Example: hash recording

- **GIVEN** a skill `code-review` installed from Hub with SKILL.md content and no sibling files
- **WHEN** install completes
- **THEN** `~/.felina/skills/code-review/.felina-sync-meta.json` contains `"directoryHash": "<sha256-hex>"`
