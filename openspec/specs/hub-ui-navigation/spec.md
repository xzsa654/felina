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

The Hub page SHALL display a list of available skills using a borderless, glassmorphism card design, conforming to the `felina-ui-guidelines`.

#### Scenario: Viewing the Hub page

- **WHEN** the Hub page loads
- **THEN** the UI SHALL fetch the list of skills from the local market API and render them as glassmorphism cards without using HTML tables


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