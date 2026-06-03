# token-analytics-dashboard Specification

## Purpose

TBD - created by archiving change 'token-analytics-multi-agent'. Update Purpose after archive.

## Requirements

### Requirement: TokensPage replaces AnalyticsPage

The system SHALL provide a `TokensPage` React component at route `/tokens` that replaces the legacy `AnalyticsPage`. The page SHALL be loaded via `React.lazy()` code splitting. The page SHALL use `PageHeader` and `PageBody` components for its layout structure. The page's navigation tabs SHALL be placed within the `bottomSlot` property of the `PageHeader`.

#### Scenario: User navigates to /tokens

- **WHEN** the user navigates to `/tokens`
- **THEN** the TokensPage SHALL render with a loading spinner during lazy load
- **THEN** the page SHALL display the token analytics dashboard after data loads
- **AND** the page's structural layout SHALL consist of a `PageHeader` containing tabs and a `PageBody`


<!-- @trace
source: enforce-ui-guidelines-page-scaffold
updated: 2026-06-03
code:
  - src/lib/assets/logo.png
  - .session/product-backlog.md
  - src/lib/components/memory/MemoryPage.tsx
  - temp_spec_token_analytics.md
  - GEMINI.md
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/SkillList.tsx
  - src/router.tsx
  - src/app.css
  - src/lib/components/projects/ProjectsPage.tsx
  - temp_tasks.md
  - temp_spec_history_page.md
  - src/lib/components/history/HistoryPage.tsx
  - temp_proposal.md
  - temp_spec_felina_settings.md
  - src/lib/components/projects/ProjectsList.tsx
  - .session/projects-page-ui-adjustment-report.md
  - temp_spec_app_pages.md
  - src/lib/assets/logo_.png
  - src/lib/components/projects/ManagedInventory.tsx
  - temp_design.md
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/shared/PageScaffold.tsx
-->

---
### Requirement: Token stat cards show summary metrics

The TokensPage SHALL display a row of summary stat cards showing: total tokens (sum of input + output + cache + reasoning), total cost in USD, total event count, active agent count, and cache hit ratio.

#### Scenario: Stat cards update with data

- **WHEN** token analytics data is loaded from the backend
- **THEN** each stat card SHALL display its metric with a formatted value


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Token time series chart

The system SHALL render a recharts `AreaChart` showing stacked token usage over time. The chart SHALL stack input tokens, output tokens, cache read tokens, and cache write tokens as separate areas. A `GranularityPicker` toggle SHALL switch between hourly, daily, weekly, and monthly buckets.

#### Scenario: Switching granularity updates chart

- **WHEN** the user clicks "Weekly" in the granularity picker
- **THEN** the time series chart SHALL re-fetch data and display weekly buckets


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Cost time series chart

The system SHALL render a recharts `AreaChart` showing daily cost trend (USD) over the selected date range.

#### Scenario: Cost chart shows daily spending

- **WHEN** daily analytics data is loaded
- **THEN** the cost chart SHALL display a line or area showing cost per day


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Model breakdown chart and table

The system SHALL render a recharts horizontal `BarChart` showing per-model token usage or cost, sorted descending. A sortable table variant (`ModelBreakdownTable`) SHALL show the same data in tabular format with columns for model, input tokens, output tokens, cache tokens, and cost.

#### Scenario: Model breakdown shows top models

- **WHEN** multiple models have been used
- **THEN** the bar chart SHALL display each model as a horizontal bar with cost or token count
- **THEN** the table SHALL be sortable by clicking column headers


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Hourly heatmap grid

The system SHALL render a 7-column (Mon-Sun) by 24-row (0h-23h) CSS Grid heatmap showing token usage intensity. Each cell SHALL be colored on a 5-level scale based on token count quantiles. Hovering a cell SHALL display a tooltip with exact token count and cost.

#### Scenario: Heatmap colors reflect intensity

- **GIVEN** hourly token data for the last 7 days
- **WHEN** the heatmap renders
- **THEN** cells with higher token counts SHALL have darker/intenser colors
- **THEN** cells with zero tokens SHALL have a neutral background color


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Cache efficiency card

The system SHALL render a card showing cache hit ratio as a percentage and estimated cost savings from Anthropic prompt caching. The card SHALL display a visual indicator (progress bar or ring) for the hit ratio.

#### Scenario: Cache card shows savings

