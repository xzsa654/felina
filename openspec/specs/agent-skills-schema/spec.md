# agent-skills-schema Specification

## Purpose

TBD - created by archiving change 'agent-skills-schema-reference'. Update Purpose after archive.

## Requirements

### Requirement: Spec Prologue

The reference spec SHALL begin with a prologue that establishes scope, verification policy, and update workflow. The prologue MUST state that the contents are a snapshot, MUST instruct readers to re-verify content when an agent vendor publishes a major release, and MUST list every covered agent vendor as a bulleted inventory.

#### Scenario: Reader opens the reference for the first time

- **WHEN** a reader opens `openspec/specs/agent-skills-schema/spec.md`
- **THEN** the prologue paragraphs SHALL state that the spec is a time-bound snapshot
- **AND** the prologue SHALL instruct readers to re-verify each Requirement's facts when an agent vendor publishes a major release
- **AND** the prologue SHALL list the covered agent vendors as a bulleted inventory (initial inventory: Anthropic Claude, OpenAI Codex CLI, Google Gemini). Inventory entries SHALL use vendor + product family naming (not a specific CLI tool name) so the spec survives CLI-tool transitions without restructuring (see the Product lineage note inside **Google Gemini Skills Format**).


<!-- @trace
source: agent-skills-schema-reference
updated: 2026-05-21
code:
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/hook.rs
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - screenshots/hooks.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/router.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/i18n/index.ts
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/utils/format.ts
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/stores/project-context.svelte.ts
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/hooks/HooksPage.svelte
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - screenshots/instructions.png
  - .session/product-backlog.md
  - screenshots/git.png
  - CONTRIBUTING.md
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/git/GitPage.svelte
  - src-tauri/src/ctx/mod.rs
  - SECURITY.md
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/pty.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/types/index.ts
  - src/lib/components/dashboard/StatsOverview.tsx
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/commands/keybindings.rs
  - src-tauri/src/filter/pipeline.rs
  - src/App.tsx
  - src/App.svelte
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src-tauri/src/tokens/types.rs
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/Cargo.toml
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/ctx/db.rs
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - CHANGELOG.md
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src-tauri/src/paths.rs
  - CODE_OF_CONDUCT.md
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - screenshots/mcp.png
  - screenshots/plugins.png
  - src/lib/components/layout/Header.tsx
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - package.json
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - README.md
  - screenshots/analytics.png
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src/lib/components/hooks/HookHandlerForm.svelte
  - screenshots/dashboard.png
  - src/lib/components/layout/UpdateBanner.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/terminal.png
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - screenshots/rules.png
  - src/lib/stores/terminal.svelte.ts
  - src-tauri/src/ctx/config.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/settings/PermissionsEditor.svelte
  - RELEASE_NOTES.md
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/stores/navigation.ts
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src-tauri/src/lib.rs
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/pricing.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/filter/mod.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
-->

---
### Requirement: Anthropic Claude Skills Format

The reference SHALL document Anthropic Claude's skill format with all of the following facets: skill discovery location (global and project scopes), directory layout, primary file naming convention, frontmatter field schema (required fields, optional fields, field types), body format, bundled file support, and load mechanism (model-invoked vs always-loaded vs explicit). Every documented fact MUST be annotated with its source URL and a `verified YYYY-MM-DD` date.

#### Scenario: Lookup Anthropic skill discovery paths

- **WHEN** a reader needs Anthropic Claude's skill discovery rules
- **THEN** the spec SHALL state the global skill discovery path with its resolution rule
  - **Global (Personal)**: `~/.claude/skills/<skill-name>/SKILL.md` — user-level scope; applies across all projects.
  - **Precedence across discovery tiers**: Enterprise > Personal > Project > Plugin.
- **AND** the spec SHALL state the project skill discovery path with its resolution rule
  - **Project**: `.claude/skills/<skill-name>/SKILL.md` — discovered from the starting directory plus every parent directory up to the repository root. Nested `.claude/skills/` directories are also discovered on demand when tools access subdirectories (monorepo support). The `--add-dir` flag adds additional `.claude/skills/` roots.
  - **Plugin skills** use the namespace `plugin-name:skill-name`.
- **AND** the spec SHALL document directory layout and primary file naming
  - **Layout**: each skill is a directory. `SKILL.md` (uppercase) is the required main file. Optional sibling directories/files: `templates/`, `examples/`, `scripts/`, reference docs.
  - **Naming**: the skill directory name (lowercase letters, digits, hyphens; max 64 characters when specified via the `name` field) becomes the invocable identifier.
- **AND** each path statement SHALL be followed by its source URL and `verified YYYY-MM-DD` date
  - Source: https://code.claude.com/docs/en/skills.md (verified 2026-05-21)

#### Scenario: Lookup Anthropic frontmatter schema

