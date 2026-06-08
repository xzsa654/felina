# hub-auth Specification

## Purpose

TBD - created by archiving change 'hub-auth-install-safety'. Update Purpose after archive.

## Requirements

### Requirement: User registration

The market server SHALL expose `POST /auth/register` accepting `{ email, password }` JSON body. The server SHALL hash the password with bcrypt, INSERT a new row into the `users` table with a UUID primary key, and return `{ accessToken, refreshToken, email }` where accessToken is a short-lived JWT (default 15 minutes, configurable via `ACCESS_TOKEN_EXPIRY` environment variable) signed with HS256 using the `JWT_SECRET` environment variable, and refreshToken is a UUID v4 stored as a SHA-256 hash in the `refresh_tokens` table with a 30-day expiration. The JWT payload SHALL contain `{ sub: <user-uuid>, email: <email>, iat, exp }`. If the email already exists, the server SHALL respond 409. If email or password is empty or missing, the server SHALL respond 400.


<!-- @trace
source: market-server-auth-lifecycle
updated: 2026-06-08
code:
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/src/app.js
  - market-server/migrations/003_refresh_tokens.sql
  - market-server/.env.example
  - market-server/src/auth.js
  - .knowledge/_catalog.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/src/db.js
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/market_publish.rs
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: User login

The market server SHALL expose `POST /auth/login` accepting `{ email, password }` JSON body. The server SHALL look up the user by email, compare the password with bcrypt, and on success return `{ accessToken, refreshToken, email }` with the same token semantics as registration. If the email is not found or password does not match, the server SHALL respond 401.


<!-- @trace
source: market-server-auth-lifecycle
updated: 2026-06-08
code:
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/src/app.js
  - market-server/migrations/003_refresh_tokens.sql
  - market-server/.env.example
  - market-server/src/auth.js
  - .knowledge/_catalog.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/src/db.js
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/market_publish.rs
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: JWT authentication middleware

The market server SHALL verify JWT tokens on mutation endpoints (PUT, DELETE). GET endpoints (list, download, skill-md) SHALL remain public and require no authentication. For protected endpoints, the server SHALL read the `Authorization: Bearer <token>` header, verify the JWT signature and expiration, and attach `{ sub, email }` to the request context. If the token is missing, invalid, or expired, the server SHALL respond 401.

#### Scenario: Authenticated PUT request

- **WHEN** a client sends PUT /api/skills/:name with a valid Bearer token
- **THEN** the server SHALL process the request with `request.user.email` available

#### Scenario: Missing token on PUT

- **WHEN** a client sends PUT /api/skills/:name without an Authorization header
- **THEN** the server SHALL respond 401

#### Scenario: Expired token

- **WHEN** a client sends PUT /api/skills/:name with an expired JWT
- **THEN** the server SHALL respond 401

#### Scenario: GET requests remain public

- **WHEN** a client sends GET /api/skills without any Authorization header
- **THEN** the server SHALL respond normally with the skill list


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
### Requirement: Felina Hub auth commands

The Felina backend SHALL provide four Tauri commands for Hub authentication: `register_hub_account(email, password)` and `login_hub_account(email, password)` SHALL POST to the market server auth endpoints and persist the returned token and email to `~/.felina/settings.json` under keys `hubToken` and `hubEmail`. `get_hub_auth_status()` SHALL read those keys and return `Some({ email })` if present or `None`. `logout_hub_account()` SHALL remove the `hubToken` and `hubEmail` keys from the settings file.

#### Scenario: Register and persist token

- **WHEN** the frontend invokes register_hub_account("alice@corp.local", "secret123") and the server returns success
- **THEN** the command SHALL return Ok with the email
- **THEN** `~/.felina/settings.json` SHALL contain `hubToken` and `hubEmail` keys

#### Scenario: Login and persist token

- **WHEN** the frontend invokes login_hub_account with valid credentials
- **THEN** the command SHALL return Ok with the email and persist the token

#### Scenario: Check auth status when logged in

- **WHEN** `~/.felina/settings.json` contains a `hubToken` value
- **THEN** get_hub_auth_status() SHALL return Some with the stored email

#### Scenario: Check auth status when not logged in

- **WHEN** `~/.felina/settings.json` does not contain `hubToken`
- **THEN** get_hub_auth_status() SHALL return None

#### Scenario: Logout clears credentials

- **WHEN** the frontend invokes logout_hub_account()
- **THEN** `~/.felina/settings.json` SHALL no longer contain `hubToken` or `hubEmail` keys


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
### Requirement: Hub login UI

The Hub page SHALL display authentication controls in the page header actions area. When not logged in, a "Login" button SHALL appear; clicking it SHALL open a LoginDialog modal with Login and Register tabs containing email and password fields. On successful authentication, the dialog SHALL close and the header SHALL display the authenticated email with a Logout button. When not logged in, the Publish button SHALL be disabled with a tooltip indicating login is required. The Install button SHALL remain functional regardless of authentication state.

