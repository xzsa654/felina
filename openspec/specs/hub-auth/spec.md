# hub-auth Specification

## Purpose

TBD - created by archiving change 'hub-auth-install-safety'. Update Purpose after archive.

## Requirements

### Requirement: User registration

The market server SHALL expose `POST /auth/register` accepting `{ email, password }` JSON body. The server SHALL hash the password with bcrypt, INSERT a new row into the `users` table with a UUID primary key, and return `{ token, email }` where token is a JWT signed with HS256 using the `JWT_SECRET` environment variable. The JWT payload SHALL contain `{ sub: <user-uuid>, email: <email>, iat, exp }` with a 7-day expiration. If the email already exists, the server SHALL respond 409. If email or password is empty or missing, the server SHALL respond 400.

#### Scenario: Successful registration

- **WHEN** a client sends POST /auth/register with `{ email: "alice@corp.local", password: "secret123" }`
- **THEN** the server SHALL respond 200 with `{ token: "<jwt>", email: "alice@corp.local" }`
- **THEN** a row SHALL exist in the users table with the registered email and a bcrypt-hashed password

#### Scenario: Duplicate email registration

- **WHEN** a client sends POST /auth/register with an email that already exists in the users table
- **THEN** the server SHALL respond 409 with `{ error: "email already registered" }`

#### Scenario: Missing fields

- **WHEN** a client sends POST /auth/register with empty email or empty password
- **THEN** the server SHALL respond 400


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
### Requirement: User login

The market server SHALL expose `POST /auth/login` accepting `{ email, password }` JSON body. The server SHALL query the users table by email, verify the password against the stored bcrypt hash, and return `{ token, email }` with a fresh JWT on success. If the email does not exist or the password does not match, the server SHALL respond 401.

#### Scenario: Successful login

- **WHEN** a registered user sends POST /auth/login with correct email and password
- **THEN** the server SHALL respond 200 with `{ token: "<jwt>", email: "<email>" }`

#### Scenario: Wrong password

- **WHEN** a client sends POST /auth/login with a valid email but incorrect password
- **THEN** the server SHALL respond 401

#### Scenario: Non-existent email

- **WHEN** a client sends POST /auth/login with an email not in the users table
- **THEN** the server SHALL respond 401


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