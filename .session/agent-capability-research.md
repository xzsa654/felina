# Agent Capability Research

Purpose: durable research notes for future UI tabs that compare Claude Code,
Codex CLI, and Gemini CLI configuration surfaces. This is not project policy;
verify current vendor docs before implementing behavior that writes agent
configuration.

## Summary

| Claude Code concept | Codex CLI equivalent | Gemini CLI equivalent |
|---|---|---|
| `CLAUDE.md` | `AGENTS.md` / `AGENTS.override.md`; can add fallback names via config | `GEMINI.md`; can configure context file names |
| `settings.json` | `~/.codex/config.toml` / `.codex/config.toml` | `~/.gemini/settings.json` / `.gemini/settings.json` |
| `hooks/` | Hooks via `hooks.json` or inline `[hooks]` in `config.toml`; no fixed `hooks/` directory requirement | Hooks in `settings.json` under `hooks`; CLI has `gemini hooks` |
| `subagents/` | `.codex/agents/*.toml` / `~/.codex/agents/*.toml` | `.gemini/agents/*.md` / `~/.gemini/agents/*.md` |

## Findings

### Context files

Claude Code uses `CLAUDE.md` as its project guidance file.

Codex CLI does not use `CLAUDE.md` as its default project guidance file. It
uses `AGENTS.md` and `AGENTS.override.md`. Discovery layers global guidance
from `~/.codex/AGENTS.md` or `~/.codex/AGENTS.override.md` with project-level
files from the repository root down to the current working directory. Codex can
be configured to consider extra names through `project_doc_fallback_filenames`.

Gemini CLI does not use `CLAUDE.md` as its default project guidance file. It
uses `GEMINI.md` as memory/context guidance. Gemini configuration supports
context discovery settings, including configurable context file names.

### Settings

Codex CLI stores configuration in TOML, not JSON:

- User: `~/.codex/config.toml`
- Project: `.codex/config.toml` in trusted projects

Gemini CLI stores settings in JSON:

- User: `~/.gemini/settings.json`
- Workspace: `.gemini/settings.json`

Workspace settings override user settings.

### Hooks

Codex CLI supports lifecycle hooks. Hooks can be configured through
`hooks.json` files or inline `[hooks]` tables in `config.toml`. Documented event
names include:

- `SessionStart`
- `PreToolUse`
- `PermissionRequest`
- `PostToolUse`
- `PreCompact`
- `PostCompact`
- `SubagentStart`
- `SubagentStop`
- `UserPromptSubmit`
- `Stop`

Gemini CLI supports lifecycle hooks through the `hooks` object in
`settings.json`. Documented event groups include:

- `BeforeTool`
- `AfterTool`
- `BeforeAgent`
- `AfterAgent`
- `Notification`
- `SessionStart`

Gemini CLI also exposes a `gemini hooks` management command.

### Subagents

Codex CLI supports subagents. Custom agents are TOML files:

- Project: `.codex/agents/*.toml`
- User: `~/.codex/agents/*.toml`

Codex subagent config can include normal agent session settings such as model,
sandbox, developer instructions, MCP servers, and skill settings.

Gemini CLI supports subagents. Custom agents are Markdown files with YAML
frontmatter:

- Project: `.gemini/agents/*.md`
- User: `~/.gemini/agents/*.md`

Gemini subagents are exposed to the main agent as tools. The Markdown body is
the agent system prompt, and frontmatter defines metadata such as `name`,
`description`, `kind`, `tools`, `model`, and limits.

## Local CLI Observations

Observed on this machine:

- `codex --help` includes `mcp`, `plugin`, `mcp-server`, `features`, and related
  configuration commands.
- `codex mcp list` initially reported no configured MCP servers; Context7 was
  later added to `~/.codex/config.toml`.
- `gemini --help` includes `gemini mcp`, `gemini extensions`, `gemini skills`,
  and `gemini hooks`.

## Implementation Notes For Future Tabs

- Do not model all agents as if they share Claude Code's filenames.
- Treat context files, settings, hooks, skills, and subagents as per-agent
  capability adapters.
- Prefer reading each agent's native source of truth:
  - Claude Code: `CLAUDE.md`, Claude settings, `.claude/skills`, `.claude/agents`
  - Codex CLI: `AGENTS.md`, `.codex/config.toml`, `.codex/agents/*.toml`
  - Gemini CLI: `GEMINI.md`, `.gemini/settings.json`, `.gemini/agents/*.md`
- Keep mutable session state and handoff details out of global guidance files.
- Before writing config, detect whether the target is user-level or
  project-level and whether project-level config is trusted/supported by that
  agent.

## Sources Checked

- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex config: https://developers.openai.com/codex/config-basic
- Codex config reference: https://developers.openai.com/codex/config-reference
- Codex hooks: https://developers.openai.com/codex/hooks
- Codex MCP: https://developers.openai.com/codex/mcp
- Codex subagents: https://developers.openai.com/codex/subagents
- Gemini settings: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/settings.md
- Gemini configuration: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md
- Gemini hooks: https://geminicli.com/docs/hooks/reference/
- Gemini subagents: https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md