- **GIVEN** cache_hit_ratio is 0.6 and cache_cost_saved is $15.30
- **WHEN** the cache efficiency card renders
- **THEN** it SHALL display "60%" as the hit ratio
- **THEN** it SHALL display "$15.30" as estimated savings


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Agent distribution chart

The system SHALL render a recharts `PieChart` or `BarChart` showing token usage distribution across available agents. When only one agent is available, the chart SHALL show per-model breakdown within that agent.

#### Scenario: Multi-agent distribution

- **GIVEN** data from Claude Code and Cursor agents
- **WHEN** the agent distribution chart renders
- **THEN** each agent SHALL be shown as a pie slice or bar proportional to its token share


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Agent status panel

The system SHALL render an `AgentStatusPanel` listing each detected agent with: agent name, availability status (installed/not installed), last scanned timestamp, event count, and total cost. The panel SHALL include a `RefreshButton` to trigger re-scanning.

#### Scenario: Refresh button triggers scan

- **WHEN** the user clicks the Refresh button
- **THEN** `refresh_token_data` SHALL be called
- **THEN** the UI SHALL show a loading state during the scan
- **THEN** the stat cards and charts SHALL update with new data


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Cost budget card

The TokensPage SHALL include a `CostBudgetCard` showing current daily/monthly spending against configured budget limits. When limits are exceeded, the card SHALL display a warning indicator. The monthly projection line SHALL extend the current burn rate to estimate month-end cost.

#### Scenario: Budget exceeded warning

- **GIVEN** daily limit is $10 and today's cost is $12
- **WHEN** the cost budget card renders
- **THEN** it SHALL display a warning indicator for the exceeded daily limit


<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Analytics redirect from old route

The system SHALL redirect requests to `/analytics` to `/tokens`. The legacy `AnalyticsPage.tsx` and `AnalyticsPage.svelte` SHALL be removed.

#### Scenario: Old analytics route redirects

- **WHEN** the user navigates to `/analytics`
- **THEN** the router SHALL redirect to `/tokens`

<!-- @trace
source: token-analytics-multi-agent
updated: 2026-05-22
code:
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/stores/pipeline-execution.svelte.ts
  - package.json
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/router.tsx
  - CONTRIBUTING.md
  - src/lib/components/sessions/SessionsPage.svelte
  - RELEASE_NOTES.md
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src-tauri/src/ctx/mod.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/filter/tracker.rs
  - src-tauri/Cargo.toml
  - src-tauri/src/tokens/parsers/mod.rs
  - src-tauri/src/commands/budget.rs
  - src/lib/stores/project-context.svelte.ts
  - src-tauri/src/commands/mcp.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/tokens/types.rs
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/utils/format.ts
  - src/App.svelte
  - svelte.config.js
  - src/lib/components/sessions/SessionMonitor.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/paths.rs
  - screenshots/hooks.png
  - src/lib/components/templates/TemplatesPage.svelte
  - screenshots/mcp.png
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - CHANGELOG.md
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src/lib/stores/navigation.svelte.ts
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/ctx/hook.rs
  - src/lib/components/hooks/HookEditor.svelte
  - src/lib/components/rules/RulesPage.svelte
  - src-tauri/src/commands/memory.rs
  - src/lib/components/settings/PermissionsEditor.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - screenshots/plugins.png
  - src-tauri/src/commands/scheduler.rs
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src-tauri/src/filter/mod.rs
  - src-tauri/src/tokens/tokscale.rs
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/layout/Header.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/ctx/config.rs
  - src/lib/components/hooks/HooksPage.svelte
  - src/lib/i18n/index.ts
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/types/token-analytics.ts
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/git.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/tokens/mod.rs
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/components/context-engine/ContextEnginePage.tsx
  - src-tauri/src/ctx/embed.rs
  - src-tauri/src/commands/maintenance.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src-tauri/src/filter/pipeline.rs
  - src-tauri/src/bin/glyphic_token_reconcile.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - screenshots/terminal.png
  - src-tauri/gen/schemas/windows-schema.json
  - src-tauri/src/commands/instructions.rs
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/components/hooks/HookHandlerForm.svelte
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src-tauri/src/tokens/pricing.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/commands/hooks.rs
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/components/layout/Header.tsx
  - screenshots/dashboard.png
  - src/lib/types/index.ts
  - src-tauri/src/pty.rs
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - .session/product-backlog.md
  - src/lib/stores/navigation.ts
  - src-tauri/src/tokens/scan_state.rs
  - CODE_OF_CONDUCT.md
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/layout/UpdateBanner.svelte
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - SECURITY.md
  - src/lib/stores/locale.ts
  - src/lib/components/skills/SkillsPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - docs/token-usage-source-of-truth.md
  - src/lib/components/shared/TemplateGallery.svelte
  - screenshots/instructions.png
  - src/lib/components/layout/ContextGauge.svelte
  - screenshots/analytics.png
  - src/lib/components/dashboard/DashboardPage.tsx
  - src-tauri/src/commands/projects.rs
  - src-tauri/src/commands/rules.rs
  - src/lib/i18n/locales/en.ts
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src-tauri/src/ctx/virtualize.rs
  - src-tauri/src/commands/keybindings.rs
  - screenshots/rules.png
  - src/lib/components/git/GitPage.svelte
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src-tauri/src/tokens/reconciliation.rs
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src-tauri/src/tokens/aggregator.rs
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/dashboard/StatsOverview.tsx
  - src-tauri/src/commands/skills.rs
  - README.md
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/tauri/commands.ts
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/hooks/HookCard.svelte
  - src-tauri/src/ctx/db.rs
  - src-tauri/src/commands/pipelines.rs
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src-tauri/src/commands/settings.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/lib.rs
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src-tauri/src/commands/stats.rs
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src-tauri/src/commands/context_engine.rs
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/stores/terminal.svelte.ts
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/settings/GeneralSettings.svelte
-->

