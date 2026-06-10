# felina-quota-ttl-settings Specification

## Purpose

TBD - created by archiving change 'remove-retained-budget-command'. Update Purpose after archive.

## Requirements

### Requirement: Felina quota TTL IPC

The system SHALL expose two Tauri commands, `get_felina_quota_ttl` and `set_felina_quota_ttl`, that read and write a shared quota cache TTL value used by both the frontend AgentQuotaPanel and the backend `ccusage::quota_cache_ttl` function. The persisted value SHALL live in `~/.felina/settings.json` under the top-level key `quotaTtlSeconds`. The default fallback value SHALL be `60` seconds. The accepted value range SHALL be `30` to `3600` seconds inclusive.

#### Scenario: Reading TTL when settings file is absent

- **WHEN** `get_felina_quota_ttl` is invoked and `~/.felina/settings.json` does not exist
- **THEN** the system SHALL return `60`

#### Scenario: Reading TTL when settings file is present

- **WHEN** `get_felina_quota_ttl` is invoked and `~/.felina/settings.json` contains a valid `quotaTtlSeconds` value
- **THEN** the system SHALL return that value

##### Example: round-trip

- **GIVEN** `~/.felina/settings.json` contains `{ "agentPaths": { ... }, "quotaTtlSeconds": 90 }`
- **WHEN** `get_felina_quota_ttl` is invoked
- **THEN** the system returns `90`

#### Scenario: Writing TTL preserves other settings fields

- **WHEN** `set_felina_quota_ttl(120)` is invoked on a settings file that already contains an `agentPaths` object
- **THEN** the system SHALL persist `quotaTtlSeconds: 120` while leaving `agentPaths` unchanged

##### Example: preserved fields

- **GIVEN** `~/.felina/settings.json` contains `{ "agentPaths": { "anthropic": { "global": "~/.claude/skills" } } }`
- **WHEN** `set_felina_quota_ttl(120)` is invoked
- **THEN** the file contains `{ "agentPaths": { "anthropic": { "global": "~/.claude/skills" } }, "quotaTtlSeconds": 120 }`

#### Scenario: Writing TTL creates the file when absent

- **WHEN** `set_felina_quota_ttl(45)` is invoked and `~/.felina/settings.json` does not exist
- **THEN** the system SHALL create the file containing `{ "quotaTtlSeconds": 45 }`

#### Scenario: Writing out-of-range TTL is rejected

- **WHEN** `set_felina_quota_ttl(seconds)` is invoked with `seconds < 30` or `seconds > 3600`
- **THEN** the system SHALL return an error and SHALL NOT modify the settings file

##### Example: boundary cases

| Input seconds | Outcome |
| ------------- | ------- |
| 29 | Err, file unchanged |
| 30 | Ok, value persisted |
| 60 | Ok, value persisted |
| 3600 | Ok, value persisted |
| 3601 | Err, file unchanged |


