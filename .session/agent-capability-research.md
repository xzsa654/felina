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

### Skill YAML / metadata fields

Verified on 2026-05-26 for CLI targets only: Claude Code, Codex, and Gemini
CLI. Do not mix these findings with Claude.ai web skill upload behavior or
other hosted product surfaces.

#### Portable Agent Skills baseline

The Agent Skills open specification defines the portable `SKILL.md` baseline:

| Field | Required | Type / constraints | Notes |
|---|---:|---|---|
| `name` | Yes | string; max 64 chars; lowercase letters, numbers, hyphens; must not start/end with hyphen | Must match the parent directory name in the open spec. |
| `description` | Yes | string; max 1024 chars; non-empty | Describes what the skill does and when to use it. |
| `license` | No | string | License name or bundled license-file reference. |
| `compatibility` | No | string; max 500 chars | Environment/product requirements. |
| `metadata` | No | mapping | Arbitrary key-value metadata for clients. |
| `allowed-tools` | No | string | Experimental pre-approved tool list; support varies by implementation. |

Felina should treat this as the portable baseline, not as proof that every
target CLI supports every optional baseline field.

#### Claude Code `SKILL.md` frontmatter

Claude Code configures skills through YAML frontmatter at the top of
`SKILL.md`. Claude Code docs state that all fields are optional and that
`description` is recommended; Felina can still require canonical `name` and
`description` for cross-agent consistency.

| Field | Required by Claude Code | Type / allowed values | Purpose / behavior |
|---|---:|---|---|
| `name` | No | string; lowercase letters, numbers, hyphens; max 64 chars | Display/invocation name. If omitted, Claude Code uses the directory name. |
| `description` | Recommended | string | What the skill does and when to use it. Used for model invocation discovery. |
| `when_to_use` | No | string | Additional invocation context; appended to `description` in the skill listing. |
| `argument-hint` | No | string | Autocomplete hint for expected arguments, such as `[issue-number]`. |
| `arguments` | No | string or YAML list | Named positional arguments for `$name` substitution in skill content. |
| `disable-model-invocation` | No | boolean | `true` prevents Claude from automatically loading the skill; user invocation still works. |
| `user-invocable` | No | boolean | `false` hides the skill from the slash menu; Claude can still invoke when relevant. |
| `allowed-tools` | No | string or YAML list | Tools Claude can use without asking permission while the skill is active. This pre-approves listed tools; it does not deny unlisted tools by itself. |
| `model` | No | string | Model override for the current turn; accepts `/model` values or `inherit`. |
| `effort` | No | enum | `low`, `medium`, `high`, `xhigh`, `max`; available levels depend on model. |
| `context` | No | enum | `fork` runs the skill in a forked subagent context. |
| `agent` | No | string | Subagent type used when `context: fork` is set. |
| `hooks` | No | object | Skill-scoped lifecycle hooks; format follows Claude Code hooks docs. |
| `paths` | No | string or YAML list | Glob patterns limiting automatic activation to matching file work. |
| `shell` | No | enum | `bash` or `powershell`; controls dynamic command blocks in skill content. PowerShell requires `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`. |

Claude Code body behavior:

- Body is Markdown after the YAML frontmatter.
- Skills can be invoked by the model or explicitly by the user unless
  frontmatter restricts one side.
- Skills support dynamic substitutions such as `$ARGUMENTS`,
  `$ARGUMENTS[N]`, `$N`, named `$argument`, `${CLAUDE_SESSION_ID}`,
  `${CLAUDE_EFFORT}`, and `${CLAUDE_SKILL_DIR}`.
- `allowed-tools` is supported by Claude Code CLI directly. Claude Agent SDK
  docs explicitly say that this frontmatter field does not apply when using
  Skills through the SDK; SDK tool access is controlled by SDK options.

Felina mapping notes:

- Store Claude Code-only fields under a Claude/Anthropic namespace, not in a
  shared flat extras map.
- Preserve Claude's kebab-case output names where Claude Code expects them,
  such as `allowed-tools`, `argument-hint`, `disable-model-invocation`, and
  `user-invocable`.
- Do not emit Claude Code-only fields to Codex or Gemini CLI outputs.

#### Codex `SKILL.md` frontmatter and `agents/openai.yaml`

Codex uses the Agent Skills structure, but its docs state that Codex reads only
`name` and `description` from `SKILL.md` to decide when the skill gets used.
Codex UI metadata, invocation policy, and tool dependencies live in a sibling
`agents/openai.yaml` file.

Codex `SKILL.md` frontmatter:

| Field | Required | Type / constraints | Purpose / behavior |
|---|---:|---|---|
| `name` | Yes | string | Skill name used by Codex. |
| `description` | Yes | string | Primary trigger text; Codex reads this to determine when to use the skill. |

Codex `agents/openai.yaml` fields documented by OpenAI:

| YAML path | Required | Type / shape | Purpose / behavior |
|---|---:|---|---|
| `interface.display_name` | No | string | Optional user-facing name shown in Codex app UI. |
| `interface.short_description` | No | string | Optional user-facing summary for skill lists/chips. |
| `interface.icon_small` | No | string path | Optional small icon path, for example `./assets/small-logo.svg`. |
| `interface.icon_large` | No | string path | Optional large icon path, for example `./assets/large-logo.png`. |
| `interface.brand_color` | No | string | Optional brand color, for example `#3B82F6`. |
| `interface.default_prompt` | No | string | Optional surrounding prompt to use with the skill. |
| `policy.allow_implicit_invocation` | No | boolean; default `true` | When `false`, Codex will not implicitly invoke the skill from prompt matching; explicit `$skill` invocation still works. |
| `dependencies.tools` | No | array of tool dependency objects | Declares tool dependencies for a smoother user experience. Documented example uses MCP fields. |
| `dependencies.tools[].type` | No | string | Tool dependency kind, documented example: `mcp`. |
| `dependencies.tools[].value` | No | string | Tool identifier, documented example: `openaiDeveloperDocs`. |
| `dependencies.tools[].description` | No | string | Human-readable dependency description. |
| `dependencies.tools[].transport` | No | string | MCP transport, documented example: `streamable_http`. |
| `dependencies.tools[].url` | No | string URL | MCP server URL, documented example: `https://developers.openai.com/mcp`. |

Felina mapping notes:

- Codex `SKILL.md` output should remain limited to `name` and `description`.
- Codex-specific UI/policy/dependency data should be stored under a Codex
  namespace and rendered to `agents/openai.yaml`, not to `SKILL.md`
  frontmatter.
- Do not emit Claude Code fields such as `allowed-tools`, `effort`, `paths`,
  or `shell` into Codex `SKILL.md` or `agents/openai.yaml`.

#### Gemini CLI `SKILL.md` frontmatter

Gemini CLI supports Agent Skills and discovers them from `.gemini/skills/` and
the interoperable `.agents/skills/` alias. Current Gemini CLI docs and examples
only document `name` and `description` as skill metadata/frontmatter fields for
skills.

| Field | Required by Gemini CLI docs | Type / constraints | Purpose / behavior |
|---|---:|---|---|
| `name` | Yes | string | Skill identifier. Gemini docs state the skill name comes from the `name` field, not the directory name; invalid filename characters are replaced with `-` in display/discovery behavior. |
| `description` | Yes | string | Trigger text used by Gemini CLI to decide when to activate the skill. |

Gemini CLI discovery and validation notes:

- `SKILL.md` must be the exact filename.
- Frontmatter must be the first thing in the file.
- A skill is skipped if `name` or `description` is missing, if delimiters are
  absent, or if text appears before the opening `---`.
- Gemini CLI discovers skills in `.gemini/skills/` and `.agents/skills/`.
- The recommended directory layout can include `scripts/`, `references/`, and
  `assets/`, but the documented metadata fields remain `name` and
  `description`.

Felina mapping notes:

- Gemini CLI output should contain only fields documented for Gemini CLI.
- Do not invent Gemini-specific optional fields based on Claude Code or Codex
  behavior.
- Preserve unknown canonical data, but do not emit it to Gemini CLI output
  until Gemini CLI documentation defines support for that field.

#### Practical Felina schema implication

The three CLI targets do not share a safe flat optional-field namespace. Felina
should model optional skill metadata as agent-scoped data:

```yaml
name: example-skill
description: Use when ...
agents:
  - anthropic
  - codex
  - gemini
x_felina_agent_fields:
  anthropic:
    allowed-tools: Read Grep
    effort: high
  codex:
    interface:
      display_name: Example Skill
      short_description: Short UI text
      default_prompt: Use this skill to ...
    policy:
      allow_implicit_invocation: false
    dependencies:
      tools:
        - type: mcp
          value: openaiDeveloperDocs
          description: OpenAI Docs MCP server
          transport: streamable_http
          url: https://developers.openai.com/mcp
  gemini: {}
  standard:
    license: MIT
    compatibility: Requires git
    metadata:
      owner: platform
```

Push/fan-out should treat the backend renderer as the final allowlist:

- Claude Code target: emit only Claude Code-supported `SKILL.md`
  frontmatter fields.
- Codex target: emit `name` and `description` to `SKILL.md`, and Codex
  metadata to `agents/openai.yaml`.
- Gemini CLI target: emit only `name` and `description` unless a future
  verified Gemini CLI doc adds more fields.
- Unknown fields: preserve in canonical storage, but do not emit to any target
  without an explicit catalog entry.

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
- Codex skills: https://developers.openai.com/codex/skills
- OpenAI skills catalog / examples: https://github.com/openai/skills
- Agent Skills specification: https://agentskills.io/specification
- Claude Code skills: https://docs.claude.com/en/docs/claude-code/skills
- Claude Code SDK skills note: https://code.claude.com/docs/en/agent-sdk/skills
- Gemini settings: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/settings.md
- Gemini configuration: https://github.com/google-gemini/gemini-cli/blob/main/docs/reference/configuration.md
- Gemini hooks: https://geminicli.com/docs/hooks/reference/
- Gemini subagents: https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md
- Gemini CLI skills: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/skills.md
- Gemini CLI creating skills: https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/creating-skills.md
