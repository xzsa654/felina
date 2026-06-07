# token-analytics-api Specification

## Purpose

TBD - created by archiving change 'token-analytics-multi-agent'. Update Purpose after archive.

## Requirements

### Requirement: get_token_analytics command

The system SHALL expose a `get_token_analytics` Tauri command that returns a complete `TokenAnalytics` response. The command SHALL accept optional parameters: `granularity` (hourly/daily/weekly/monthly), `date_start`, `date_end`, `filter_agent`, and `filter_model`. The response SHALL include total aggregates, time series buckets, model breakdown, agent breakdown, and hourly heatmap data.

**Implementation constraint**: Backend HTTP calls to external APIs (e.g., Anthropic OAuth/Usage) SHALL use the in-process `reqwest` HTTP client, NOT external CLI tools such as `curl`. On Windows, any subprocess invocation (e.g., tokscale, explorer) SHALL set the `CREATE_NO_WINDOW` (0x08000000) creation flag to prevent console window popups in the GUI application.

#### Scenario: Daily analytics for the last 7 days

- **WHEN** `get_token_analytics` is called with `granularity="daily"` and appropriate date range
- **THEN** the response SHALL contain 7 time series buckets, one per day
- **THEN** each bucket SHALL include input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, and cost_usd

#### Scenario: Windows GUI subprocess behavior

- **WHEN** any token analytics backend operation spawns a subprocess on Windows
- **THEN** no console window SHALL appear to the user
- **THEN** the subprocess SHALL execute silently and return results via stdout/stderr capture


<!-- @trace
source: eliminate-subprocess-cmd-windows
updated: 2026-06-08
code:
  - .knowledge/knowledge-base/_index.json
  - src-tauri/src/tokens/ccusage.rs
  - .codex-rescue-prompt.txt
  - .knowledge/knowledge-base/architecture.md
  - .knowledge/knowledge-base/tauri.md
  - src-tauri/src/tokens/tokscale.rs
  - .knowledge/_catalog.json
  - .session/market-server-deployment.md
  - src-tauri/src/tokens/mod.rs
  - src-tauri/tauri.conf.json
  - .session/product-backlog.md
  - src-tauri/src/commands/tokens.rs
-->

---
### Requirement: get_model_breakdown command

The system SHALL expose a `get_model_breakdown` Tauri command that returns a list of `ModelBreakdown` records grouped by model, provider, and agent. The command SHALL accept optional `date_start` and `date_end` parameters.

#### Scenario: Model breakdown shows per-model costs

- **WHEN** `get_model_breakdown` is called
- **THEN** each record SHALL contain model name, provider, agent, token counts, and cost_usd
- **THEN** records SHALL be sorted by cost descending


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
### Requirement: get_cache_efficiency command

The system SHALL expose a `get_cache_efficiency` Tauri command that returns cache hit ratio and cost savings from Anthropic prompt caching. The response SHALL include `cache_hit_ratio` (cache_read / total_input), `cache_read_tokens`, `cache_write_tokens`, and `cache_cost_saved`.

#### Scenario: Cache efficiency for cache-heavy usage

- **GIVEN** token events include 1M input tokens total, with 600K cache_read and 100K cache_write
- **WHEN** `get_cache_efficiency` is called
- **THEN** cache_hit_ratio SHALL be 0.6 (60%)
- **THEN** cache_cost_saved SHALL reflect the price difference between regular input and cache_read tokens


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
### Requirement: get_available_agents command

The system SHALL expose a `get_available_agents` Tauri command that returns which agents are detected as installed, their last scanned timestamp, event count, and total cost.

#### Scenario: List available agents

- **WHEN** `get_available_agents` is called
- **THEN** the response SHALL list each agent with its availability status
- **THEN** only agents whose `is_available()` returned true SHALL show as available


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
### Requirement: refresh_token_data command

The system SHALL expose a `refresh_token_data` Tauri command that triggers a full re-scan of all available agent data. The command SHALL return the number of agents scanned, total events parsed, and any errors encountered.