<!-- @trace
source: remove-retained-budget-command
updated: 2026-06-10
code:
  - .knowledge/knowledge-base/tauri.md
  - .session/agent-skill-market-complete.md
  - market-server/migrations/001_init.sql
  - src/lib/components/hub/MarketSkillPreview.tsx
  - tests/loader.mjs
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src/lib/components/skills/SkillsPage.tsx
  - .session/archive/skill-editor-ui-adjustment-report.md
  - src-tauri/src/tokens/mod.rs
  - .session/release-notes-v1.0.0.md
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - market-server/docker-compose.yml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/i18n/locales/en.ts
  - src-tauri/tauri.conf.json
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/GeneralSettings.tsx
  - src-tauri/src/commands/skill_package.rs
  - docs/tokscale-backed-token-ingestion.md
  - .knowledge/milestones.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/market-server-deployment.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - .session/felina_hackathon_ppt_spec_report.md
  - src-tauri/src/commands/felina_settings.rs
  - src/lib/assets/claude.svg
  - src/lib/components/settings/SettingsPage.tsx
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/types/hooks.ts
  - src/lib/assets/codex.png
  - market-server/src/auth.js
  - src-tauri/src/commands/skill_name.rs
  - src/lib/components/hub/LoginDialog.tsx
  - package.json
  - src/lib/components/skills/import/staging-logic.ts
  - src/lib/components/templates/TemplatesPage.tsx
  - market-server/migrations/002_auth.sql
  - src/lib/components/hub/HubPage.tsx
  - src/lib/tauri/commands.ts
  - .session/felina_development_report.md
  - market-server/Dockerfile
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - market-server/src/app.js
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/components/settings/EnvVarsEditor.tsx
  - market-server/dev.ps1
  - src/lib/types/settings.ts
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - market-server/.env.example
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/utils/markdown-source-map.ts
  - market-server/.pgmigraterc.json
  - GEMINI.md
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/market_server.rs
  - src/lib/assets/logo.png
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/hub/AccountDropdown.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/utils/achievements.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/queryClient.ts
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/types/index.ts
  - src/lib/components/settings/MarketServerSection.tsx
  - src-tauri/src/commands/hub_auth.rs
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/mcp/McpPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/hooks.rs
  - market-server/migrations/003_refresh_tokens.sql
  - LANGUAGE.md
  - src/lib/components/settings/PermissionsEditor.tsx
  - market-server/package.json
  - .codex-rescue-prompt.txt
  - market-server/migrations/004_skills_indexes.sql
  - src-tauri/src/paths.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/SkillLibrarySection.tsx
  - market-server/src/db.js
  - .session/product-backlog.md
  - scripts/fetch-tokscale.mjs
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/shared/InfoDialog.tsx
  - src-tauri/src/commands/market_install.rs
  - src/lib/components/hooks/HookCard.tsx
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/lib.rs
  - src/lib/components/hub/MarketSkillList.tsx
  - src-tauri/src/tokens/storage.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/examples/token_reconcile.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/shared/PageScaffold.tsx
  - market-server/src/storage.js
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - .knowledge/ideas-backlog.md
  - .knowledge/_catalog.json
  - src/lib/components/skills/RenameSkillDialog.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - market-server/.dockerignore
  - src/lib/components/skills/sync-status-utils.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/hooks/HooksPage.tsx
  - src/main.tsx
  - src-tauri/src/commands/budget.rs
  - .session/ui-design-guidelines.md
  - tsconfig.json
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/snapshot.rs
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - .knowledge/knowledge-base/architecture.md
  - market-server/src/migrate.js
  - src-tauri/src/commands/skill_library.rs
  - src/lib/components/projects/ProjectsPage.tsx
  - src-tauri/Cargo.toml
  - market-server/README.md
  - src/lib/types/skills.ts
  - src/router.tsx
  - src/lib/components/skills/ForkPreviewDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - README.md
  - market-server/src/server.js
  - src/lib/components/layout/Sidebar.tsx
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/market_publish.rs
  - src/lib/assets/antigravity.png
  - src/lib/stores/navigation.ts
  - src/app.css
  - src/lib/components/skills/ResizableHandle.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/mcp.rs
tests:
  - tests/skill-import-conflict-warning.test.ts
  - src/lib/stores/navigation.test.ts
  - tests/sync-status-utils.test.ts
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
  - src/lib/components/skills/SkillList.test.ts
  - tests/markdown-source-map.test.ts
  - market-server/src/storage.test.js
  - market-server/src/app.test.js
  - tests/managed-inventory.test.ts
  - tests/staging-logic.test.ts
  - market-server/src/db.test.js
-->

---
### Requirement: Backend quota cache uses Felina settings

The backend `ccusage::quota_cache_ttl` function SHALL derive its TTL value from the same `quotaTtlSeconds` field in `~/.felina/settings.json` that the frontend AgentQuotaPanel writes through `set_felina_quota_ttl`. The frontend AgentQuotaPanel and the backend `ccusage` quota cache window SHALL be governed by the same persisted value.

#### Scenario: Backend and frontend share the TTL value

- **WHEN** the user persists a TTL of `90` seconds via the AgentQuotaPanel dropdown
- **THEN** subsequent backend quota fetches SHALL treat cached results older than `90` seconds as stale

