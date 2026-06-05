## MODIFIED Requirements

### Requirement: Hub UI Presentation

The Hub page SHALL read the market server base URL from the persisted setting (via the Market Server URL Read Command) instead of using a hardcoded `http://localhost:3100` constant. The fetch call to `/api/skills` SHALL use this configured URL. The Hub page SHALL identify each market skill by its `name` field as returned by the server; it SHALL NOT depend on a separate `id` field. React keys, install-status maps, and install/uninstall command invocations SHALL all use `name` as the key.

#### Scenario: Viewing the Hub page

- **WHEN** the Hub page loads
- **THEN** the UI SHALL fetch the list of skills from the configured market server URL and render them as glassmorphism cards keyed by `skill.name`, without using HTML tables and without referencing a `skill.id` field

### Requirement: Installed State Display

The Hub page SHALL indicate which market skills match local content by comparing skill `name` AND `directory_hash`. The `directory_hash` is a SHA-256 digest covering the entire skill directory (SKILL.md + sibling files). The Hub API SHALL provide `contentHash` per skill; the local hash SHALL be read from `.felina-sync-meta.json`. The `name` field SHALL be the sole skill identifier in both UI state and download command parameters; no `id` field SHALL be required.

#### Scenario: Displaying up-to-date state

- **WHEN** the Hub page loads and a local canonical skill has the same name AND its `directoryHash` in `.felina-sync-meta.json` matches the Hub skill's `contentHash`
- **THEN** the corresponding card SHALL display an "Up to date" indicator instead of the "Install" button

#### Scenario: Installing a market skill

- **WHEN** the user clicks Install on a market skill card
- **THEN** the Hub page SHALL invoke `install_market_skill` with the skill's `name` as the parameter (no separate `id` field is involved)

## ADDED Requirements

### Requirement: Hub Publish Entry Point

The Hub page SHALL provide a minimal publish entry point that allows the user to select a canonical skill and upload it to the configured market server. The exact placement and styling of this entry point is provisional; final UX placement is deferred to a subsequent change. The entry SHALL invoke the publish_canonical_skill Tauri command and SHALL surface success and failure outcomes to the user via the Hub page.

#### Scenario: Publishing a canonical skill from the Hub

- **WHEN** the user activates the Hub publish entry point, selects an existing canonical skill, and confirms the upload
- **THEN** the Hub page SHALL invoke publish_canonical_skill with the selected name and SHALL display a success indicator on HTTP 2xx or an error message containing the failure reason on Err

#### Scenario: Publishing when no canonical skills exist

- **WHEN** the user activates the Hub publish entry point and `~/.felina/skills/` contains zero canonical skills
- **THEN** the Hub page SHALL communicate that there is nothing to publish and SHALL NOT invoke the publish command
