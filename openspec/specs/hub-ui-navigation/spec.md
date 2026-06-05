# hub-ui-navigation Specification

## Purpose

TBD - created by archiving change 'local-skill-market-prototype'. Update Purpose after archive.

## Requirements

### Requirement: Sidebar Hub Navigation

The Felina application SHALL include a "Hub" tab in the main sidebar navigation that routes the user to the Hub page.

#### Scenario: Navigating to the Hub

- **WHEN** the user clicks the "Hub" icon in the sidebar
- **THEN** the application SHALL navigate to the `/hub` route and display the Hub page


<!-- @trace
source: local-skill-market-prototype
updated: 2026-06-05
code:
  - market-server/dev.ps1
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/mod.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/fan_out/mod.rs
  - src-tauri/src/commands/market_install.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/stores/navigation.ts
  - src/lib/tauri/commands.ts
  - market-server/.dockerignore
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/router.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/docker-compose.yml
  - src-tauri/tauri.conf.json
  - market-server/package.json
-->

---
### Requirement: Hub UI Presentation

The Hub page SHALL read the market server base URL from the persisted setting (via the Market Server URL Read Command) instead of using a hardcoded `http://localhost:3100` constant. The fetch call to `/api/skills` SHALL use this configured URL. All other presentation behavior SHALL remain unchanged.

#### Scenario: Viewing the Hub page

- **WHEN** the Hub page loads
- **THEN** the UI SHALL fetch the list of skills from the configured market server URL and render them as glassmorphism cards without using HTML tables


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
### Requirement: Installed State Display

The Hub page SHALL indicate which market skills match local content by comparing skill `name` AND `directory_hash`. The `directory_hash` is a SHA-256 digest covering the entire skill directory (SKILL.md + sibling files). The Hub API SHALL provide `contentHash` per skill; the local hash SHALL be read from `.felina-sync-meta.json`.

#### Scenario: Displaying up-to-date state

- **WHEN** the Hub page loads and a local canonical skill has the same name AND its `directoryHash` in `.felina-sync-meta.json` matches the Hub skill's `contentHash`
- **THEN** the corresponding card SHALL display an "Up to date" indicator instead of the "Install" button

#### Scenario: Displaying installable state when hash differs

- **WHEN** the Hub page loads and a local canonical skill has the same name but a different `directoryHash` from the Hub skill's `contentHash`
- **THEN** the corresponding card SHALL display the "Install" button (content has diverged)

#### Scenario: Displaying installable state when not present locally

- **WHEN** the Hub page loads and no local canonical skill matches the Hub skill's name
- **THEN** the corresponding card SHALL display the "Install" button

#### Scenario: State persists across navigation

- **WHEN** the user navigates away from Hub and returns
- **THEN** the installed state SHALL be re-derived from local canonical skills and `.felina-sync-meta.json`, not from ephemeral UI state

<!-- @trace
source: local-skill-market-prototype
updated: 2026-06-05
code:
  - market-server/dev.ps1
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/mod.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/fan_out/mod.rs
  - src-tauri/src/commands/market_install.rs
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/stores/navigation.ts
  - src/lib/tauri/commands.ts
  - market-server/.dockerignore
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/router.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/docker-compose.yml
  - src-tauri/tauri.conf.json
  - market-server/package.json
-->