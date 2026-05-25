# app-pages Specification

## Purpose

TBD - created by archiving change 'cleanup-glyphic-base'. Update Purpose after archive.

## Requirements

### Requirement: Registered Pages

The desktop app SHALL register exactly seven pages in its navigation: `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, and `history`. The route table in `src/router.tsx` and the `NAV_ITEMS` array plus `Page` type union in `src/lib/stores/navigation.ts` MUST all be consistent and contain exactly these seven entries and no others. The app SHALL NOT render a shared application-level title bar above the page content; page titles are owned by each page (see the Page Title Provision requirement), so there is no `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map to keep consistent.

The `skills` and `projects` pages SHALL be siblings; the prior pattern of using an in-page Global/Project toggle on the Skills page to switch between two canonical-scope views SHALL be removed. The Skills page SHALL show only global canonical master files; the Projects page SHALL show a per-project managed-inventory view defined by the `projects-view` capability.

#### Scenario: User opens the app

- **WHEN** the user launches the app via `npm run tauri dev` or the bundled binary
- **THEN** the Sidebar SHALL display nav items only for `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, and `history`
- **AND** each nav item SHALL navigate to its route defined in `src/router.tsx`

#### Scenario: Navigation registration sources are consistent

- **WHEN** an inspector compares the route paths in `src/router.tsx` and the `NAV_ITEMS` ids plus `Page` type members in `src/lib/stores/navigation.ts`
- **THEN** both sources SHALL contain exactly the set `{skills, projects, settings, templates, tokens, memory, history}`
- **AND** neither SHALL contain a page id outside this set
- **AND** there SHALL be no `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map in the codebase acting as a third navigation-consistency source

#### Scenario: User invokes the Command Palette

- **WHEN** the user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the palette SHALL list only the seven registered pages as navigation targets
- **AND** entries for any removed or retained-but-unregistered page MUST NOT appear

#### Scenario: Skills page does not show a canonical-scope toggle

- **WHEN** the user opens the Skills page
- **THEN** the page header SHALL NOT render a Global/Project toggle
- **AND** the page SHALL list canonical skills sourced exclusively from `~/.felina/skills/`

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

---
### Requirement: Page-Level i18n Coverage

All user-facing UI text in page components under `src/lib/components/skills/` and `src/lib/components/projects/` SHALL use the project's i18n system (`t(locale, key)` from `src/lib/i18n/index.ts`) instead of hardcoded string literals. The i18n dictionaries (`src/lib/i18n/locales/en.ts` and `src/lib/i18n/locales/zh-TW.ts`) SHALL contain a `skills` namespace and a `projects` namespace that cover all user-facing labels, tooltips, button text, status messages, confirmation dialogs, empty states, and error display text rendered by these components.

User/system data — including skill names, file paths, agent identifiers, project paths, timestamps, and backend error payloads — SHALL NOT be translated; they SHALL be rendered verbatim.

Each component SHALL read the active locale from `useLocaleStore` and pass it to `t()` for every user-facing string. The Tokens page (`src/lib/components/tokens/TokensPage.tsx`) and its `tokens` namespace in the i18n dictionaries serve as the implementation reference pattern.

#### Scenario: Language switch updates Skills page text

- **WHEN** the user switches the app language from English to zh-TW via the Settings language picker
- **THEN** all user-facing labels, tooltips, button text, status messages, and empty-state messages on the Skills page SHALL render in Traditional Chinese
- **AND** skill names, file paths, agent identifiers, and timestamps SHALL remain unchanged

#### Scenario: Language switch updates Projects page text

- **WHEN** the user switches the app language from English to zh-TW
- **THEN** all user-facing labels, tooltips, and status messages on the Projects page SHALL render in Traditional Chinese
- **AND** project paths, skill names, and agent chip labels SHALL remain unchanged

#### Scenario: Translation key completeness

- **WHEN** an inspector compares the `skills` and `projects` namespaces in `en.ts` against `zh-TW.ts`
- **THEN** every key present in `en.ts` SHALL have a corresponding entry in `zh-TW.ts`
- **AND** the TypeScript type system (`TranslationDict`) SHALL enforce structural parity at compile time

#### Scenario: No hardcoded UI text in Skills or Projects components

- **WHEN** an inspector searches for string literals used as JSX text content or prop values in `src/lib/components/skills/*.tsx` and `src/lib/components/projects/*.tsx`
- **THEN** no user-facing display text SHALL appear as a hardcoded string literal
- **AND** all such text SHALL be resolved through `t(locale, key)` calls

---
### Requirement: i18n Development Convention

The project's development instructions (CLAUDE.md Gotchas section) SHALL include a rule stating that all new or modified user-facing UI text MUST use `t(locale, key)` from the i18n system. Hardcoded user-facing string literals in page components SHALL be treated as a defect. This convention applies to all pages, not only Skills and Projects.

#### Scenario: Convention documented in project instructions

- **WHEN** an inspector reads the Gotchas section of CLAUDE.md
- **THEN** a rule SHALL be present stating that new or modified UI text MUST use `t(locale, key)` and that hardcoded user-facing strings are not allowed

#### Scenario: New component follows convention

- **WHEN** a developer adds a new page component with user-facing text
- **THEN** the component SHALL use `t(locale, key)` for all display text
- **AND** the corresponding translation keys SHALL be added to both `en.ts` and `zh-TW.ts`

---
### Requirement: Page Title Provision

The app SHALL NOT render a shared application-level header bar above the routed page content; the `AppLayout` in `src/router.tsx` SHALL NOT mount a global title/description component, and `src/lib/components/layout/Header.tsx` SHALL NOT exist. Each registered page SHALL render its own title within its own component. Pages under active development (`skills`, `projects`, `tokens`) SHALL render their existing in-page title (the `PageScaffold` `PageHeader` for `skills` and `projects`, the in-page heading for `tokens`). Legacy pages pending redevelopment (`settings`, `memory`, `history`) SHALL each render at least a minimal in-page title so that no registered page is title-less.

#### Scenario: No global header bar above page content

- **WHEN** an inspector reads `AppLayout` in `src/router.tsx`
- **THEN** it SHALL NOT mount a shared header/title component above the `<Outlet />`
- **AND** the file `src/lib/components/layout/Header.tsx` MUST NOT exist

#### Scenario: Every registered page shows exactly one title

- **WHEN** the user navigates to any of `skills`, `projects`, `settings`, `templates`, `tokens`, `memory`, or `history`
- **THEN** the page SHALL display its title exactly once
- **AND** no page SHALL display two stacked page-level titles

#### Scenario: Legacy pages retain a placeholder title

- **WHEN** the user opens `settings`, `memory`, or `history`
- **THEN** each page SHALL display a non-empty in-page title
- **AND** that title MAY be a minimal hardcoded heading not wired to the i18n system, because these pages are pending redevelopment
