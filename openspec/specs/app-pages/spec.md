# app-pages Specification

## Purpose

TBD - created by archiving change 'cleanup-glyphic-base'. Update Purpose after archive.

## Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly four pages in its navigation: `skills`, `settings`, `templates`, and `memory`. The route table in `src/router.tsx`, the `NAV_ITEMS` array and `Page` type union in `src/lib/stores/navigation.ts`, and the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps in `src/lib/components/layout/Header.tsx` MUST all be consistent and contain exactly these four entries and no others.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `settings`, `templates`, and `memory`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx`, the `NAV_ITEMS` ids and `Page` type members in `src/lib/stores/navigation.ts`, and the keys of `PAGE_TITLES` / `PAGE_DESCRIPTIONS` in `src/lib/components/layout/Header.tsx`
- **THEN** all four sources SHALL contain exactly the set `{skills, settings, templates, memory}`
- **AND** none SHALL contain a page id outside this set

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the four registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

##### Example: command palette navigation entries

- **GIVEN** the cleanup is complete
- **WHEN** the palette renders its navigation section from `NAV_ITEMS`
- **THEN** the visible navigation entries are exactly: Skills & Agents, Settings, Templates, Memory


<!-- @trace
source: cleanup-glyphic-base
updated: 2026-05-21
code:
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/keybindings.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - SECURITY.md
  - src/lib/stores/navigation.ts
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/layout/Sidebar.tsx
  - CONTRIBUTING.md
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - README.md
  - src-tauri/src/tokens/scanner.rs
  - package.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/src/paths.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - screenshots/plugins.png
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/filter/builtin.rs
  - src/lib/stores/project-context.svelte.ts
  - screenshots/rules.png
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/hooks.png
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/tokens/types.rs
  - screenshots/mcp.png
  - src/App.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/utils/format.ts
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/terminal/TerminalPage.svelte
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/tokens/parsers/claude_code.rs
  - .session/handoff/2026-05-20.md
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - screenshots/analytics.png
  - screenshots/instructions.png
  - src/App.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/dashboard/StatsOverview.tsx
  - CHANGELOG.md
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/router.tsx
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/stores/pipeline-execution.svelte.ts
  - src-tauri/src/filter/pipeline.rs
  - src/lib/components/layout/Header.tsx
  - screenshots/git.png
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src/lib/stores/terminal.ts
  - src-tauri/src/ctx/mod.rs
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/stores/terminal.svelte.ts
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/i18n/index.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - screenshots/terminal.png
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/filter/mod.rs
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/gen/schemas/desktop-schema.json
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/scheduler.rs
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src-tauri/src/commands/git.rs
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/analytics/AnalyticsPage.svelte
  - CODE_OF_CONDUCT.md
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - screenshots/dashboard.png
  - src-tauri/src/ctx/hook.rs
-->

---
### Requirement: Retained-for-Reference Components

The repository SHALL retain the frontend components and Rust command modules for the pages `hooks`, `instructions`, `mcp`, and `rules` even though they are not registered in navigation. The Rust modules MUST remain declared in `src-tauri/src/commands/mod.rs` so the files compile, but MUST NOT be registered in the `invoke_handler!` macro in `src-tauri/src/lib.rs`. These pages MUST NOT appear in `src/router.tsx`, `NAV_ITEMS`, the `Page` type, or the Header maps.

#### Scenario: Codebase audit for retained components

- **WHEN** an inspector greps `src/lib/components/` for the names `hooks`, `instructions`, `mcp`, `rules`
- **THEN** each name SHALL match an existing component directory containing the page module file
- **AND** each corresponding Rust file under `src-tauri/src/commands/` SHALL exist and compile

#### Scenario: Retained pages absent from navigation

- **WHEN** an inspector reads `src/router.tsx` and `src/lib/stores/navigation.ts`
- **THEN** the page ids `hooks`, `instructions`, `mcp`, `rules` MUST NOT appear in the route table, `NAV_ITEMS`, or the `Page` type union

#### Scenario: Build verification of unregistered commands

- **WHEN** the developer runs `cargo build` inside `src-tauri/`
- **THEN** the build SHALL succeed with exit code 0
- **AND** the build output MUST NOT contain `unused` warnings for the retained command modules