- **WHEN** a reader needs the frontmatter fields recognized by Anthropic Claude Skills
- **THEN** the spec SHALL enumerate every recognized frontmatter field
  - **Required**: none formally required. `description` is strongly recommended because Claude uses it for auto-invocation discovery.
  - **Optional**:
    - `name` (string) — display name; if omitted, falls back to directory name. Constraints: lowercase letters, digits, hyphens; max 64 chars.
    - `description` (string, **recommended**) — what the skill does and when to use it. Combined with `when_to_use`, capped at 1,536 characters in skill listing.
    - `when_to_use` (string) — additional invocation triggers; appended to `description` in listing.
    - `argument-hint` (string) — autocomplete hint (e.g., `"[issue-number]"`).
    - `arguments` (string | list) — named positional arguments for `$name` substitution; space-separated string or YAML list.
    - `disable-model-invocation` (boolean) — `true` blocks Claude from auto-invoking (user-only).
    - `user-invocable` (boolean) — `false` hides the skill from the `/` menu (Claude-only).
    - `allowed-tools` (string | list) — tools the skill may use without per-use permission prompts.
    - `model` (string) — model override; accepts the same values as the `/model` command or `inherit`.
    - `effort` (enum: `low` | `medium` | `high` | `xhigh` | `max`) — effort override.
    - `context` (enum: `fork`) — `fork` runs the skill in an isolated subagent context.
    - `agent` (string) — subagent type to use when `context: fork`.
    - `hooks` (object) — skill-scoped lifecycle hooks.
    - `paths` (string | list) — glob patterns limiting when the skill activates.
    - `shell` (enum: `bash` | `powershell`) — shell for `` !`command` `` and ```` ```! ```` dynamic-context blocks (`powershell` requires `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`).
- **AND** the spec SHALL document body format
  - **Body**: free-form Markdown after `---` YAML frontmatter. Dynamic context injection via inline `` !`command` `` and multi-line ```` ```! ```` fences; commands run once at load time and their stdout replaces the placeholder before Claude sees the skill. Available substitutions: `$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `$name` (named args), `${CLAUDE_SESSION_ID}`, `${CLAUDE_EFFORT}`, `${CLAUDE_SKILL_DIR}`.
- **AND** the enumeration SHALL be followed by its source URL and `verified YYYY-MM-DD` date
  - Source: https://code.claude.com/docs/en/skills.md (verified 2026-05-21)

#### Scenario: Lookup Anthropic load mechanism

- **WHEN** a reader needs to know how Anthropic Claude loads a skill
- **THEN** the spec SHALL state whether skills are model-invoked, always-loaded, or explicit
  - **Hybrid (model-invoked + explicit)**: skill descriptions are always loaded into context so Claude can decide when to invoke. Full skill body loads only when Claude or the user invokes the skill. After auto-compaction, the body is re-attached using the first 5,000 tokens per skill, capped at 25,000 tokens combined across all loaded skills.
  - **Controls**: `disable-model-invocation: true` → user-only; `user-invocable: false` → Claude-only.
- **AND** the spec SHALL document bundled file support
  - **Bundled files**: optional subdirectories (`scripts/`, `references/`, `templates/`, `examples/`, `assets/`) referenced from `SKILL.md` body. Bundled files are available at runtime via the `${CLAUDE_SKILL_DIR}` substitution.
- **AND** the statement SHALL be followed by its source URL and `verified YYYY-MM-DD` date
  - Source: https://code.claude.com/docs/en/skills.md (verified 2026-05-21)


<!-- @trace
source: agent-skills-schema-reference
updated: 2026-05-21
code:
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/hook.rs
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - screenshots/hooks.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/router.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/i18n/index.ts
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/utils/format.ts
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/stores/project-context.svelte.ts
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/hooks/HooksPage.svelte
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - screenshots/instructions.png
  - .session/product-backlog.md
  - screenshots/git.png
  - CONTRIBUTING.md
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/git/GitPage.svelte
  - src-tauri/src/ctx/mod.rs
  - SECURITY.md
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/pty.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/types/index.ts
  - src/lib/components/dashboard/StatsOverview.tsx
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/commands/keybindings.rs
  - src-tauri/src/filter/pipeline.rs
  - src/App.tsx
  - src/App.svelte
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src-tauri/src/tokens/types.rs
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/Cargo.toml
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/ctx/db.rs
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - CHANGELOG.md
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src-tauri/src/paths.rs
  - CODE_OF_CONDUCT.md
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - screenshots/mcp.png
  - screenshots/plugins.png
  - src/lib/components/layout/Header.tsx
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - package.json
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - README.md
  - screenshots/analytics.png
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src/lib/components/hooks/HookHandlerForm.svelte
  - screenshots/dashboard.png
  - src/lib/components/layout/UpdateBanner.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/terminal.png
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - screenshots/rules.png
  - src/lib/stores/terminal.svelte.ts
  - src-tauri/src/ctx/config.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/settings/PermissionsEditor.svelte
  - RELEASE_NOTES.md
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/stores/navigation.ts
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src-tauri/src/lib.rs
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/pricing.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/filter/mod.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
-->

---
### Requirement: OpenAI Codex Skills Format

The reference SHALL cover OpenAI Codex CLI's equivalent of skills, OR explicitly document the absence of such a mechanism. If a skill system exists, the reference SHALL document the same facets as Anthropic (discovery location, naming, frontmatter, body, bundled files, load mechanism). If no skill system exists, the Requirement SHALL document the closest equivalent surface (e.g., AGENTS.md instruction file) and describe how Glyphic SHALL fan out skills to that surface (rendering target). Every documented fact MUST be annotated with its source URL and `verified YYYY-MM-DD` date.

#### Scenario: Codex skill system exists

- **WHEN** the research confirms OpenAI Codex CLI provides a dedicated skill system
- **THEN** the spec SHALL document its discovery location, naming convention, frontmatter schema, body format, bundled file support, and load mechanism using the same scenario shape as Anthropic
  - **Discovery — Global**: `$HOME/.agents/skills/<skill-name>/SKILL.md` (user); `/etc/codex/skills/<skill-name>/SKILL.md` (admin); skills bundled with Codex by OpenAI (system).
  - **Discovery — Project**: `.agents/skills/<skill-name>/SKILL.md`. Codex scans `.agents/skills` in every directory from the current working directory up to the repository root. Directory proximity determines order: CWD is searched before parent directories.
  - **Directory layout**: each skill is a directory. Required main file: `SKILL.md`. Optional siblings: `scripts/`, `references/`, `assets/`, and `agents/` (a per-vendor sub-config directory). Symlinked folders are supported.
  - **Frontmatter — Required**: `name` (string) and `description` (string). Per the official documentation: *"The `SKILL.md` file must include `name` and `description`."*
  - **Frontmatter — Optional in `SKILL.md`**: the documentation surfaces no additional `SKILL.md` frontmatter fields. Per-vendor optional metadata lives in a sibling file `agents/openai.yaml` (split file). Fields verified from the official `openai/skills` repository (https://github.com/openai/skills/blob/main/skills/.system/skill-creator/agents/openai.yaml, verified 2026-05-21):
    - `interface.display_name` (string) — display name shown in skill selectors.
    - `interface.short_description` (string) — concise description for UI listings.
    - `interface.default_prompt` (string) — prompt seeded when the user invokes the skill via UI.
  - Additional `agents/openai.yaml` keys (such as `interface.icons`, `interface.brand_color`, `policy.*`, `dependencies.*`) may exist per the documentation, but were not surfaced by the live `skill-creator` example as of 2026-05-21. Foundation change SHALL re-verify against current Codex schema documentation before relying on them.
  - **Body**: free-form Markdown after the YAML frontmatter — *"Skill instructions for Codex to follow."*
  - **Bundled files**: supported via `scripts/`, `references/`, `assets/` subdirectories under the skill directory.
  - **Load mechanism — Hybrid (model-invoked + explicit) with progressive disclosure**: Codex starts a session with each skill's `name`, `description`, and file path loaded into the system prompt. Full `SKILL.md` content loads only when Codex decides to use a skill. Explicit invocation via `/skills` command or `$` mention syntax. Implicit invocation when a task matches the skill's `description`.
  - **Precedence**: if two skills share the same `name`, Codex does NOT merge them — both can appear in skill selectors. Directory proximity (CWD before parents) determines discovery order.
- **AND** each documented fact SHALL be followed by its source URL and `verified YYYY-MM-DD` date
  - Source: https://developers.openai.com/codex/skills (verified 2026-05-21)
  - Related: https://developers.openai.com/codex/guides/agents-md (verified 2026-05-21) — Codex's separate `AGENTS.md` instruction-file system (not a skill mechanism; documented here for cross-reference).

#### Scenario: Codex has no skill system

- **WHEN** the research confirms OpenAI Codex CLI does not provide a dedicated skill system
- **THEN** the spec SHALL explicitly state this fact in the Requirement body
- **AND** the spec SHALL identify the closest equivalent surface (such as AGENTS.md) with its discovery location and format
- **AND** the spec SHALL describe how a canonical skill is rendered into that surface as Glyphic's fan-out target for this agent
- **AND** the no-skill-system finding SHALL be followed by its source URL and `verified YYYY-MM-DD` date

> **(not applicable: OpenAI Codex CLI 存在 dedicated skill system as of 2026-05-21 — see the "Codex skill system exists" scenario above.)** Codex documents Agent Skills at https://developers.openai.com/codex/skills, using `.agents/skills/<name>/SKILL.md` discovery and `name`+`description` required frontmatter. This branch is retained in the spec structure for traceability so that a future vendor change which removes Skills can flip the branch back without restructuring. Source: https://developers.openai.com/codex/skills (verified 2026-05-21).


<!-- @trace
source: agent-skills-schema-reference
updated: 2026-05-21
code:
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/hook.rs
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - screenshots/hooks.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/router.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/i18n/index.ts
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/utils/format.ts
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/stores/project-context.svelte.ts
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/hooks/HooksPage.svelte
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - screenshots/instructions.png
  - .session/product-backlog.md
  - screenshots/git.png
  - CONTRIBUTING.md
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/git/GitPage.svelte
  - src-tauri/src/ctx/mod.rs
  - SECURITY.md
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/pty.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/types/index.ts
  - src/lib/components/dashboard/StatsOverview.tsx
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/commands/keybindings.rs
  - src-tauri/src/filter/pipeline.rs
  - src/App.tsx
  - src/App.svelte
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src-tauri/src/tokens/types.rs
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/Cargo.toml
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/ctx/db.rs
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - CHANGELOG.md
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src-tauri/src/paths.rs
  - CODE_OF_CONDUCT.md
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - screenshots/mcp.png
  - screenshots/plugins.png
  - src/lib/components/layout/Header.tsx
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - package.json
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - README.md
  - screenshots/analytics.png
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src/lib/components/hooks/HookHandlerForm.svelte
  - screenshots/dashboard.png
  - src/lib/components/layout/UpdateBanner.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/terminal.png
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - screenshots/rules.png
  - src/lib/stores/terminal.svelte.ts
  - src-tauri/src/ctx/config.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/settings/PermissionsEditor.svelte
  - RELEASE_NOTES.md
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/stores/navigation.ts
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src-tauri/src/lib.rs
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/pricing.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/filter/mod.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
-->

---
### Requirement: Google Gemini Skills Format

UPDATE the discovery tiers to reflect the Antigravity CLI migration. The User skills global path SHALL change from `~/.gemini/skills/<skill-name>/SKILL.md` to `~/.gemini/antigravity-cli/skills/<skill-name>/SKILL.md`. The Workspace skills path SHALL change from `.gemini/skills/` to `.agents/skills/` (now primary, not alias). The product lineage note SHALL be updated to reflect that Antigravity CLI is now the active product.

#### Scenario: Gemini skill system exists

- **WHEN** the research confirms Google Gemini CLI provides a dedicated skill system
- **THEN** the spec SHALL document its discovery location, naming convention, frontmatter schema, body format, bundled file support, and load mechanism using the same scenario shape as Anthropic
  - **Discovery tiers (low → high precedence)**:
    1. Built-in skills (bundled with Antigravity CLI).
    2. Extension skills (from installed extensions).
    3. **User skills**: `~/.gemini/antigravity-cli/skills/<skill-name>/SKILL.md` or `~/.agents/skills/<skill-name>/SKILL.md` (alias).
    4. **Workspace skills**: `.agents/skills/<skill-name>/SKILL.md`.


<!-- @trace
source: gemini-to-antigravity-cli-default
updated: 2026-06-01
code:
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/skill_import.rs
  - .session/scratch/session-entry.md
  - src/lib/components/settings/AgentPathsSection.tsx
-->

---
### Requirement: Canonical Schema Definition

The reference SHALL define Glyphic's canonical skill main-file schema as the intersection of required fields across covered agents, the union of optional fields across covered agents, plus Glyphic-specific synchronization control fields. The Requirement MUST explicitly state which fields are required, which are optional, and which are Glyphic-specific. The `agents` synchronization control field MUST be defined as required regardless of intersection results.

#### Scenario: Lookup canonical required fields

- **WHEN** a reader needs the list of required fields in the canonical skill main file
- **THEN** the spec SHALL provide a flat list of required field names with their types and brief semantics
  - `agents` (list of strings, **Glyphic-specific**) — fan-out targets. Allowed values: `anthropic`, `codex`, `gemini`. Drives which agent-native locations receive the rendered skill copy.
  - `name` (string) — unique skill identifier. Lowercase letters, digits, hyphens; max 64 characters; should match the directory name.
  - `description` (string) — what the skill does and when to use it. All three agents use this string for model-invocation discovery.
- **AND** the list SHALL include the Glyphic-specific `agents` field as required
  - Covered above. `agents` is the only Glyphic-specific required field.
- **AND** the list SHALL include at minimum `name` and `description` (these are the expected intersection-derived required fields, subject to research confirmation)
  - **Research confirmation**:
    - OpenAI Codex requires both `name` and `description` in `SKILL.md` frontmatter (https://developers.openai.com/codex/skills, verified 2026-05-21).
    - Google Gemini requires both `name` and `description` in `SKILL.md` frontmatter (https://geminicli.com/docs/cli/skills/ + https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/creating-skills.md, verified 2026-05-21).
    - Anthropic Claude formally requires neither, but treats `description` as strongly recommended for auto-invocation discovery (https://code.claude.com/docs/en/skills.md, verified 2026-05-21).
  - **Decision**: canonical adopts `name` and `description` as required for cross-agent fan-out coherence (per design.md Decision 4 risk-mitigation: when strict intersection is empty or near-empty, canonical falls back to `agents` + `name` as required to preserve user experience).

#### Scenario: Lookup canonical optional fields

- **WHEN** a reader needs the list of optional fields in the canonical skill main file
- **THEN** the spec SHALL provide a flat list of optional field names with their types, brief semantics, and source agent(s) that recognize each field
  - `when_to_use` (string) — additional invocation triggers. Source: **Anthropic** (frontmatter field `when_to_use`).
  - `argument_hint` (string) — autocomplete hint. Source: **Anthropic** (`argument-hint`).
  - `arguments` (string | list) — named positional arguments. Source: **Anthropic**.
  - `disable_model_invocation` (boolean) — block auto-invocation. Source: **Anthropic** (`disable-model-invocation`).
  - `user_invocable` (boolean) — hide from user-facing menus. Source: **Anthropic** (`user-invocable`).
  - `allowed_tools` (string | list) — tools the skill may use without per-use prompts. Source: **Anthropic** (`allowed-tools`). Cross-vendor analog: Codex doc references tool dependencies in `agents/openai.yaml` but the field is unverified as of 2026-05-21 — foundation change will re-verify against current Codex schema.
  - `model` (string) — model override. Source: **Anthropic**.
  - `effort` (enum: `low` | `medium` | `high` | `xhigh` | `max`) — effort override. Source: **Anthropic**.
  - `context` (enum: `fork`) — subagent isolation. Source: **Anthropic**.
  - `subagent` (string) — subagent type to use when `context: fork`. Source: **Anthropic** (`agent`).
  - `hooks` (object) — skill-scoped lifecycle hooks. Source: **Anthropic**.
  - `paths` (string | list) — glob patterns limiting activation. Source: **Anthropic**.
  - `shell` (enum: `bash` | `powershell`) — dynamic-context-injection shell. Source: **Anthropic**.
  - `interface` (object: `display_name`, `short_description`, `default_prompt`) — UI metadata for skill selectors. Source: **Codex** (lives in sibling file `agents/openai.yaml`, not `SKILL.md` frontmatter). Verified against the official `openai/skills` skill-creator example (https://github.com/openai/skills/blob/main/skills/.system/skill-creator/agents/openai.yaml, verified 2026-05-21). Additional keys mentioned by Codex documentation (`interface.icons`, `interface.brand_color`, `policy.*`, `dependencies.*`) are NOT included in canonical until foundation change re-verifies them — they may be deprecated, may require additional schema research, or may have been hallucinated by upstream documentation summarization.
  - Gemini contributes no additional optional fields beyond the required `name` and `description` (規範未明示 — the Gemini documentation does not surface further frontmatter fields).
  - **Sources**: Anthropic https://code.claude.com/docs/en/skills.md; Codex https://developers.openai.com/codex/skills; Gemini https://geminicli.com/docs/cli/skills/ + https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/creating-skills.md (all verified 2026-05-21).

#### Scenario: Lookup canonical-to-agent field mapping

- **WHEN** a reader needs to know how a canonical field maps to a specific agent's output
- **THEN** for each covered agent, the spec SHALL provide a mapping table or equivalent listing showing canonical field name → agent-side field name (including same-name fields as identity mappings, renames, and ignored-on-agent fields)

**Canonical → Anthropic Claude (`.claude/skills/<name>/SKILL.md` frontmatter; kebab-case convention):**

| Canonical field | Anthropic field | Note |
|---|---|---|
| `name` | `name` | identity |
| `description` | `description` | identity |
| `agents` | — | Glyphic-specific; ignored (not rendered into Anthropic output) |
| `when_to_use` | `when_to_use` | identity |
| `argument_hint` | `argument-hint` | rename (snake → kebab) |
| `arguments` | `arguments` | identity |
| `disable_model_invocation` | `disable-model-invocation` | rename |
| `user_invocable` | `user-invocable` | rename |
| `allowed_tools` | `allowed-tools` | rename |
| `model` | `model` | identity |
| `effort` | `effort` | identity |
| `context` | `context` | identity |
| `subagent` | `agent` | rename |
| `hooks` | `hooks` | identity |
| `paths` | `paths` | identity |
| `shell` | `shell` | identity |
| `interface.*`, `allow_implicit_invocation` | — | ignored (Codex-specific) |

Source: https://code.claude.com/docs/en/skills.md (verified 2026-05-21)

**Canonical → OpenAI Codex (`.agents/skills/<name>/SKILL.md` frontmatter + sibling `agents/openai.yaml`):**

| Canonical field | Codex destination | Note |
|---|---|---|
| `name` | `SKILL.md` frontmatter `name` | identity |
| `description` | `SKILL.md` frontmatter `description` | identity |
| `agents` | — | Glyphic-specific; ignored |
| `interface.display_name` | `agents/openai.yaml` `interface.display_name` | identity; rendered into sibling file (split rendering) |
| `interface.short_description` | `agents/openai.yaml` `interface.short_description` | identity; sibling file |
| `interface.default_prompt` | `agents/openai.yaml` `interface.default_prompt` | identity; sibling file |
| `allowed_tools`, `when_to_use`, `argument_hint`, `arguments`, `disable_model_invocation`, `user_invocable`, `model`, `effort`, `context`, `subagent`, `hooks`, `paths`, `shell` | — | ignored (Anthropic-specific or 規範未明示 in current Codex docs; foundation change to re-verify) |

Source: https://developers.openai.com/codex/skills (verified 2026-05-21)

**Canonical → Google Gemini (`.gemini/skills/<name>/SKILL.md` or `.agents/skills/<name>/SKILL.md` frontmatter):**

| Canonical field | Gemini field | Note |
|---|---|---|
| `name` | `name` | identity |
| `description` | `description` | identity |
| `agents` | — | Glyphic-specific; ignored |
| All other canonical optional fields | — | ignored (規範未明示 — Gemini documentation does not surface further frontmatter fields beyond required) |

Source: https://geminicli.com/docs/cli/skills/, https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/creating-skills.md (verified 2026-05-21)


<!-- @trace
source: agent-skills-schema-reference
updated: 2026-05-21
code:
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/hook.rs
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - screenshots/hooks.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/router.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/i18n/index.ts
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/utils/format.ts
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/stores/project-context.svelte.ts
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/hooks/HooksPage.svelte
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - screenshots/instructions.png
  - .session/product-backlog.md
  - screenshots/git.png
  - CONTRIBUTING.md
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/git/GitPage.svelte
  - src-tauri/src/ctx/mod.rs
  - SECURITY.md
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/pty.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/types/index.ts
  - src/lib/components/dashboard/StatsOverview.tsx
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/commands/keybindings.rs
  - src-tauri/src/filter/pipeline.rs
  - src/App.tsx
  - src/App.svelte
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src-tauri/src/tokens/types.rs
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/Cargo.toml
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/ctx/db.rs
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - CHANGELOG.md
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src-tauri/src/paths.rs
  - CODE_OF_CONDUCT.md
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - screenshots/mcp.png
  - screenshots/plugins.png
  - src/lib/components/layout/Header.tsx
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - package.json
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - README.md
  - screenshots/analytics.png
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src/lib/components/hooks/HookHandlerForm.svelte
  - screenshots/dashboard.png
  - src/lib/components/layout/UpdateBanner.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/terminal.png
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - screenshots/rules.png
  - src/lib/stores/terminal.svelte.ts
  - src-tauri/src/ctx/config.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/settings/PermissionsEditor.svelte
  - RELEASE_NOTES.md
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/stores/navigation.ts
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src-tauri/src/lib.rs
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/pricing.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/filter/mod.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
-->

---
### Requirement: Agent-Scoped Field Catalog Reference

The reference SHALL define an agent-scoped skill field catalog for the supported CLI targets: Claude Code, Codex, and Gemini CLI. Each field definition SHALL include the target agent, canonical storage namespace, canonical key, output file location, output field key, value type, enum values when applicable, source URL, and verified date. The reference SHALL NOT include Claude.ai web upload fields or non-CLI product fields in this catalog.

#### Scenario: Lookup fields for one CLI target

- **WHEN** a reader looks up field definitions for `codex`
- **THEN** the reference SHALL list Codex `SKILL.md` fields separately from `agents/openai.yaml` metadata fields
- **AND** each Codex metadata field SHALL identify `agents/openai.yaml` as its output location

#### Scenario: Catalog excludes non-CLI products

- **WHEN** a reader looks up Claude fields in this project reference
- **THEN** the reference SHALL describe Claude Code fields only
- **AND** the reference SHALL NOT include Claude.ai upload-only fields in the Claude Code catalog

#### Scenario: Catalog carries verification metadata

- **WHEN** a reader inspects any field entry
- **THEN** the entry SHALL include the source documentation URL and a `verified YYYY-MM-DD` date
- **AND** stale verification dates SHALL indicate that maintainers need to re-check the vendor documentation before adding or changing fields

<!-- @trace source: agent-scoped-skill-fields updated: 2026-05-28 -->


<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->

---
### Requirement: Agent-Scoped Canonical Mapping

The reference SHALL describe how canonical agent-scoped field namespaces map to target outputs. The `anthropic` namespace SHALL map only to Claude Code `SKILL.md` frontmatter fields. The `codex` namespace SHALL map Codex UI, policy, and dependency metadata to `agents/openai.yaml` and SHALL keep Codex `SKILL.md` limited to `name` and `description`. The `gemini` namespace SHALL map only documented Gemini CLI fields; until Gemini CLI documents additional fields, Gemini fan-out SHALL emit only `name` and `description`. The `standard` namespace SHALL represent Agent Skills open-standard fields, and renderers SHALL emit those fields only when the target implementation explicitly supports them.

#### Scenario: Map scoped canonical data to target files

- **WHEN** canonical frontmatter contains `anthropic.allowed-tools`, `codex.interface.display_name`, and `standard.license`
- **THEN** the Claude Code mapping SHALL route `anthropic.allowed-tools` to Claude Code `SKILL.md`
- **AND** the Codex mapping SHALL route `codex.interface.display_name` to Codex `agents/openai.yaml`
- **AND** the Gemini CLI mapping SHALL ignore both agent-specific fields unless Gemini CLI has matching documented support

##### Example: scoped field routing

| Canonical field | Claude Code output | Codex output | Gemini CLI output |
| ----- | ----- | ----- | ----- |
| `anthropic.allowed-tools` | `SKILL.md` frontmatter `allowed-tools` | ignored | ignored |
| `codex.interface.display_name` | ignored | `agents/openai.yaml` `interface.display_name` | ignored |
| `standard.license` | emitted only if supported by the target catalog | emitted only if supported by the target catalog | emitted only if supported by the target catalog |

<!-- @trace source: agent-scoped-skill-fields updated: 2026-05-28 -->


<!-- @trace
source: agent-scoped-skill-fields
updated: 2026-05-28
code:
  - src-tauri/src/tokens/storage.rs
  - src/lib/components/tokens/components/DataResolutionPanel.tsx
  - src/lib/components/projects/managed-inventory.ts
  - src-tauri/src/tokens/types.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/tokens/tokscale.rs
  - src-tauri/src/tokens/tokscale_ingestion.rs
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src/lib/components/tokens/components/ContributionGraph.tsx
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/stores/theme.ts
  - src/lib/components/tokens/components/TokensPageSkeleton.tsx
  - src/app.css
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/types/skills.ts
  - src-tauri/src/commands/budget.rs
  - src-tauri/src/commands/fan_out/codex.rs
  - src-tauri/src/tokens/aggregator.rs
  - .gitattributes
  - src/lib/components/tokens/components/DayDetailPanel.tsx
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/design-backlog.md
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/settings/SavedKnownProjectsSection.tsx
  - src/lib/components/skills/PendingPushBar.tsx
  - src/lib/components/history/HistoryPage.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
  - src-tauri/src/commands/fan_out/gemini.rs
  - src/lib/components/memory/MemoryPage.tsx
  - src/lib/components/skills/AddTargetDialog.tsx
  - .session/product-backlog.md
  - src-tauri/gen/schemas/macOS-schema.json
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - src/lib/i18n/locales/en.ts
  - src/lib/components/skills/SkillList.tsx
  - src-tauri/src/commands/mod.rs
  - src/lib/components/projects/ProjectsList.tsx
  - .knowledge/_catalog.json
  - src-tauri/src/lib.rs
  - src/lib/components/settings/FelinaSettingsPage.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/utils/path.ts
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/tokens/TokensPage.tsx
  - src-tauri/src/tokens/ccusage.rs
  - src-tauri/src/commands/agent_paths.rs
  - src-tauri/src/commands/canonical_skills.rs
  - src-tauri/src/commands/fan_out/anthropic.rs
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/tokens/components/TimeBucketTable.tsx
  - src/lib/components/skills/SkillEditor.tsx
  - src-tauri/src/commands/known_projects.rs
  - src/lib/components/instructions/InstructionsPage.tsx
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/paths.rs
  - src-tauri/src/commands/skill_fields.rs
  - src/lib/components/settings/SettingsPage.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/router.tsx
  - src/lib/tauri/commands.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - .session/agent-capability-research.md
  - src/lib/types/index.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - src/lib/components/skills/import-conflict-warning.ts
  - src/lib/components/skills/AgentFieldsEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/tokens/components/TopSessionsCard.tsx
  - src/lib/components/layout/Sidebar.tsx
tests:
  - tests/skill-import-conflict-warning.test.ts
-->

---
### Requirement: Extension Template for New Agents

The reference SHALL provide a template describing how to add a fourth (or later) agent vendor to the spec without restructuring the existing per-agent Requirements. The template MUST list the steps to add a new Requirement, the scenarios it must contain, and the source-citation policy.

#### Scenario: Adding a fourth agent

- **WHEN** a future contributor needs to add a new agent vendor to the reference
- **THEN** the spec SHALL provide an Extension Template section listing the steps to follow
  - **Step 1 — Copy a Requirement block as a template.** Duplicate an existing per-agent Requirement block (for example, the **Requirement: Anthropic Claude Skills Format** block, including all its scenarios) as the structural starting point.
  - **Step 2 — Rename the Requirement.** Rename it to follow the naming convention `<AgentVendor> <ProductName> Skills Format` (see naming examples below).
  - **Step 3 — Fill the applicable branch.** If the new agent has a dedicated skill system, fill the `<agent> skill system exists` scenario; otherwise fill the `<agent> has no skill system` scenario, describing the closest equivalent surface and the Glyphic fan-out rendering strategy. Mark the unused scenario `(not applicable: ...)` and keep it in the file (do not delete) so the branch is preserved for future vendor changes.
  - **Step 4 — Update the prologue inventory.** Append the new vendor to the **Spec Prologue**'s bulleted "Covered agent vendors" list.
  - **Step 5 — Extend the canonical mapping.** Add a new mapping table for the new agent under the **Canonical-to-agent field mapping** scenario in the **Canonical Schema Definition** Requirement.
- **AND** the template SHALL specify the Requirement naming convention `<AgentVendor> <ProductName> Skills Format`
  - **Existing examples** (already in this spec): `Anthropic Claude Skills Format`, `OpenAI Codex Skills Format`, `Google Gemini Skills Format`.
  - **Hypothetical fourth-vendor examples**: `Microsoft Copilot CLI Skills Format`, `Cursor IDE Skills Format`, `Continue Skills Format`.
- **AND** the template SHALL specify the minimum set of scenarios the new Requirement must contain (discovery location, frontmatter schema, load mechanism, plus the absence-of-skills branch when applicable)
  - **Minimum scenarios when skills exist** (mirroring the Anthropic Requirement shape):
    - `Lookup <agent> skill discovery paths` — discovery paths (global + project), directory layout, primary file naming convention.
    - `Lookup <agent> frontmatter schema` — required fields, optional fields with types, body format.
    - `Lookup <agent> load mechanism` — load mechanism (model-invoked / always-loaded / explicit), bundled-file support.
  - **Absence-of-skills branch**: include a `<agent> has no skill system` scenario annotated `(not applicable: ...)` even when skills exist, so the absence branch is explicitly documented and easy to flip if a future release removes the feature.
- **AND** the template SHALL specify that every documented fact must be annotated with a source URL and `verified YYYY-MM-DD` date
  - Every concrete fact (path, field name, type, mechanism description) MUST be followed by its source URL (specific documentation page, not vendor home page) and a `verified YYYY-MM-DD` date matching when the fact was last confirmed against the live documentation. Stale dates are a signal to re-verify, not to delete.

<!-- @trace
source: agent-skills-schema-reference
updated: 2026-05-21
code:
  - src/lib/components/layout/Header.svelte
  - src-tauri/src/filter/builtin.rs
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src-tauri/src/ctx/hook.rs
  - src-tauri/src/tokens/parsers/gemini_cli.rs
  - src/lib/components/pipelines/nodes/BashNode.svelte
  - src/lib/components/shared/CommandPalette.tsx
  - screenshots/hooks.png
  - src/lib/components/dashboard/ActivityHeatmap.svelte
  - src/router.tsx
  - src/lib/components/tokens/components/LanguageSwitcher.tsx
  - src/lib/components/pipelines/nodes/BaseNode.svelte
  - src/lib/components/dashboard/StreakCard.svelte
  - src/lib/components/instructions/InstructionsPage.svelte
  - src/lib/i18n/index.ts
  - src-tauri/gen/schemas/windows-schema.json
  - src/lib/components/templates/TemplatesPage.svelte
  - src/lib/utils/format.ts
  - src/lib/components/pipelines/nodes/WriteFileNode.svelte
  - src/lib/stores/project-context.svelte.ts
  - src/lib/components/dashboard/DashboardPage.svelte
  - src/lib/stores/theme.svelte.ts
  - src/lib/components/hooks/HooksPage.svelte
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/tokens/parsers/mod.rs
  - src/lib/components/plugins/PluginsPage.svelte
  - src/lib/components/pipelines/PipelinesPage.tsx
  - src-tauri/src/ctx/embed.rs
  - src/lib/components/git/GitPage.tsx
  - src/lib/components/pipelines/nodes/NotificationNode.svelte
  - src/lib/components/pipelines/nodes/GithubNode.svelte
  - screenshots/instructions.png
  - .session/product-backlog.md
  - screenshots/git.png
  - CONTRIBUTING.md
  - src-tauri/src/tokens/parsers/codex_cli.rs
  - src/lib/components/git/GitPage.svelte
  - src-tauri/src/ctx/mod.rs
  - SECURITY.md
  - src-tauri/src/tokens/scanner.rs
  - src/lib/components/context-engine/ContextEnginePage.svelte
  - src/lib/components/dashboard/AchievementGrid.tsx
  - src-tauri/src/commands/plugins.rs
  - src/lib/components/dashboard/ConfigCompletenessRing.tsx
  - src/lib/components/dashboard/DashboardPage.tsx
  - src/lib/components/layout/Sidebar.tsx
  - src-tauri/src/commands/git.rs
  - src-tauri/src/pty.rs
  - src/lib/components/memory/MemoryPage.svelte
  - src/lib/components/pipelines/PipelinesPage.svelte
  - src/lib/components/analytics/AnalyticsPage.svelte
  - src/lib/components/dashboard/ConfigCompletenessRing.svelte
  - src/lib/components/pipelines/nodes/HttpNode.svelte
  - src/lib/components/sessions/SessionMonitor.tsx
  - src-tauri/src/bin/glyphic_filter.rs
  - src/lib/components/dashboard/ActivityHeatmap.tsx
  - src/lib/components/tokens/TokensPage.tsx
  - src/lib/components/tokens/components/DateRangeFilter.tsx
  - src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - src/lib/components/pipelines/nodes/GitNode.svelte
  - src/lib/components/settings/GeneralSettings.svelte
  - src/lib/components/terminal/TerminalPage.tsx
  - src-tauri/src/tokens/aggregator.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src/lib/types/index.ts
  - src/lib/components/dashboard/StatsOverview.tsx
  - src/lib/components/sessions/SessionsPage.svelte
  - src/lib/components/shared/OnboardingWelcome.svelte
  - src/lib/components/hooks/HookCard.svelte
  - src/lib/components/pipelines/nodes/OutputNode.svelte
  - src-tauri/src/commands/keybindings.rs
  - src-tauri/src/filter/pipeline.rs
  - src/App.tsx
  - src/App.svelte
  - src/lib/components/pipelines/nodes/TransformNode.svelte
  - src/lib/components/plugins/PluginsPage.tsx
  - src-tauri/src/tokens/types.rs
  - src/lib/components/rules/RulesPage.svelte
  - src/lib/stores/pipeline-execution.ts
  - src-tauri/Cargo.toml
  - svelte.config.js
  - src-tauri/src/tokens/storage.rs
  - src-tauri/src/ctx/db.rs
  - src/lib/components/pipelines/nodes/FilterNode.svelte
  - CHANGELOG.md
  - src/lib/components/tokens/components/CostBudgetCard.tsx
  - src/lib/components/layout/Sidebar.svelte
  - src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - src-tauri/src/paths.rs
  - CODE_OF_CONDUCT.md
  - src-tauri/src/tokens/mod.rs
  - src/lib/components/keybindings/KeybindingsPage.svelte
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/i18n/locales/en.ts
  - screenshots/mcp.png
  - screenshots/plugins.png
  - src/lib/components/layout/Header.tsx
  - src/lib/components/pipelines/nodes/JsonExtractNode.svelte
  - src/lib/components/dashboard/StatsOverview.svelte
  - package.json
  - src-tauri/src/filter/tracker.rs
  - src/lib/components/pipelines/nodes/ClaudeNode.svelte
  - src/lib/components/pipelines/nodes/DelayNode.svelte
  - src/lib/stores/locale.ts
  - src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - src/lib/components/shared/ConfirmDialog.svelte
  - src/lib/components/tokens/components/AgentDistribution.tsx
  - src/lib/components/pipelines/nodes/InputNode.svelte
  - README.md
  - screenshots/analytics.png
  - src/lib/components/analytics/AnalyticsPage.tsx
  - src/lib/components/tokens/components/RefreshButton.tsx
  - src-tauri/src/ctx/virtualize.rs
  - src/lib/components/hooks/HookHandlerForm.svelte
  - screenshots/dashboard.png
  - src/lib/components/layout/UpdateBanner.svelte
  - src/lib/components/skills/SkillsPage.svelte
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/ctx/retrieve.rs
  - src/lib/components/terminal/TerminalPage.svelte
  - screenshots/terminal.png
  - src/lib/components/token-savings/TokenSavingsPage.svelte
  - src-tauri/src/commands/sessions.rs
  - src/lib/components/tokens/components/GranularityPicker.tsx
  - src/lib/components/shared/ProjectPicker.svelte
  - src/lib/components/tokens/components/HourlyHeatmap.tsx
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/tokens.rs
  - src/lib/components/keybindings/KeybindingsPage.tsx
  - src/lib/components/shared/PageLoader.tsx
  - src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/components/dashboard/StreakCard.tsx
  - src/lib/components/token-savings/TokenSavingsPage.tsx
  - src/lib/components/sessions/SessionsPage.tsx
  - src/lib/components/tokens/components/AgentStatusPanel.tsx
  - screenshots/rules.png
  - src/lib/stores/terminal.svelte.ts
  - src-tauri/src/ctx/config.rs
  - src/lib/tauri/commands.ts
  - src/lib/components/sessions/SessionMonitor.svelte
  - src/lib/components/settings/EnvVarsEditor.svelte
  - src/lib/components/pipelines/nodes/ReadFileNode.svelte
  - src/lib/components/tokens/components/TokenStatCards.tsx
  - src/lib/components/settings/PermissionsEditor.svelte
  - RELEASE_NOTES.md
  - src/lib/components/layout/ContextGauge.svelte
  - src/lib/components/shared/TemplateGallery.svelte
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/tokens/parsers/claude_code.rs
  - src/lib/components/mcp/McpPage.svelte
  - src/lib/stores/navigation.ts
  - src/lib/components/tokens/components/TokenTimeSeries.tsx
  - src/lib/components/settings/SettingsPage.svelte
  - src-tauri/src/lib.rs
  - src/lib/components/pipelines/PipelineCanvas.svelte
  - src/lib/stores/terminal.ts
  - src/lib/components/pipelines/CodeEditor.svelte
  - src/lib/components/dashboard/AchievementGrid.svelte
  - src/lib/components/hooks/HookEditor.svelte
  - src-tauri/src/tokens/pricing.rs
  - src/lib/types/token-analytics.ts
  - src-tauri/src/filter/mod.rs
  - src/lib/components/shared/CommandPalette.svelte
  - src/lib/components/context-engine/ContextEnginePage.tsx
-->