#### Scenario: Manual refresh after new agent installation

- **WHEN** `refresh_token_data` is called
- **THEN** all available agent directories SHALL be re-scanned
- **THEN** new events SHALL be upserted into the SQLite database
- **THEN** the response SHALL report the count of new events parsed

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
### Requirement: Session analytics include agent identity

The system SHALL include agent identity in session analytics records returned for Daily Top sessions so callers can resolve session transcripts across supported agent sources.

#### Scenario: Daily Top sessions response includes agent

- **WHEN** `get_day_top_sessions` returns a session row
- **THEN** the row SHALL include `agent`
- **AND** `agent` SHALL be one of `claude-code`, `codex-cli`, or `gemini-cli`
- **AND** the row SHALL include `session_id`

##### Example: session row identity

- **GIVEN** a Codex event with `session_id=abc123`
- **WHEN** `get_day_top_sessions` includes that event in a row
- **THEN** the row SHALL include `agent=codex-cli` and `session_id=abc123`


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
### Requirement: Session transcript commands

The system SHALL expose Tauri commands for History session listing, transcript reading, and transcript source reveal. The commands SHALL use `agent + session_id` as the session identity for single-session operations.

#### Scenario: List sessions for History

- **WHEN** the History page requests local sessions
- **THEN** the backend SHALL return session records with agent, session ID, project when available, model when available, timestamp or date when available, message count when available, token total when available, and transcript availability status

##### Example: session list row

- **GIVEN** a readable Codex transcript for `session_id=abc123` and token analytics totals `messages=4` and `tokens=1200`
- **WHEN** the History page requests local sessions
- **THEN** one returned row SHALL include `agent=codex-cli`, `session_id=abc123`, `messages=4`, `tokens=1200`, and `transcript_available=true`

#### Scenario: Read a session transcript

- **WHEN** the frontend requests a transcript with `agent=codex-cli` and `session_id=abc123`
- **THEN** the backend SHALL resolve the matching supported local transcript source
- **AND** return a normalized transcript object containing source path, agent, session ID, metadata, and ordered entries

##### Example: normalized transcript entries

- **GIVEN** a Codex JSONL transcript containing a user entry followed by an assistant entry
- **WHEN** the frontend requests `agent=codex-cli` and `session_id=abc123`
- **THEN** the normalized transcript SHALL contain entries in source order with roles `user` and `assistant`

#### Scenario: Reveal a session transcript source

- **WHEN** the frontend requests reveal for `agent=codex-cli` and `session_id=abc123`
- **THEN** the backend SHALL resolve the matching transcript source file
- **AND** ask the operating system file manager to reveal that source file
- **AND** return the resolved transcript location when the reveal command succeeds

#### Scenario: Transcript source is unavailable

- **WHEN** the frontend requests read or reveal for a session whose transcript source cannot be resolved
- **THEN** the backend SHALL return a clear not-found error
- **AND** the backend SHALL NOT create a placeholder transcript file

##### Example: deleted source file

- **GIVEN** no supported local transcript file exists for `agent=codex-cli` and `session_id=missing123`
- **WHEN** the frontend requests read for that identity
- **THEN** the backend SHALL return a not-found error and create no file for `missing123`


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
### Requirement: Transcript content is not persisted in analytics storage

The system SHALL NOT persist full transcript body content in the token analytics database or app settings as part of the History first version. Transcript body content SHALL be read from local source files on demand.

#### Scenario: Transcript is read

- **WHEN** the user opens a session transcript in History
- **THEN** the backend SHALL read transcript content from the resolved local source file
- **AND** the backend SHALL NOT write transcript body content to token analytics storage

##### Example: on-demand transcript read

- **GIVEN** transcript content exists only in `/Users/u/.codex/sessions/abc123.jsonl`
- **WHEN** the user opens `codex-cli/abc123` in History
- **THEN** the backend SHALL read `/Users/u/.codex/sessions/abc123.jsonl` and SHALL NOT insert that transcript body into `token_events`

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