<!-- @trace
source: cleanup-glyphic-base
updated: 2026-05-21
code:
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/keybindings.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - SECURITY.md
  - src/lib/stores/navigation.ts
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/layout/Sidebar.tsx
  - CONTRIBUTING.md
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - README.md
  - src-tauri/src/tokens/scanner.rs
  - package.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/src/paths.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - screenshots/plugins.png
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/filter/builtin.rs
  - src/lib/stores/project-context.svelte.ts
  - screenshots/rules.png
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/hooks.png
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/tokens/types.rs
  - screenshots/mcp.png
  - src/App.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/utils/format.ts
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/terminal/TerminalPage.svelte
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/tokens/parsers/claude_code.rs
  - .session/handoff/2026-05-20.md
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - screenshots/analytics.png
  - screenshots/instructions.png
  - src/App.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/dashboard/StatsOverview.tsx
  - CHANGELOG.md
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/router.tsx
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/stores/pipeline-execution.svelte.ts
  - src-tauri/src/filter/pipeline.rs
  - src/lib/components/layout/Header.tsx
  - screenshots/git.png
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src/lib/stores/terminal.ts
  - src-tauri/src/ctx/mod.rs
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/stores/terminal.svelte.ts
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/i18n/index.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - screenshots/terminal.png
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/filter/mod.rs
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/gen/schemas/desktop-schema.json
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/scheduler.rs
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src-tauri/src/commands/git.rs
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/analytics/AnalyticsPage.svelte
  - CODE_OF_CONDUCT.md
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - screenshots/dashboard.png
  - src-tauri/src/ctx/hook.rs
-->

---
### Requirement: Removed Pages and Subsystems

The repository SHALL NOT contain any code for the following removed pages: `dashboard`, `plugins`, `git`, `pipelines`, `sessions`, `terminal`, `analytics`, `token-savings`, `context-engine`, `keybindings`. The repository SHALL NOT contain the Rust binaries `glyphic-filter` and `glyphic-ctx`, nor the modules `src-tauri/src/pty.rs`, `src-tauri/src/filter/`, `src-tauri/src/ctx/`. The removed page ids MUST NOT appear in `src/router.tsx`, `NAV_ITEMS`, the `Page` type, or the Header maps.

#### Scenario: Filesystem audit confirms removal

- **WHEN** an inspector lists `src/lib/components/`
- **THEN** none of the directories `dashboard`, `plugins`, `git`, `pipelines`, `sessions`, `terminal`, `analytics`, `token-savings`, `context-engine`, `keybindings` SHALL be present

#### Scenario: Removed pages absent from navigation sources

- **WHEN** an inspector reads `src/router.tsx`, `src/lib/stores/navigation.ts`, and `src/lib/components/layout/Header.tsx`
- **THEN** none of the removed page ids SHALL appear in the route table, `NAV_ITEMS`, the `Page` type union, or the `PAGE_TITLES` / `PAGE_DESCRIPTIONS` maps

#### Scenario: Cargo binary audit

- **WHEN** an inspector reads `src-tauri/Cargo.toml`
- **THEN** the `[[bin]]` entries for `glyphic-filter` and `glyphic-ctx` MUST NOT exist
- **AND** files `src-tauri/src/bin/glyphic_filter.rs` and `src-tauri/src/bin/glyphic_ctx.rs` MUST NOT exist


<!-- @trace
source: cleanup-glyphic-base
updated: 2026-05-21
code:
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/keybindings.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - SECURITY.md
  - src/lib/stores/navigation.ts
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/layout/Sidebar.tsx
  - CONTRIBUTING.md
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - README.md
  - src-tauri/src/tokens/scanner.rs
  - package.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/src/paths.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - screenshots/plugins.png
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/filter/builtin.rs
  - src/lib/stores/project-context.svelte.ts
  - screenshots/rules.png
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/hooks.png
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/tokens/types.rs
  - screenshots/mcp.png
  - src/App.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/utils/format.ts
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/terminal/TerminalPage.svelte
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/tokens/parsers/claude_code.rs
  - .session/handoff/2026-05-20.md
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - screenshots/analytics.png
  - screenshots/instructions.png
  - src/App.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/dashboard/StatsOverview.tsx
  - CHANGELOG.md
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/router.tsx
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/stores/pipeline-execution.svelte.ts
  - src-tauri/src/filter/pipeline.rs
  - src/lib/components/layout/Header.tsx
  - screenshots/git.png
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src/lib/stores/terminal.ts
  - src-tauri/src/ctx/mod.rs
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/stores/terminal.svelte.ts
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/i18n/index.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - screenshots/terminal.png
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/filter/mod.rs
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/gen/schemas/desktop-schema.json
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/scheduler.rs
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src-tauri/src/commands/git.rs
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/analytics/AnalyticsPage.svelte
  - CODE_OF_CONDUCT.md
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - screenshots/dashboard.png
  - src-tauri/src/ctx/hook.rs
