# market-server-storage Specification

## Purpose

TBD - created by archiving change 'hub-publish-enablement'. Update Purpose after archive.

## Requirements

### Requirement: Market Server Persistent Storage

The market server SHALL persist skill metadata in PostgreSQL and skill package binaries in MinIO. The metadata SHALL include skill name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, deleted_at, author, updated_by, updated_ip, owner_id, and created_by_id fields. The skill name SHALL be the primary key. The `author`, `updated_by`, `updated_ip`, `owner_id`, and `created_by_id` fields SHALL be nullable to maintain backward compatibility with rows created before authentication was introduced. The `owner_id` and `created_by_id` fields are reserved for future Entra ID integration and SHALL NOT be written by this change. The `GET /api/skills` list response SHALL include the `author` field for each skill.

#### Scenario: Listing skills with empty database

- **WHEN** a client sends GET /api/skills and the skills table contains zero non-deleted rows
- **THEN** the server SHALL respond with an empty JSON array `[]`

#### Scenario: Listing skills excludes soft-deleted rows

- **WHEN** a client sends GET /api/skills and the skills table contains rows where deleted_at is not NULL
- **THEN** the server SHALL exclude those rows from the response

#### Scenario: Listing skills includes author

- **WHEN** a client sends GET /api/skills and the skills table contains rows with non-NULL author values
- **THEN** the server SHALL include the `author` field in each skill object in the response

#### Scenario: Downloading a soft-deleted skill

- **WHEN** a client sends GET /api/skills/:name/download and the matching row has deleted_at set
- **THEN** the server SHALL respond with HTTP 410 Gone

#### Scenario: Downloading a non-existent skill

- **WHEN** a client sends GET /api/skills/:name/download and no row matches the name
- **THEN** the server SHALL respond with HTTP 404 Not Found


<!-- @trace
source: hub-auth-install-safety
updated: 2026-06-08
code:
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/src/db.js
  - market-server/docker-compose.yml
  - market-server/dev.ps1
  - src-tauri/src/commands/mod.rs
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/market_install.rs
  - src/lib/components/hub/MarketSkillList.tsx
  - market-server/package.json
  - market-server/.env.example
  - src/lib/components/hub/LoginDialog.tsx
  - src-tauri/src/commands/market_publish.rs
  - src/lib/components/hub/HubPage.tsx
  - src/lib/components/hub/MarketSkillPreview.tsx
  - src/lib/components/hub/AccountDropdown.tsx
  - market-server/src/auth.js
  - market-server/migrations/002_auth.sql
  - market-server/src/app.js
  - src/lib/components/shared/Modal.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/hub_auth.rs
tests:
  - market-server/src/db.test.js
  - market-server/src/app.test.js
-->

---
### Requirement: Schema Migration Runner

The market server SHALL run database migrations via node-pg-migrate during boot, before accepting HTTP connections. Migration files SHALL be tracked in a pgmigrations table. The initial migration (001_init) SHALL create the skills table and enable the pgcrypto extension.

#### Scenario: First boot creates schema

- **WHEN** the market server starts against a Postgres database with no skills table
- **THEN** node-pg-migrate SHALL execute 001_init, creating the skills table and pgmigrations tracking table, before the HTTP listener binds

#### Scenario: Subsequent boots are no-op

- **WHEN** the market server starts against a Postgres database where pgmigrations records 001_init as applied
- **THEN** node-pg-migrate SHALL skip 001_init and proceed to HTTP listener bind without modifying the schema

#### Scenario: Migration failure prevents server start

- **WHEN** a migration fails during boot
- **THEN** the server process SHALL exit with a non-zero status and SHALL NOT bind the HTTP listener


<!-- @trace
source: hub-publish-enablement
updated: 2026-06-05
code:
  - src-tauri/src/commands/market_install.rs
  - src-tauri/src/commands/market_publish.rs
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - market-server/src/app.js
  - src-tauri/Cargo.toml
  - market-server/migrations/001_init.sql
  - market-server/package.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/mod.rs
  - market-server/README.md
  - market-server/Dockerfile
  - market-server/.pgmigraterc.json
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/tauri.md
  - market-server/src/server.js
  - market-server/src/storage.js
  - .knowledge/knowledge-base/_index.json
  - market-server/docker-compose.yml
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/skill_name.rs
  - .codex-rescue-prompt.txt
  - market-server/src/db.js
  - .knowledge/_catalog.json
tests:
  - market-server/src/app.test.js
  - market-server/src/storage.test.js
  - market-server/src/db.test.js
-->

---
### Requirement: MinIO Bucket Provisioning

The market server SHALL ensure the MinIO bucket `skills` exists at boot. If the bucket is missing the server SHALL create it before accepting HTTP connections.

#### Scenario: First boot creates bucket

- **WHEN** the market server starts against a MinIO instance with no `skills` bucket
- **THEN** the server SHALL invoke makeBucket('skills') before the HTTP listener binds

#### Scenario: Existing bucket is reused

- **WHEN** the market server starts against a MinIO instance where the `skills` bucket already exists
- **THEN** the server SHALL detect the bucket and proceed without re-creating it

<!-- @trace
source: hub-publish-enablement
updated: 2026-06-05
code:
  - src-tauri/src/commands/market_install.rs
  - src-tauri/src/commands/market_publish.rs
  - src-tauri/src/lib.rs
  - src/lib/tauri/commands.ts
  - src/lib/i18n/locales/zh-TW.ts
  - .session/product-backlog.md
  - market-server/src/app.js
  - src-tauri/Cargo.toml
  - market-server/migrations/001_init.sql
  - market-server/package.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/mod.rs
  - market-server/README.md
  - market-server/Dockerfile
  - market-server/.pgmigraterc.json
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/tauri.md
  - market-server/src/server.js
  - market-server/src/storage.js
  - .knowledge/knowledge-base/_index.json
  - market-server/docker-compose.yml
  - src/lib/i18n/locales/en.ts
  - src-tauri/src/commands/skill_name.rs
  - .codex-rescue-prompt.txt
  - market-server/src/db.js
  - .knowledge/_catalog.json
tests:
  - market-server/src/app.test.js
  - market-server/src/storage.test.js
  - market-server/src/db.test.js
-->