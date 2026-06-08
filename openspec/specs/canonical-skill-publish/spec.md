# canonical-skill-publish Specification

## Purpose

TBD - created by archiving change 'hub-publish-enablement'. Update Purpose after archive.

## Requirements

### Requirement: Publish Canonical Skill Command

The Felina backend SHALL provide a Tauri command `publish_canonical_skill(name)` that packages a canonical skill and uploads it to the configured market server. The command SHALL first read the Hub authentication token from `~/.felina/settings.json` under the `hubToken` key; if the token is absent or empty, the command SHALL return an Err string indicating that Hub login is required and SHALL NOT proceed with any filesystem or network access. The command SHALL validate `name` against the canonical skill identifier ruleset (ASCII alphanumeric, hyphens, underscores, dots; non-empty) before any filesystem or network access, rejecting invalid names with an Err string. The command SHALL read the skill directory at `~/.felina/skills/<name>/`, compute the directory_hash using the existing fan_out::directory_hash function, package the directory as a tar.gz in memory **excluding any `.felina-sync-meta.json` files at any depth** so publisher-local target metadata does not leak to installers, retrieve the market server base URL via get_market_server_url(), URL-encode the name segment, and PUT the tar.gz to `<baseUrl>/api/skills/<encodedName>` with header X-Content-Hash carrying the directory_hash and header `Authorization: Bearer <token>` carrying the Hub auth token. Successful HTTP 2xx SHALL return Ok(()); HTTP 401 SHALL return an Err string indicating the session has expired and re-login is required; other non-2xx status codes SHALL return an Err string containing the HTTP status and the server-provided error body.

#### Scenario: Publish an existing canonical skill with valid token

- **WHEN** the frontend invokes publish_canonical_skill("code-review") and `~/.felina/skills/code-review/` exists with a valid SKILL.md and a valid hubToken is stored
- **THEN** the command SHALL package the directory, PUT it to the market server with the Bearer token, and return Ok(()) on HTTP 2xx

#### Scenario: Publish without Hub login

- **WHEN** the frontend invokes publish_canonical_skill("code-review") and no hubToken is stored in settings
- **THEN** the command SHALL return an Err string indicating Hub login is required and SHALL NOT perform any HTTP request

#### Scenario: Publish with expired token

- **WHEN** the frontend invokes publish_canonical_skill and the server responds HTTP 401
- **THEN** the command SHALL return an Err string indicating the session has expired

#### Scenario: Publish a non-existent canonical skill

- **WHEN** the frontend invokes publish_canonical_skill("does-not-exist") and no directory exists at `~/.felina/skills/does-not-exist/`
- **THEN** the command SHALL return an Err string explaining that the skill directory was not found, and SHALL NOT perform an HTTP request

#### Scenario: Server rejects with HTTP error

- **WHEN** publish_canonical_skill is invoked and the market server responds with a non-2xx status other than 401
- **THEN** the command SHALL return an Err string containing the HTTP status code and the server response body

#### Scenario: Sync-meta excluded from package

- **WHEN** publish_canonical_skill is invoked for a skill directory that contains a `.felina-sync-meta.json` file (and optionally `.felina-sync-meta.json` inside sub-directories)
- **THEN** the resulting tar.gz uploaded to the server SHALL NOT contain any `.felina-sync-meta.json` entry

#### Scenario: Invalid name is rejected

- **WHEN** publish_canonical_skill is invoked with a name containing characters outside the canonical skill identifier ruleset (e.g. `../escape`, empty string, `name with spaces`, path separators)
- **THEN** the command SHALL return an Err string identifying the invalid name and SHALL NOT touch the filesystem or perform an HTTP request


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
### Requirement: Delete Market Skill Command

The Felina backend SHALL provide a Tauri command `delete_market_skill(name)` that sends DELETE to the configured market server. The command SHALL first read the Hub authentication token from `~/.felina/settings.json` under the `hubToken` key; if the token is absent or empty, the command SHALL return an Err string indicating that Hub login is required. The command SHALL validate `name` against the canonical skill identifier ruleset and URL-encode the name segment before constructing the URL `<baseUrl>/api/skills/<encodedName>`. The DELETE request SHALL include an `Authorization: Bearer <token>` header. HTTP 2xx and 404 SHALL both be treated as success. HTTP 401 SHALL return an Err indicating session expiry. HTTP 403 SHALL return an Err containing the server error message (ownership denied).

#### Scenario: Delete own skill succeeds

- **WHEN** the frontend invokes delete_market_skill("code-review") with a valid token and the server responds 204
- **THEN** the command SHALL return Ok(())

#### Scenario: Delete without Hub login

- **WHEN** the frontend invokes delete_market_skill("code-review") and no hubToken is stored
- **THEN** the command SHALL return an Err string indicating Hub login is required

#### Scenario: Delete another user's skill

- **WHEN** the frontend invokes delete_market_skill("code-review") and the server responds 403
- **THEN** the command SHALL return an Err string containing the server error message about ownership

#### Scenario: Delete on missing skill

- **WHEN** the frontend invokes delete_market_skill("never-existed") and the server responds 404
- **THEN** the command SHALL return Ok(())

#### Scenario: Delete fails with server error

- **WHEN** the frontend invokes delete_market_skill and the server responds with 5xx
- **THEN** the command SHALL return an Err string containing the HTTP status code

#### Scenario: Invalid name is rejected

- **WHEN** delete_market_skill is invoked with a name outside the canonical skill identifier ruleset
- **THEN** the command SHALL return an Err string identifying the invalid name and SHALL NOT perform an HTTP request

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