# local-market-infrastructure Specification

## Purpose

TBD - created by archiving change 'local-skill-market-prototype'. Update Purpose after archive.

## Requirements

### Requirement: Local Market Server Architecture

The system SHALL provide a local Docker Compose environment that includes a Node.js Fastify API server, a PostgreSQL database, and a MinIO storage service.

#### Scenario: Running the local market infrastructure

- **WHEN** the user starts the Docker Compose environment
- **THEN** the API server, database, and storage SHALL be accessible on localhost


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
### Requirement: Skill Registry API endpoints

The API server SHALL expose endpoints to list available skills, download skill packages, upload (publish) skill packages, and delete skills. Listing and download SHALL be backed by persistent storage (Postgres metadata + MinIO binary) rather than an in-memory array. The previously documented `:id`-keyed download endpoint SHALL be replaced by name-keyed endpoints.

#### Scenario: Listing skills

- **WHEN** a client sends a GET request to /api/skills
- **THEN** the server SHALL return a list of available (non-deleted) skills in JSON format, sourced from the Postgres `skills` table

#### Scenario: Downloading a skill package

- **WHEN** a client sends a GET request to /api/skills/:name/download for a non-deleted skill
- **THEN** the server SHALL stream the tar.gz binary from MinIO using the skill's storage_key

#### Scenario: Uploading a skill package

- **WHEN** a client sends a PUT request to /api/skills/:name with a multipart tar.gz body and X-Content-Hash header
- **THEN** the server SHALL store the binary in MinIO and upsert the metadata row, per Skill Package Upload requirement

#### Scenario: Deleting a skill

- **WHEN** a client sends a DELETE request to /api/skills/:name for a row that exists
- **THEN** the server SHALL soft-delete by setting deleted_at on the row, per Skill Soft Delete requirement

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