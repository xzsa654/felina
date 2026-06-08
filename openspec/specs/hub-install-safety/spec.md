# hub-install-safety Specification

## Purpose

TBD - created by archiving change 'hub-auth-install-safety'. Update Purpose after archive.

## Requirements

### Requirement: Install confirmation dialog

When the user initiates a Hub install for a skill that already exists locally with a different content hash, the Hub SHALL display a confirmation dialog before proceeding. The dialog SHALL show the skill name, the market author, the market updated_at timestamp, and the version difference (local version vs market version when available). The dialog SHALL warn that installation will overwrite the local version. If the user confirms, the install SHALL proceed; if the user cancels, no action SHALL be taken. When the skill does not exist locally (fresh install), the install SHALL proceed without a confirmation dialog.

#### Scenario: Install with local hash mismatch

- **WHEN** the user clicks Install on a skill that exists locally with a different content hash than the market version
- **THEN** a confirmation dialog SHALL appear showing the skill name, author, updated_at, and version difference
- **THEN** if the user confirms, the skill SHALL be installed
- **THEN** if the user cancels, the local skill SHALL remain unchanged

#### Scenario: Fresh install without confirmation

- **WHEN** the user clicks Install on a skill that does not exist locally
- **THEN** the skill SHALL be installed immediately without a confirmation dialog

#### Scenario: Install when already up to date

- **WHEN** the user views a skill whose local content hash matches the market content hash
- **THEN** the install action SHALL NOT be available (up-to-date state displayed instead)


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
### Requirement: Uninstall skill

The Felina backend SHALL provide a Tauri command `uninstall_skill(name)` that removes the canonical skill directory at `~/.felina/skills/<name>/`. The command SHALL validate the skill name, verify the directory exists, remove the entire directory tree, and return Ok on success. The command SHALL NOT remove fan-out target directories — fan-out drift detection handles orphaned targets separately.

#### Scenario: Successful uninstall

- **WHEN** the frontend invokes uninstall_skill("code-review") and `~/.felina/skills/code-review/` exists
- **THEN** the command SHALL remove the entire directory
- **THEN** the command SHALL return Ok

#### Scenario: Uninstall non-existent skill

- **WHEN** the frontend invokes uninstall_skill("missing") and the directory does not exist
- **THEN** the command SHALL return Err with a descriptive message


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
### Requirement: Uninstall UI in Hub preview

The Hub skill preview panel SHALL display an Uninstall button when the skill is installed locally. Clicking the button SHALL open a confirmation dialog. On confirmation, the frontend SHALL invoke the uninstall_skill command and refresh the installed state display. The Uninstall button SHALL use a danger visual style to indicate a destructive action.

#### Scenario: Uninstall button visible for installed skill

- **WHEN** the user selects a skill in the Hub that is installed locally
- **THEN** an Uninstall button with danger styling SHALL appear in the preview action area

#### Scenario: Uninstall confirmation and execution

- **WHEN** the user clicks Uninstall and confirms the dialog
- **THEN** the skill SHALL be removed from `~/.felina/skills/<name>/`
- **THEN** the Hub SHALL refresh and the skill status SHALL change from "Up to date" to installable

#### Scenario: Uninstall cancellation

- **WHEN** the user clicks Uninstall but cancels the confirmation dialog
- **THEN** no action SHALL be taken and the skill SHALL remain installed


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
### Requirement: Operation toast notifications

Hub operations (Install, Uninstall, Publish) SHALL trigger OS-native toast notifications via the Tauri notification plugin on success. Failure notifications SHALL remain as inline error banners within the Hub UI to preserve the full error message for user review.

#### Scenario: Successful install notification

- **WHEN** a skill install completes successfully
- **THEN** an OS-native notification SHALL appear confirming the install

#### Scenario: Failed install notification

- **WHEN** a skill install fails
- **THEN** an inline error banner SHALL appear in the Hub UI with the error detail
- **THEN** no OS-native notification SHALL be sent for the failure

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