-->

---
### Requirement: No Svelte Residue

The repository SHALL NOT contain Svelte framework artifacts. The files `svelte.config.js` and `src/App.svelte` MUST NOT exist. No `*.svelte.ts` store files SHALL exist in `src/lib/stores/`. The `README.md` SHALL NOT advertise Svelte as the frontend framework.

#### Scenario: Svelte residue audit

- **WHEN** an inspector runs `git ls-files` and filters for `\.svelte$`, `\.svelte\.ts$`, or `svelte\.config`
- **THEN** the result SHALL be empty

#### Scenario: README badge audit

- **WHEN** an inspector reads the badge section of `README.md`
- **THEN** the framework badge SHALL identify React (not Svelte)
- **AND** the Tech Stack table row for Frontend SHALL list React


<!-- @trace
source: cleanup-glyphic-base
updated: 2026-05-21
code:
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/keybindings.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - SECURITY.md
  - src/lib/stores/navigation.ts
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/layout/Sidebar.tsx
  - CONTRIBUTING.md
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - README.md
  - src-tauri/src/tokens/scanner.rs
  - package.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/src/paths.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - screenshots/plugins.png
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/filter/builtin.rs
  - src/lib/stores/project-context.svelte.ts
  - screenshots/rules.png
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/hooks.png
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/tokens/types.rs
  - screenshots/mcp.png
  - src/App.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/utils/format.ts
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/terminal/TerminalPage.svelte
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/tokens/parsers/claude_code.rs
  - .session/handoff/2026-05-20.md
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - screenshots/analytics.png
  - screenshots/instructions.png
  - src/App.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/dashboard/StatsOverview.tsx
  - CHANGELOG.md
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/router.tsx
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/stores/pipeline-execution.svelte.ts
  - src-tauri/src/filter/pipeline.rs
  - src/lib/components/layout/Header.tsx
  - screenshots/git.png
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src/lib/stores/terminal.ts
  - src-tauri/src/ctx/mod.rs
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/stores/terminal.svelte.ts
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/i18n/index.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - screenshots/terminal.png
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/filter/mod.rs
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/gen/schemas/desktop-schema.json
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/scheduler.rs
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src-tauri/src/commands/git.rs
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/analytics/AnalyticsPage.svelte
  - CODE_OF_CONDUCT.md
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - screenshots/dashboard.png
  - src-tauri/src/ctx/hook.rs
-->

---
### Requirement: Build Baseline

The cleanup SHALL NOT regress the build relative to a pre-cleanup baseline. Running `npm run check` MUST NOT introduce any TypeScript error that is not already present in the baseline captured before cleanup began. The `npm run check` baseline is currently non-zero because of out-of-scope work-in-progress under `src/lib/components/tokens/`; the cleanup is therefore measured by diff against the baseline, not by a green exit code. Running `cargo build` inside `src-tauri/` MUST NOT introduce any new error or warning relative to its baseline and MUST produce only the default binary `glyphic`; when the local machine lacks the MSVC linker toolchain, this Rust verification MAY be deferred to a machine or CI environment that can build, and the deferral MUST be recorded in the change notes.

#### Scenario: TypeScript baseline preserved

- **WHEN** the developer runs `npm run check` after the cleanup
- **THEN** every TypeScript error present in the output MUST also be present in the baseline captured before the cleanup work began
- **AND** the cleanup MUST NOT add any TypeScript error absent from that baseline

#### Scenario: Page type consistency holds after narrowing

- **WHEN** the `Page` type union in `src/lib/stores/navigation.ts` is narrowed to the four registered pages
- **THEN** `npm run check` SHALL report no errors in `src/lib/components/layout/Header.tsx` arising from `PAGE_TITLES` or `PAGE_DESCRIPTIONS` missing or excess keys

#### Scenario: Rust build produces only glyphic binary

- **WHEN** the developer runs `cargo build` inside `src-tauri/` on a machine with the MSVC linker toolchain available
- **THEN** the build SHALL NOT introduce any new error or warning relative to its baseline
- **AND** the only executable produced in `target/debug/` SHALL be `glyphic` (or `glyphic.exe` on Windows)
- **AND** if no MSVC linker toolchain is available locally, this verification MAY be deferred to a build-capable machine or CI and the deferral recorded in the change notes