---
### Requirement: Tokens Daily sessions link to History

The Tokens page SHALL provide a History navigation action for Daily Top sessions. The action SHALL navigate to `/history` with search parameters containing the selected session agent and session ID.

#### Scenario: User opens a Top session in History

- **WHEN** the user expands a Daily row on `/tokens` and invokes the History action for a Top session with `agent=codex-cli` and `session_id=abc123`
- **THEN** the app SHALL navigate to `/history?agent=codex-cli&session=abc123`

#### Scenario: Top session remains revealable when source exists

- **WHEN** the user invokes an explicit reveal action for a Top session whose transcript source file exists
- **THEN** the operating system file manager SHALL open at or near the transcript source file

##### Example: reveal action from Tokens

- **GIVEN** a Top session row with `agent=codex-cli`, `session_id=abc123`, and source path `/Users/u/.codex/sessions/abc123.jsonl`
- **WHEN** the user invokes the reveal action for that row
- **THEN** the operating system file manager SHALL open at or near `/Users/u/.codex/sessions/abc123.jsonl`

#### Scenario: Top session target is missing

- **WHEN** the user invokes a History or reveal action for a Top session whose transcript source file cannot be resolved
- **THEN** the system SHALL surface a non-crashing unavailable or not-found state
- **AND** the Tokens page SHALL keep the Daily detail expanded

##### Example: missing Top session target

- **GIVEN** a Top session row with `agent=codex-cli` and `session_id=missing123`
- **WHEN** the user invokes reveal and the source cannot be resolved
- **THEN** the Tokens page SHALL show not-found feedback and keep the Daily detail expanded

<!-- @trace
source: add-history-page
updated: 2026-05-25
code:
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/layout/Header.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/i18n/locales/en.ts
  - src/router.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/history/HistoryPage.tsx
-->

---
### Requirement: Insight-first tokens dashboard hierarchy

The TokensPage SHALL prioritize usage and accounting insights above temporal charts. The first viewport MUST present KPI summary, active source status, data resolution status, top model usage, cache composition, and agent split before secondary temporal analysis.

#### Scenario: Aggregate tokscale data loads

- **WHEN** `/tokens` loads analytics data where the active source is tokscale-backed aggregate data
- **THEN** the page SHALL show total tokens, message count, estimated cost, and cache read percentage in the primary summary
- **THEN** the page SHALL show top model usage and cache composition as primary analysis
- **THEN** temporal charts SHALL NOT be the dominant first-viewport content

##### Example: cache-heavy aggregate summary

- **GIVEN** analytics totals include `1,145,331,036` cache read tokens and `1,190,608,772` total tokens
- **WHEN** the dashboard renders the primary summary
- **THEN** cache read percentage is presented as a key insight
- **THEN** model and agent sections use total tokens including cache and reasoning tokens


<!-- @trace
source: refocus-tokens-dashboard-insights
updated: 2026-05-25
code:
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Header.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/history/HistoryPage.tsx
  - src/router.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
-->

---
### Requirement: Top models insight table

