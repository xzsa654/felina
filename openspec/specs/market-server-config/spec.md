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

---
### Requirement: Graceful shutdown on container stop

The market server process SHALL listen for SIGTERM and SIGINT signals. On receiving either signal, the server SHALL stop accepting new connections, wait for in-flight requests to complete (up to a configurable timeout via `SHUTDOWN_TIMEOUT_MS` environment variable, default 10000ms), close the database connection pool, and exit with code 0. If the timeout is exceeded, the process SHALL exit with code 1.

#### Scenario: Graceful shutdown completes

- **WHEN** the server process receives SIGTERM while 2 requests are in-flight
- **THEN** the server SHALL complete both requests, close the DB pool, and exit with code 0


<!-- @trace
source: market-server-container-ops
updated: 2026-06-08
code:
  - .session/scratch/session-entry.md
  - market-server/src/auth.js
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/docker-compose.yml
  - src/lib/tauri/commands.ts
  - market-server/Dockerfile
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/_catalog.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/i18n/locales/en.ts
  - market-server/src/db.js
  - src/lib/components/hub/LoginDialog.tsx
  - market-server/src/server.js
  - market-server/.env.example
  - market-server/migrations/003_refresh_tokens.sql
  - src-tauri/src/commands/market_publish.rs
  - market-server/src/migrate.js
  - market-server/src/app.js
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Database connection pool configuration

The market server SHALL configure the PostgreSQL connection pool with values from environment variables: `DB_POOL_MAX` (default 20), `DB_POOL_IDLE_TIMEOUT` (default 30000ms), `DB_POOL_CONNECTION_TIMEOUT` (default 5000ms). When environment variables are not set, the defaults SHALL be used.

#### Scenario: Custom pool size

- **WHEN** the server starts with `DB_POOL_MAX=5`
- **THEN** the connection pool SHALL have a maximum of 5 connections


<!-- @trace
source: market-server-container-ops
updated: 2026-06-08
code:
  - .session/scratch/session-entry.md
  - market-server/src/auth.js
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/docker-compose.yml
  - src/lib/tauri/commands.ts
  - market-server/Dockerfile
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/_catalog.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/i18n/locales/en.ts
  - market-server/src/db.js
  - src/lib/components/hub/LoginDialog.tsx
  - market-server/src/server.js
  - market-server/.env.example
  - market-server/migrations/003_refresh_tokens.sql
  - src-tauri/src/commands/market_publish.rs
  - market-server/src/migrate.js
  - market-server/src/app.js
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Independent migration execution

The market server SHALL provide a standalone migration script (`src/migrate.js`) that reads SQL files from the `migrations/` directory in alphabetical order and executes them idempotently using a `schema_migrations` tracking table. The API server startup (`src/server.js`) SHALL NOT execute migrations. The migration script SHALL be run as a separate step before the API server starts.

#### Scenario: Migration runs independently

- **WHEN** `node src/migrate.js` is executed
- **THEN** pending migrations SHALL be applied and recorded in `schema_migrations`
- **AND** already-applied migrations SHALL be skipped

<!-- @trace
source: market-server-container-ops
updated: 2026-06-08
code:
  - .session/scratch/session-entry.md
  - market-server/src/auth.js
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/docker-compose.yml
  - src/lib/tauri/commands.ts
  - market-server/Dockerfile
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/_catalog.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/hub/HubPage.tsx
  - src/lib/i18n/locales/en.ts
  - market-server/src/db.js
  - src/lib/components/hub/LoginDialog.tsx
  - market-server/src/server.js
  - market-server/.env.example
  - market-server/migrations/003_refresh_tokens.sql
  - src-tauri/src/commands/market_publish.rs
  - market-server/src/migrate.js
  - market-server/src/app.js
tests:
  - market-server/src/app.test.js
-->