<!-- @trace
source: cleanup-glyphic-base
updated: 2026-05-21
code:
  - src-tauri/src/tokens/pricing.rs
  - src-tauri/src/commands/keybindings.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - SECURITY.md
  - src/lib/stores/navigation.ts
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/layout/Sidebar.tsx
  - CONTRIBUTING.md
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - README.md
  - src-tauri/src/tokens/scanner.rs
  - package.json
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/src/paths.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - screenshots/plugins.png
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/filter/builtin.rs
  - src/lib/stores/project-context.svelte.ts
  - screenshots/rules.png
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/hooks.png
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/tokens/types.rs
  - screenshots/mcp.png
  - src/App.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/utils/format.ts
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/terminal/TerminalPage.svelte
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/tokens/parsers/claude_code.rs
  - .session/handoff/2026-05-20.md
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - screenshots/analytics.png
  - screenshots/instructions.png
  - src/App.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/dashboard/StatsOverview.tsx
  - CHANGELOG.md
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/router.tsx
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/stores/pipeline-execution.svelte.ts
  - src-tauri/src/filter/pipeline.rs
  - src/lib/components/layout/Header.tsx
  - screenshots/git.png
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src/lib/stores/terminal.ts
  - src-tauri/src/ctx/mod.rs
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/stores/terminal.svelte.ts
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/i18n/index.ts
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - screenshots/terminal.png
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src-tauri/src/lib.rs
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/filter/mod.rs
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/gen/schemas/desktop-schema.json
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/scheduler.rs
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src-tauri/src/commands/git.rs
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/analytics/AnalyticsPage.svelte
  - CODE_OF_CONDUCT.md
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - screenshots/dashboard.png
  - src-tauri/src/ctx/hook.rs
-->

---
### Requirement: Settings Page Agent Paths Section

The Settings page SHALL provide a section that lets the user view and override the skill directory paths for each supported agent. The section SHALL expose, for each of the three supported agents (Anthropic, Codex, Gemini), a global path field and a project-relative path field, for six fields total. Each field SHALL default to the value defined by the agent-skills-schema reference. The system SHALL persist overrides and SHALL use the configured paths both for fan-out target locations and for import detection scope. The system SHALL reject a path that contains a parent-directory traversal segment or that escapes the user home or project root, falling back to the previous valid value and surfacing a warning. The section SHALL NOT expose configuration for any fourth agent.

#### Scenario: Default agent paths shown

- **WHEN** a user opens the Settings page Agent Paths section without having set overrides
- **THEN** the system SHALL display the schema-reference default paths for Anthropic, Codex, and Gemini
- **AND** the section SHALL show exactly six path fields (global and project for each of the three agents)

#### Scenario: Override changes fan-out target

- **WHEN** a user changes the Gemini project path to the `.agents/skills/` alias and saves
- **THEN** a subsequent push of a Gemini-targeted skill SHALL write to the new path
- **AND** import detection SHALL scan the new path

#### Scenario: Reject path traversal

- **WHEN** a user enters a path containing a parent-directory traversal segment
- **THEN** the system SHALL reject the value
- **AND** the system SHALL retain the previous valid value and surface a warning

#### Scenario: Fourth agent not configurable

- **WHEN** a user views the Agent Paths section
- **THEN** the system SHALL show configuration only for Anthropic, Codex, and Gemini
- **AND** the section SHALL NOT present fields for any other agent

<!-- @trace
source: multi-agent-skills-foundation
updated: 2026-05-22
code:
  - src/lib/types/index.ts
  - package.json
  - src-tauri/src/lib.rs
  - src-tauri/Cargo.toml
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/stores/locale.ts
  - .knowledge/knowledge-base/_index.json
  - src-tauri/tauri.conf.json
  - src/lib/components/layout/UpdateBanner.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - index.html
  - src/lib/components/shared/PageScaffold.tsx
  - .knowledge/experience/_index.json
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/skills/SkillImportWizard.tsx
  - src/lib/types/skills.ts
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/commands/skills.rs
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/skills/SkillImportBanner.tsx
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/main.rs
  - src/lib/components/layout/Sidebar.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/router.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/stores/skills-store.ts
  - src/lib/stores/theme.ts
  - .session/product-backlog.md
  - .knowledge/_catalog.json
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/mod.rs
-->