<!-- @trace
source: remove-retained-budget-command
updated: 2026-06-10
code:
  - .knowledge/knowledge-base/tauri.md
  - .session/agent-skill-market-complete.md
  - market-server/migrations/001_init.sql
  - src/lib/components/hub/MarketSkillPreview.tsx
  - tests/loader.mjs
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src/lib/components/skills/SkillsPage.tsx
  - .session/archive/skill-editor-ui-adjustment-report.md
  - src-tauri/src/tokens/mod.rs
  - .session/release-notes-v1.0.0.md
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/skills/TargetPopover.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - market-server/docker-compose.yml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/i18n/locales/en.ts
  - src-tauri/tauri.conf.json
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/settings/GeneralSettings.tsx
  - src-tauri/src/commands/skill_package.rs
  - docs/tokscale-backed-token-ingestion.md
  - .knowledge/milestones.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/market-server-deployment.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - .session/felina_hackathon_ppt_spec_report.md
  - src-tauri/src/commands/felina_settings.rs
  - src/lib/assets/claude.svg
  - src/lib/components/settings/SettingsPage.tsx
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/types/hooks.ts
  - src/lib/assets/codex.png
  - market-server/src/auth.js
  - src-tauri/src/commands/skill_name.rs
  - src/lib/components/hub/LoginDialog.tsx
  - package.json
  - src/lib/components/skills/import/staging-logic.ts
  - src/lib/components/templates/TemplatesPage.tsx
  - market-server/migrations/002_auth.sql
  - src/lib/components/hub/HubPage.tsx
  - src/lib/tauri/commands.ts
  - .session/felina_development_report.md
  - market-server/Dockerfile
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - market-server/src/app.js
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/components/settings/EnvVarsEditor.tsx
  - market-server/dev.ps1
  - src/lib/types/settings.ts
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/import/SkillStagingCard.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - market-server/.env.example
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/utils/markdown-source-map.ts
  - market-server/.pgmigraterc.json
  - GEMINI.md
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/market_server.rs
  - src/lib/assets/logo.png
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/hub/AccountDropdown.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/utils/achievements.ts
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/queryClient.ts
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/types/index.ts
  - src/lib/components/settings/MarketServerSection.tsx
  - src-tauri/src/commands/hub_auth.rs
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/mcp/McpPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/hooks.rs
  - market-server/migrations/003_refresh_tokens.sql
  - LANGUAGE.md
  - src/lib/components/settings/PermissionsEditor.tsx
  - market-server/package.json
  - .codex-rescue-prompt.txt
  - market-server/migrations/004_skills_indexes.sql
  - src-tauri/src/paths.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/SkillLibrarySection.tsx
  - market-server/src/db.js
  - .session/product-backlog.md
  - scripts/fetch-tokscale.mjs
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/shared/InfoDialog.tsx
  - src-tauri/src/commands/market_install.rs
  - src/lib/components/hooks/HookCard.tsx
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/lib.rs
  - src/lib/components/hub/MarketSkillList.tsx
  - src-tauri/src/tokens/storage.rs
  - src/lib/stores/skills-store.ts
  - src-tauri/examples/token_reconcile.rs
  - src/lib/components/skills/SyncInfoBar.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/shared/PageScaffold.tsx
  - market-server/src/storage.js
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - .knowledge/ideas-backlog.md
  - .knowledge/_catalog.json
  - src/lib/components/skills/RenameSkillDialog.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - market-server/.dockerignore
  - src/lib/components/skills/sync-status-utils.ts
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/hooks/HooksPage.tsx
  - src/main.tsx
  - src-tauri/src/commands/budget.rs
  - .session/ui-design-guidelines.md
  - tsconfig.json
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src-tauri/src/commands/snapshot.rs
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - .knowledge/knowledge-base/architecture.md
  - market-server/src/migrate.js
  - src-tauri/src/commands/skill_library.rs
  - src/lib/components/projects/ProjectsPage.tsx
  - src-tauri/Cargo.toml
  - market-server/README.md
  - src/lib/types/skills.ts
  - src/router.tsx
  - src/lib/components/skills/ForkPreviewDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - README.md
  - market-server/src/server.js
  - src/lib/components/layout/Sidebar.tsx
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/market_publish.rs
  - src/lib/assets/antigravity.png
  - src/lib/stores/navigation.ts
  - src/app.css
  - src/lib/components/skills/ResizableHandle.tsx
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/mcp.rs
tests:
  - tests/skill-import-conflict-warning.test.ts
  - src/lib/stores/navigation.test.ts
  - tests/sync-status-utils.test.ts
  - src/lib/components/projects/managed-inventory.test.ts
  - src/lib/components/projects/conflict-diff.test.ts
  - src/lib/components/skills/SkillList.test.ts
  - tests/markdown-source-map.test.ts
  - market-server/src/storage.test.js
  - market-server/src/app.test.js
  - tests/managed-inventory.test.ts
  - tests/staging-logic.test.ts
  - market-server/src/db.test.js
-->