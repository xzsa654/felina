# mock-install-flow Specification

## Purpose

TBD - created by archiving change 'local-skill-market-prototype'. Update Purpose after archive.

## Requirements

### Requirement: Install Skill Action

The Hub page SHALL provide an "Install" button on each skill card that triggers the local installation process via a Tauri command.

#### Scenario: Initiating a skill install

- **WHEN** the user clicks "Install" on a skill card
- **THEN** the frontend SHALL invoke the `install_market_skill` Tauri command with the skill ID


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
### Requirement: Local Package Extraction

The `install_market_skill` Tauri command SHALL download the skill package from the configured market server URL (read via the Market Server URL Read Command) instead of a hardcoded `http://localhost:3100` base URL. All other extraction behavior SHALL remain unchanged.

#### Scenario: Successful extraction

- **WHEN** the `install_market_skill` command executes successfully
- **THEN** the skill's markdown and manifest files SHALL be written to the canonical skill directory, using the URL from the persisted market server setting


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
### Requirement: Directory Hash Recording on Install

The `install_market_skill` command SHALL compute a `directory_hash` of the installed skill directory (SHA-256 of `semantic_hash(SKILL.md)` concatenated with sorted sibling file hashes) and write it to `.felina-sync-meta.json` immediately after extraction. This enables the Hub page to compare local content against the Hub version without maintaining a persistent link.

#### Scenario: Hash written after install

- **WHEN** the `install_market_skill` command completes extraction
- **THEN** the `.felina-sync-meta.json` in the skill directory SHALL contain a `directoryHash` field with the SHA-256 hex digest representing the full directory content

##### Example: hash recording

- **GIVEN** a skill `code-review` installed from Hub with SKILL.md content and no sibling files
- **WHEN** install completes
- **THEN** `~/.felina/skills/code-review/.felina-sync-meta.json` contains `"directoryHash": "<sha256-hex>"`

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