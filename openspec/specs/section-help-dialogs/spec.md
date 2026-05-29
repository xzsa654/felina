## Requirements

### Requirement: Block-Level Info Dialog

The system SHALL provide a block-level info dialog that explains complex terminology and operations for specific UI sections without cluttering the main interactive area.

#### Scenario: User views Target Editor help

- **GIVEN** the user is viewing a skill in the Skills page
- **WHEN** the user clicks the help icon next to the "TARGETS" section header
- **THEN** a dialog SHALL appear
- **AND** the dialog SHALL explain "Auto/Manual/Disabled" sync modes, "Pull" (appears on drift), and "Repoint" (re-target project folder)
- **AND** the dialog SHALL be dismissible by clicking a close button or clicking outside the dialog

#### Scenario: User views Managed Inventory help

- **GIVEN** the user is viewing the Managed Inventory in the Projects page
- **WHEN** the user clicks the help icon next to the section header
- **THEN** a dialog SHALL appear
- **AND** the dialog SHALL explain the "Multi Source" state
- **AND** the dialog SHALL be dismissible

<!-- @trace
source: section-help-dialogs
updated: 2026-05-30
code:
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/components/skills/ResizableHandle.tsx
  - src/lib/components/settings/DataPruningSection.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - docs/tokscale-backed-token-ingestion.md
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - .session/product-backlog.md
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src/lib/components/shared/InfoDialog.tsx
  - .knowledge/knowledge-base/_index.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/projects/managed-inventory.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/types/index.ts
  - src-tauri/src/commands/skill_import.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/tauri/commands.ts
  - package.json
  - src-tauri/src/commands/skill_library.rs
  - src-tauri/src/commands/snapshot.rs
  - tsconfig.json
  - src/lib/components/skills/SyncInfoBar.tsx
  - src/lib/stores/navigation.ts
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - .session/felina_development_report.md
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/types/skills.ts
tests:
  - src/lib/stores/navigation.test.ts
-->