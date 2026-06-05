# market-server-config Specification

## Purpose

TBD - created by archiving change 'market-server-url-settings'. Update Purpose after archive.

## Requirements

### Requirement: Market Server URL Setting

The Felina Settings page SHALL include a "Market Server" section with a text input field for configuring the market server base URL. The setting SHALL persist across application restarts.

#### Scenario: Configuring the URL

- **WHEN** the user enters a URL in the Market Server URL field and saves
- **THEN** the value SHALL be persisted and used by Hub page and install command on next invocation

#### Scenario: Default value

- **WHEN** no URL has been configured by the user
- **THEN** the default value SHALL be `http://localhost:3100`


<!-- @trace
source: market-server-url-settings
updated: 2026-06-05
code:
  - src/lib/i18n/locales/zh-TW.ts
  - .knowledge/_catalog.json
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/settings/MarketServerSection.tsx
  - src-tauri/src/commands/market_server.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/market_install.rs
  - src/lib/tauri/commands.ts
  - .knowledge/knowledge-base/architecture.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - .knowledge/knowledge-base/_index.json
  - .knowledge/knowledge-base/tauri.md
  - src/lib/components/hub/HubPage.tsx
-->

---
### Requirement: Market Server URL Read Command

The backend SHALL provide a Tauri command to read the configured market server URL, returning the persisted value or the default `http://localhost:3100` if unset.

#### Scenario: Reading configured URL

- **WHEN** the frontend invokes the read command
- **THEN** the command SHALL return the persisted URL string


<!-- @trace
source: market-server-url-settings
updated: 2026-06-05
code:
  - src/lib/i18n/locales/zh-TW.ts
  - .knowledge/_catalog.json
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/settings/MarketServerSection.tsx
  - src-tauri/src/commands/market_server.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/market_install.rs
  - src/lib/tauri/commands.ts
  - .knowledge/knowledge-base/architecture.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - .knowledge/knowledge-base/_index.json
  - .knowledge/knowledge-base/tauri.md
  - src/lib/components/hub/HubPage.tsx
-->

---
### Requirement: Market Server URL Write Command

The backend SHALL provide a Tauri command to write the market server URL to persistent storage.

#### Scenario: Writing a new URL

- **WHEN** the frontend invokes the write command with a URL string
- **THEN** the value SHALL be persisted to the settings file

<!-- @trace
source: market-server-url-settings
updated: 2026-06-05
code:
  - src/lib/i18n/locales/zh-TW.ts
  - .knowledge/_catalog.json
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/lib/components/settings/MarketServerSection.tsx
  - src-tauri/src/commands/market_server.rs
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/market_install.rs
  - src/lib/tauri/commands.ts
  - .knowledge/knowledge-base/architecture.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - .knowledge/knowledge-base/_index.json
  - .knowledge/knowledge-base/tauri.md
  - src/lib/components/hub/HubPage.tsx
-->