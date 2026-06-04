# skill-directory-view Specification

## Purpose

TBD - created by archiving change 'add-skill-directory-tab'. Update Purpose after archive.

## Requirements

### Requirement: Skill directory tree retrieval
The system SHALL provide a Tauri command to recursively retrieve the directory structure of a canonical skill.

#### Scenario: Retrieving valid skill directory
- **WHEN** the frontend requests the directory tree for a valid canonical skill ID
- **THEN** the system SHALL return a hierarchical tree of files and directories, excluding `SKILL.md` and `.felina-sync-meta.json`

##### Example: filtered directory contents
- **GIVEN** a skill directory containing `SKILL.md`, `.felina-sync-meta.json`, `scripts/deploy.sh`, and `README.md`
- **WHEN** the directory tree is requested
- **THEN** the system returns a tree containing `scripts/deploy.sh` and `README.md`

#### Scenario: Retrieving missing skill directory
- **WHEN** the frontend requests the directory tree for a non-existent skill ID
- **THEN** the system SHALL return an error indicating the directory cannot be read


<!-- @trace
source: add-skill-directory-tab
updated: 2026-06-04
code:
  - src-tauri/src/commands/settings.rs
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/sync-status-utils.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/components/settings/EnvVarsEditor.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/mcp/McpPage.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/stores/navigation.ts
  - src/router.tsx
  - src-tauri/src/commands/mod.rs
  - .session/projects-page-ui-adjustment-report.md
  - package.json
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/lib/types/skills.ts
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/templates/TemplatesPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - src/lib/types/hooks.ts
  - src/lib/components/settings/GeneralSettings.tsx
  - src/lib/components/projects/ProjectsPage.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/shared/PageScaffold.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/types/settings.ts
  - src/lib/utils/achievements.ts
  - src/app.css
  - src/main.tsx
  - src/lib/assets/logo_.png
  - src/lib/assets/logo.png
  - src/lib/components/skills/SkillsPage.tsx
  - GEMINI.md
  - src/lib/components/shared/OnboardingWelcome.tsx
  - .session/product-backlog.md
  - src-tauri/src/commands/skill_import.rs
  - .session/felina_development_report.md
  - src/lib/components/hooks/HooksPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/paths.rs
  - src/lib/queryClient.ts
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/mcp.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/types/index.ts
  - src/lib/components/hooks/HookCard.tsx
  - src/lib/components/settings/PermissionsEditor.tsx
tests:
  - tests/sync-status-utils.test.ts
-->

---
### Requirement: Directory view UI
The skill editor UI SHALL display a read-only view of the skill's directory structure in a dedicated tab.

#### Scenario: Viewing the directory tab
- **WHEN** the user switches to the directory tab in the skill editor
- **THEN** the system SHALL display the file structure returned by the backend using a borderless, padding-driven list view conforming to Felina UI guidelines

<!-- @trace
source: add-skill-directory-tab
updated: 2026-06-04
code:
  - src-tauri/src/commands/settings.rs
  - src/lib/components/shared/TemplateGallery.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/sync-status-utils.ts
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src/lib/components/tokens/hooks/useTokenQueries.ts
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/projects/ProjectsList.tsx
  - src/lib/components/shared/ShapeGrid/ShapeGrid.css
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src-tauri/src/commands/skill_library.rs
  - src/lib/components/settings/EnvVarsEditor.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/mcp/McpPage.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/stores/navigation.ts
  - src/router.tsx
  - src-tauri/src/commands/mod.rs
  - .session/projects-page-ui-adjustment-report.md
  - package.json
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/lib/types/skills.ts
  - src/lib/components/settings/SkillLibrarySection.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/templates/TemplatesPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - src/lib/types/hooks.ts
  - src/lib/components/settings/GeneralSettings.tsx
  - src/lib/components/projects/ProjectsPage.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/shared/PageScaffold.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/types/settings.ts
  - src/lib/utils/achievements.ts
  - src/app.css
  - src/main.tsx
  - src/lib/assets/logo_.png
  - src/lib/assets/logo.png
  - src/lib/components/skills/SkillsPage.tsx
  - GEMINI.md
  - src/lib/components/shared/OnboardingWelcome.tsx
  - .session/product-backlog.md
  - src-tauri/src/commands/skill_import.rs
  - .session/felina_development_report.md
  - src/lib/components/hooks/HooksPage.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/paths.rs
  - src/lib/queryClient.ts
  - src/lib/tauri/commands.ts
  - src-tauri/src/commands/mcp.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/shared/ShapeGrid/ShapeGrid.jsx
  - src/lib/types/index.ts
  - src/lib/components/hooks/HookCard.tsx
  - src/lib/components/settings/PermissionsEditor.tsx
tests:
  - tests/sync-status-utils.test.ts
-->