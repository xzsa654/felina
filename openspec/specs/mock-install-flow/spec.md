# mock-install-flow Specification

## Purpose

TBD - created by archiving change 'local-skill-market-prototype'. Update Purpose after archive.

## Requirements

### Requirement: Install Skill Action

The Hub page SHALL provide an install action for each selectable market skill. The frontend SHALL invoke the `install_market_skill` Tauri command with the market skill `name` as the canonical skill identity.

#### Scenario: Initiating a skill install

- **WHEN** the user clicks install on a market skill named `code-review`
- **THEN** the frontend SHALL invoke `install_market_skill` with `{ name: "code-review" }`


<!-- @trace
source: hub-install-import-parity-and-preview
updated: 2026-06-05
code:
  - .knowledge/knowledge-base/tauri.md
  - src/lib/i18n/locales/zh-TW.ts
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/commands/mod.rs
  - market-server/.pgmigraterc.json
  - src-tauri/src/commands/skill_package.rs
  - src-tauri/src/lib.rs
  - market-server/src/storage.js
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/market_publish.rs
  - .knowledge/_catalog.json
  - market-server/migrations/001_init.sql
  - market-server/package.json
  - src/lib/i18n/locales/en.ts
  - src/lib/tauri/commands.ts
  - src-tauri/Cargo.toml
  - .session/product-backlog.md
  - market-server/Dockerfile
  - market-server/src/db.js
  - src/lib/components/hub/MarketSkillPreview.tsx
  - market-server/README.md
  - market-server/docker-compose.yml
  - .codex-rescue-prompt.txt
  - market-server/src/server.js
  - src-tauri/src/commands/market_install.rs
  - market-server/src/app.js
  - src/lib/components/hub/MarketSkillList.tsx
  - src-tauri/src/commands/skill_name.rs
  - src-tauri/src/commands/skill_import.rs
tests:
  - market-server/src/storage.test.js
  - market-server/src/app.test.js
  - market-server/src/db.test.js
-->

---
### Requirement: Local Package Extraction

The `install_market_skill` Tauri command SHALL download the skill package from the configured market server URL and install it through the shared canonical skill package import pipeline. The Hub install path SHALL NOT maintain a separate archive-to-filesystem writer whose canonical directory rules can drift from Skills page import.

The shared package import pipeline SHALL reject symlinks, hard links, absolute archive paths, and parent-directory traversal before writing files. It SHALL write the imported skill under the canonical skills directory using the top-level package directory as the canonical skill identity. It SHALL filter out any `.felina-sync-meta.json` entry from the package at any depth.

The shared helper SHALL own validation and write only. Archive format decoding (tar.gz for Hub install, zip for Skills page import) stays with the caller. The helper accepts an iterable of entries (`relative_path`, `kind`, `content`) plus destination root; it MUST NOT depend on tar- or zip-specific types.

The `install_market_skill` command SHALL NOT write `directoryHash` (or any cached hash field) into the destination `.felina-sync-meta.json`. Hub installed-state comparison is derived live by recomputing `fan_out::directory_hash` on demand.

#### Scenario: Successful Hub install uses canonical import semantics

- **GIVEN** the market server returns a tar.gz package containing `code-review/SKILL.md`
- **WHEN** `install_market_skill("code-review")` completes successfully
- **THEN** `~/.felina/skills/code-review/SKILL.md` SHALL be written through the shared canonical package import pipeline
- **AND** any packaged `.felina-sync-meta.json` file SHALL NOT be copied into the destination, at root or nested depth
- **AND** `~/.felina/skills/code-review/.felina-sync-meta.json` SHALL NOT contain a `directoryHash` field written by install

#### Scenario: Unsafe package is rejected before write

- **GIVEN** the market server returns a tar.gz package containing a symlink, hard link, absolute path, or `..` path component
- **WHEN** `install_market_skill("code-review")` processes the package
- **THEN** the command SHALL return an error
- **AND** the unsafe entry SHALL NOT be written under `~/.felina/skills/`

#### Scenario: Installed-state hash is derived live

- **GIVEN** a skill `code-review` was installed from Hub
- **WHEN** the Hub page derives the installed-state badge for `code-review`
- **THEN** the frontend SHALL call `get_skill_directory_hash("code-review")` which computes `fan_out::directory_hash` from the current on-disk content
- **AND** SHALL compare that value against the market server `contentHash`
- **AND** SHALL NOT read a cached `directoryHash` from `.felina-sync-meta.json`


<!-- @trace
source: hub-install-import-parity-and-preview
updated: 2026-06-05
code:
  - .knowledge/knowledge-base/tauri.md
  - src/lib/i18n/locales/zh-TW.ts
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/commands/mod.rs
  - market-server/.pgmigraterc.json
  - src-tauri/src/commands/skill_package.rs
  - src-tauri/src/lib.rs
  - market-server/src/storage.js
  - src/lib/components/hub/HubPage.tsx
  - src-tauri/src/commands/market_publish.rs
  - .knowledge/_catalog.json
  - market-server/migrations/001_init.sql
  - market-server/package.json
  - src/lib/i18n/locales/en.ts
  - src/lib/tauri/commands.ts
  - src-tauri/Cargo.toml
  - .session/product-backlog.md
  - market-server/Dockerfile
  - market-server/src/db.js
  - src/lib/components/hub/MarketSkillPreview.tsx
  - market-server/README.md
  - market-server/docker-compose.yml
  - .codex-rescue-prompt.txt
  - market-server/src/server.js
  - src-tauri/src/commands/market_install.rs
  - market-server/src/app.js
  - src/lib/components/hub/MarketSkillList.tsx
  - src-tauri/src/commands/skill_name.rs
  - src-tauri/src/commands/skill_import.rs
tests:
  - market-server/src/storage.test.js
  - market-server/src/app.test.js
  - market-server/src/db.test.js
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