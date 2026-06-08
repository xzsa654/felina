# market-server-publish Specification

## Purpose

TBD - created by archiving change 'hub-publish-enablement'. Update Purpose after archive.

## Requirements

### Requirement: Skill Package Upload

The market server SHALL accept skill package uploads via PUT /api/skills/:name. After a successful upsert, if the database returns a non-null `previous_storage_key`, the server SHALL delete the old MinIO object. The upsert response SHALL include `previous_storage_key` in the RETURNING clause. All other upload behavior (auth, validation, storage, frontmatter parsing) remains unchanged.


<!-- @trace
source: market-server-storage-ops
updated: 2026-06-08
code:
  - market-server/src/app.js
  - market-server/src/server.js
  - src/lib/components/hub/HubPage.tsx
  - market-server/package.json
  - market-server/src/db.js
  - src-tauri/src/lib.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/i18n/locales/zh-TW.ts
  - market-server/migrations/003_refresh_tokens.sql
  - market-server/docker-compose.yml
  - .knowledge/_catalog.json
  - market-server/migrations/004_skills_indexes.sql
  - market-server/src/migrate.js
  - src-tauri/src/commands/hub_auth.rs
  - market-server/Dockerfile
  - market-server/.env.example
  - src/lib/components/hub/LoginDialog.tsx
  - src/lib/tauri/commands.ts
  - .knowledge/knowledge-base/dev-docs.md
  - market-server/src/auth.js
  - market-server/src/storage.js
  - src-tauri/src/commands/market_publish.rs
tests:
  - market-server/src/storage.test.js
  - market-server/src/app.test.js
  - market-server/src/db.test.js
-->

---
### Requirement: Skill Soft Delete

The market server SHALL accept skill deletion via DELETE /api/skills/:name. The request SHALL include a valid JWT in the `Authorization: Bearer <token>` header; requests without a valid token SHALL be rejected with 401. Deletion SHALL be implemented as a soft delete by setting deleted_at = now() on the matching row. The server SHALL enforce ownership: if the skill row has a non-NULL `author` field and the authenticated email does not match the `author`, the server SHALL respond 403 with an error message identifying the original author. If the skill row has a NULL `author` (legacy row published before auth was added), the delete SHALL be allowed. The MinIO objects SHALL NOT be deleted.

#### Scenario: Delete own skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token (email: alice@corp.local) and the skill row has author=alice@corp.local and deleted_at IS NULL
- **THEN** the server SHALL update deleted_at to now() and respond HTTP 204 No Content

#### Scenario: Delete another user's skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token (email: bob@corp.local) and the skill row has author=alice@corp.local
- **THEN** the server SHALL respond HTTP 403 with an error message indicating the skill was published by alice@corp.local

#### Scenario: Delete legacy skill with NULL author

- **WHEN** a client DELETE /api/skills/old-skill with a valid Bearer token and the skill row has author=NULL
- **THEN** the server SHALL allow the delete and respond HTTP 204 No Content

#### Scenario: Unauthenticated DELETE request

- **WHEN** a client DELETE /api/skills/code-review without an Authorization header
- **THEN** the server SHALL respond HTTP 401

#### Scenario: Delete a non-existent skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token and no row matches the name
- **THEN** the server SHALL respond HTTP 404 Not Found

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
### Requirement: Server-side content hash validation

The market server SHALL validate the X-Content-Hash header on PUT /api/skills/:name. The header value SHALL be a 64-character lowercase hexadecimal string. If the header is missing, empty, or does not match the 64-hex-char pattern, the server SHALL respond 400 with `"invalid content hash format"`. This validation ensures the client-provided hash is well-formed before storage.

#### Scenario: Content hash with invalid format rejected

- **WHEN** a client PUT /api/skills/my-skill with X-Content-Hash: "not-a-hash"
- **THEN** the server SHALL respond 400 with body containing `"invalid content hash format"`


<!-- @trace
source: market-server-security-hardening
updated: 2026-06-08
code:
  - market-server/.env.example
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - market-server/src/app.js
  - market-server/package.json
  - market-server/src/server.js
  - market-server/Dockerfile
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: CORS origin restriction

The market server SHALL configure CORS with an origin whitelist read from the `CORS_ORIGIN` environment variable. When `CORS_ORIGIN` is set, only origins in the comma-separated list SHALL be allowed. When `CORS_ORIGIN` is not set, all origins SHALL be allowed (development fallback). Preflight and actual requests from non-allowed origins SHALL receive no Access-Control-Allow-Origin header.

#### Scenario: CORS rejects unknown origin

- **WHEN** a request arrives from origin `https://evil.example.com` and CORS_ORIGIN is set to `http://localhost:1420`
- **THEN** the response SHALL NOT include an Access-Control-Allow-Origin header


<!-- @trace
source: market-server-security-hardening
updated: 2026-06-08
code:
  - market-server/.env.example
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - market-server/src/app.js
  - market-server/package.json
  - market-server/src/server.js
  - market-server/Dockerfile
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Upload size limit

The market server SHALL limit multipart file uploads to 10 MB by default. The limit SHALL be configurable via `UPLOAD_MAX_SIZE_MB` environment variable. Uploads exceeding the limit SHALL be rejected with 413.

#### Scenario: Upload exceeding size limit

- **WHEN** a client PUT /api/skills/big-skill with a 15 MB tar.gz and UPLOAD_MAX_SIZE_MB is not set
- **THEN** the server SHALL respond 413

<!-- @trace
source: market-server-security-hardening
updated: 2026-06-08
code:
  - market-server/.env.example
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - market-server/src/app.js
  - market-server/package.json
  - market-server/src/server.js
  - market-server/Dockerfile
tests:
  - market-server/src/app.test.js
-->