#### Scenario: Login button visible when unauthenticated

- **WHEN** the user opens the Hub page without being logged in
- **THEN** a "Login" button SHALL appear in the header actions
- **THEN** the Publish button SHALL be disabled

#### Scenario: Successful login flow

- **WHEN** the user clicks Login, enters valid credentials in the Login tab, and submits
- **THEN** the dialog SHALL close
- **THEN** the header SHALL display the user email and a Logout button
- **THEN** the Publish button SHALL become enabled

#### Scenario: Register flow

- **WHEN** the user switches to the Register tab, enters email and password, and submits
- **THEN** the account SHALL be created and the user SHALL be automatically logged in

#### Scenario: Logout

- **WHEN** a logged-in user clicks the Logout button
- **THEN** the header SHALL revert to showing the Login button
- **THEN** the Publish button SHALL become disabled

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
### Requirement: Password minimum length on registration

The market server SHALL validate that the password field in `POST /auth/register` is at least 8 characters long. If the password is shorter than 8 characters, the server SHALL respond 400 with `"password must be at least 8 characters"`. The login endpoint SHALL NOT enforce this minimum length to maintain backwards compatibility with accounts registered before this requirement.

#### Scenario: Registration rejected for short password

- **WHEN** a client sends POST /auth/register with `{ email: "alice@corp.local", password: "short" }`
- **THEN** the server SHALL respond 400 with body containing `"password must be at least 8 characters"`


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
### Requirement: Rate limiting on auth endpoints

The market server SHALL enforce rate limiting on `/auth/register` and `/auth/login` endpoints. The limit SHALL default to 5 requests per 15 minutes per IP address. When the limit is exceeded, the server SHALL respond 429. The limit values SHALL be configurable via `RATE_LIMIT_AUTH_MAX` (default 5) and `RATE_LIMIT_AUTH_WINDOW` (default "15 minutes") environment variables. All other endpoints SHALL have a global rate limit of 100 requests per minute per IP, configurable via `RATE_LIMIT_MAX` environment variable.

#### Scenario: Rate limit exceeded on login

- **WHEN** a client sends 6 POST /auth/login requests from the same IP within 15 minutes
- **THEN** the 6th request SHALL receive a 429 response

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
### Requirement: Token refresh

The market server SHALL expose `POST /auth/refresh` accepting `{ refreshToken }` JSON body. The server SHALL hash the provided refresh token with SHA-256, look up the hash in the `refresh_tokens` table, and verify the token has not expired. On success, the server SHALL delete the used refresh token, generate a new access token and new refresh token (token rotation), store the new refresh token hash, and return `{ accessToken, refreshToken, email }`. If the refresh token is invalid or expired, the server SHALL respond 401.

#### Scenario: Successful token refresh

- **WHEN** a client sends POST /auth/refresh with a valid, non-expired refresh token
- **THEN** the server SHALL respond 200 with new `{ accessToken, refreshToken, email }`
- **AND** the old refresh token SHALL be deleted from the database

#### Scenario: Expired refresh token

- **WHEN** a client sends POST /auth/refresh with an expired refresh token
- **THEN** the server SHALL respond 401


<!-- @trace
source: market-server-auth-lifecycle
updated: 2026-06-08
code:
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/src/app.js
  - market-server/migrations/003_refresh_tokens.sql
  - market-server/.env.example
  - market-server/src/auth.js
  - .knowledge/_catalog.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/src/db.js
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/market_publish.rs
tests:
  - market-server/src/app.test.js
-->

---
### Requirement: Server-side logout with token revocation

The market server SHALL expose `POST /auth/logout`. When the request body contains `{ refreshToken }`, the server SHALL delete that specific refresh token from the database. When the request body is empty or does not contain refreshToken, and the request includes a valid Bearer token, the server SHALL delete all refresh tokens for the authenticated user (all-device logout). The server SHALL respond 200 on success.

#### Scenario: Logout revokes specific refresh token

- **WHEN** a client sends POST /auth/logout with `{ refreshToken: "<token>" }`
- **THEN** the server SHALL delete that refresh token from the database
- **AND** subsequent POST /auth/refresh with that token SHALL fail with 401

#### Scenario: Logout revokes all sessions

- **WHEN** an authenticated client sends POST /auth/logout with empty body
- **THEN** the server SHALL delete all refresh tokens for that user

<!-- @trace
source: market-server-auth-lifecycle
updated: 2026-06-08
code:
  - market-server/Dockerfile
  - market-server/src/server.js
  - market-server/src/app.js
  - market-server/migrations/003_refresh_tokens.sql
  - market-server/.env.example
  - market-server/src/auth.js
  - .knowledge/_catalog.json
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/lib.rs
  - market-server/package.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/hub_auth.rs
  - market-server/src/db.js
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/market_publish.rs
tests:
  - market-server/src/app.test.js
-->