The TokensPage SHALL provide a top models insight table that ranks models by meaningful usage metrics. Each row MUST show model, agent, total tokens, token composition, cache read percentage, message count, and estimated cost when cost is available.

#### Scenario: User reviews model usage

- **WHEN** model breakdown data is available
- **THEN** the dashboard SHALL present a table sorted by total tokens or estimated cost
- **THEN** the table SHALL make cache-heavy models distinguishable from non-cache-heavy models
- **THEN** the table SHALL preserve model and agent names without requiring chart hover interaction

##### Example: ranking by total tokens

| Model | Input | Output | Cache Read | Cache Write | Reasoning | Expected Total |
| ----- | ----- | ------ | ---------- | ----------- | --------- | -------------- |
| claude-opus-4-6 | 76606 | 1654362 | 486225798 | 9816134 | 0 | 497772900 |
| gpt-5.5 | 6030203 | 428258 | 97396608 | 0 | 74342 | 103929411 |


<!-- @trace
source: refocus-tokens-dashboard-insights
updated: 2026-05-25
code:
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Header.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/history/HistoryPage.tsx
  - src/router.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
-->

---
### Requirement: Data resolution governs temporal views

The TokensPage SHALL classify analytics data resolution before rendering temporal views. If analytics data only contains aggregate or all-scope buckets, the page MUST show a data resolution explanation instead of presenting time series or hourly heatmap as if dated activity exists.

#### Scenario: Aggregate-only buckets

- **WHEN** `time_series` contains only a bucket labeled `all`
- **THEN** the dashboard SHALL identify the data resolution as aggregate-only
- **THEN** token trend and cost trend views SHALL be secondary or replaced by an aggregate explanation
- **THEN** hourly activity SHALL show an unavailable state instead of an empty heatmap grid

##### Example: all bucket handling

- **GIVEN** `time_series=[{ label: "all", event_count: 12681 }]`
- **AND** `hourly_heatmap=[]`
- **WHEN** `/tokens` renders
- **THEN** the page explains that dated/hourly buckets are unavailable
- **THEN** it does not label the aggregate bucket as daily or hourly activity

#### Scenario: Dated buckets available

- **WHEN** `time_series` contains dated labels such as `2026-05-20` and `2026-05-21`
- **THEN** token and cost trend views SHALL be available as secondary analysis
- **THEN** the date range and granularity controls SHALL continue to update the chart data


<!-- @trace
source: refocus-tokens-dashboard-insights
updated: 2026-05-25
code:
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Header.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/history/HistoryPage.tsx
  - src/router.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
-->

---
### Requirement: Estimated cost transparency

The TokensPage SHALL label cost values as estimated unless the backend explicitly provides exact billing confidence. Unknown or fallback pricing MUST be communicated in the UI without blocking usage analysis.

#### Scenario: Dashboard displays cost

- **WHEN** total cost or model cost values are shown
- **THEN** labels SHALL use estimated cost wording
- **THEN** the dashboard SHALL avoid presenting estimated values as exact invoices or billing records

##### Example: estimated cost copy

| Existing Label | Required Meaning |
| -------------- | ---------------- |
| Total Cost | Estimated cost |
| Cost by Model | Estimated cost by model |
| Spending Overview | Estimated spending overview |


<!-- @trace
source: refocus-tokens-dashboard-insights
updated: 2026-05-25
code:
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Header.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/history/HistoryPage.tsx
  - src/router.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
-->

---
### Requirement: Compact refresh and source diagnostics

The TokensPage SHALL show refresh and source status in a compact status area. Detailed diagnostics such as scanned files, skipped files, inserted rows, and individual errors MUST be available when refresh fails or diagnostics are expanded, but they SHALL NOT dominate the primary analytics layout after successful refresh.

#### Scenario: Successful refresh

- **WHEN** `refresh_token_data` returns `status=ok` and `active_source=tokscale_export`
- **THEN** the page SHALL show the active source and success state compactly
- **THEN** detailed scan coverage SHALL remain collapsed or visually secondary

#### Scenario: Failed refresh

- **WHEN** `refresh_token_data` returns a non-ok status such as `missing_binary`, `command_failed`, or `unsupported_schema`
- **THEN** the page SHALL surface the failure status and actionable diagnostic message
- **THEN** existing analytics SHALL remain visible when available

<!-- @trace
source: refocus-tokens-dashboard-insights
updated: 2026-05-25
code:
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/layout/Header.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/history/HistoryPage.tsx
  - src/router.tsx
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/memory/MemoryPage.tsx
-->