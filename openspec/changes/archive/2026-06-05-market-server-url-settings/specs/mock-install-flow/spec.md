## MODIFIED Requirements

### Requirement: Local Package Extraction

The `install_market_skill` Tauri command SHALL download the skill package from the configured market server URL (read via the Market Server URL Read Command) instead of a hardcoded `http://localhost:3100` base URL. All other extraction behavior SHALL remain unchanged.

#### Scenario: Successful extraction

- **WHEN** the `install_market_skill` command executes successfully
- **THEN** the skill's markdown and manifest files SHALL be written to the canonical skill directory, using the URL from the persisted market server setting
