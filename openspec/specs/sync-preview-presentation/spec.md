# sync-preview-presentation Specification

## Purpose

TBD - created by archiving change 'refactor-push-dialog-style'. Update Purpose after archive.

## Requirements

### Requirement: Intuitive Target Visual Representation
The system SHALL present each sync target inside the preview dialog with its corresponding Agent Icon and an intuitive text label. When the target scope is "project", the label SHALL combine the Agent's display name and the project directory's folder basename (e.g., "Claude · felina"). When the target scope is "global", the label SHALL combine the Agent's display name and "Global" (e.g., "Claude · Global"). The system SHALL display the physical file path as a secondary truncated line beneath the primary target label.

#### Scenario: Display target with project scope
- **GIVEN** a sync preview item with agent "anthropic", scope "project", and project path "C:/MyProject/felina"
- **WHEN** the sync preview dialog is rendered
- **THEN** the item SHALL display the Claude brand icon
- **AND** the primary label SHALL read "Claude · felina"
- **AND** the secondary text SHALL display the target path

#### Scenario: Display target with global scope
- **GIVEN** a sync preview item with agent "gemini" and scope "global"
- **WHEN** the sync preview dialog is rendered
- **THEN** the item SHALL display the Antigravity brand icon
- **AND** the primary label SHALL read "Antigravity · Global"
- **AND** the secondary text SHALL display the target path


<!-- @trace
source: refactor-push-dialog-style
updated: 2026-06-03
code:
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/lib.rs
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/components/settings/PermissionsEditor.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - src/lib/types/index.ts
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/settings/EnvVarsEditor.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/queryClient.ts
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/hooks/HooksPage.tsx
  - src/lib/utils/achievements.ts
  - src/main.tsx
  - src/lib/stores/navigation.ts
  - src/router.tsx
  - src/lib/components/templates/TemplatesPage.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/settings.ts
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/tauri/commands.ts
  - temp_spec.md
  - src/lib/components/mcp/McpPage.tsx
  - temp_tasks.md
  - temp_proposal.md
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src/lib/types/hooks.ts
  - src/lib/components/hooks/HookCard.tsx
  - package.json
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - GEMINI.md
  - temp_design.md
  - src/lib/components/settings/GeneralSettings.tsx
-->

---
### Requirement: Layout Shift Protection
The system SHALL lock the layout grid dimensions of the sync preview dialog to prevent visual shifting. The grid column widths MUST be locked, and the destination/path column SHALL use flex-shrink/truncation to fit within the viewport. The decision `<select>` elements SHALL use a locked maximum width of `12rem` and apply text truncation. All preview rows SHALL have a static height of exactly `3.5rem` (14 Tailwind units), keeping vertical alignments and grid alignments stable regardless of selected resolution options.

#### Scenario: Interacting with the resolution dropdown
- **GIVEN** a sync preview item in the list requiring resolution
- **WHEN** the user opens the decision select box and hovers or changes options
- **THEN** the width of the decision column SHALL NOT change
- **AND** the height of the row SHALL remain exactly 3.5rem
- **AND** the other grid columns SHALL NOT shift horizontally

<!-- @trace
source: refactor-push-dialog-style
updated: 2026-06-03
code:
  - src-tauri/src/commands/settings.rs
  - src-tauri/src/lib.rs
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/components/settings/PermissionsEditor.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - src/lib/types/index.ts
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/settings/EnvVarsEditor.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/queryClient.ts
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/hooks/HooksPage.tsx
  - src/lib/utils/achievements.ts
  - src/main.tsx
  - src/lib/stores/navigation.ts
  - src/router.tsx
  - src/lib/components/templates/TemplatesPage.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/types/settings.ts
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/tauri/commands.ts
  - temp_spec.md
  - src/lib/components/mcp/McpPage.tsx
  - temp_tasks.md
  - temp_proposal.md
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/mcp.rs
  - src/lib/types/hooks.ts
  - src/lib/components/hooks/HookCard.tsx
  - package.json
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - GEMINI.md
  - temp_design.md
  - src/lib/components/settings/GeneralSettings.tsx
-->