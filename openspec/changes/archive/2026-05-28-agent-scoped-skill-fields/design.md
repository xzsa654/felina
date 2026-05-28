## Context

Felina currently stores advanced skill frontmatter extras as one flat map, and
the SkillEditor exposes those extras as free-form key/value rows. That shape is
not precise enough for Claude Code, Codex, and Gemini CLI because their
supported skill metadata differs:

- Claude Code supports many `SKILL.md` frontmatter fields.
- Codex reads only `name` and `description` from `SKILL.md`, while UI metadata,
  invocation policy, and tool dependencies live in `agents/openai.yaml`.
- Gemini CLI currently documents only `name` and `description` for skill
  frontmatter.

Existing project knowledge confirms that `~/.felina/skills/` is the canonical
source of truth and agent-native directories are fan-out outputs. This design
keeps that boundary: canonical storage can preserve fields for multiple
agents, but each target renderer is responsible for emitting only fields that
belong to that target.

Reusable local surfaces:

- `src/lib/components/skills/SkillEditor.tsx`: current visual frontmatter form
  and Advanced extras UI.
- `src/lib/components/skills/SkillsPage.tsx`: save, selection, and push flow.
- `src/lib/components/skills/TargetEditor.tsx`: per-skill target state used to
  filter available fields.
- `src/lib/types/skills.ts`: frontend skill data contracts.
- `src/lib/tauri/commands.ts`: typed frontend command wrappers.
- `src-tauri/src/commands/canonical_skills.rs`: canonical parse/serialize and
  `frontmatter_extras` behavior.
- `src-tauri/src/commands/skill_import.rs`: source-agent import parsing.
- `src-tauri/src/commands/fan_out/anthropic.rs`: Claude Code output renderer.
- `src-tauri/src/commands/fan_out/codex.rs`: Codex `SKILL.md` and
  `agents/openai.yaml` renderer.
- `src-tauri/src/commands/fan_out/gemini.rs`: Gemini CLI output renderer.

## Goals / Non-Goals

**Goals:**

- Replace free-form Advanced extras with a target-filtered field picker.
- Store optional metadata in agent-scoped canonical buckets.
- Keep backend catalog and renderer allowlists authoritative.
- Preserve existing flat extras and migrate known fields on structured save.
- Prevent Claude Code, Codex, and Gemini CLI fields from leaking into the wrong
  target output.
- Keep the implementation local-only with no remote schema fetch.

**Non-Goals:**

- Support Claude.ai web skill upload fields.
- Add automatic vendor documentation refresh.
- Delete unknown canonical fields automatically.
- Change skill identity, target sidecar schema, or fan-out destination routing.
- Implement target fork overlays, orphan pruning, or skill rename flows.

## Decisions

### Backend authoritative field catalog

Create a backend catalog module that exposes field definitions for Claude Code,
Codex, Gemini CLI, and portable standard fields. The frontend reads this
catalog through a typed command wrapper and renders UI from the returned
definitions.

The catalog definition includes:

- target agent: `anthropic`, `codex`, `gemini`, or `standard`
- canonical path, such as `anthropic.allowed-tools`
- output location, such as `skill_frontmatter` or `codex_openai_yaml`
- output key, such as `allowed-tools` or `interface.display_name`
- value kind: string, boolean, enum, string list, object, or object array
- enum values when applicable
- source URL and verified date
- localized label/help keys

This avoids making the frontend a second source of truth. The alternative was a
TypeScript-only catalog, but that would drift from backend renderers and let the
UI expose fields the backend later drops.

### Agent-scoped canonical extras

New structured saves use an explicit Felina-owned top-level key:

```yaml
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
  gemini: {}
  standard:
    license: MIT
    compatibility: Requires git
    metadata:
      owner: platform
```

Top-level `name`, `description`, and retained `agents` stay outside this map.
Known flat extras are classified on read or save. Unknown extras are preserved
in canonical storage but do not become fan-out fields until a catalog entry
exists.

The `x_felina_` prefix makes ownership explicit and avoids collisions with
future vendor fields. Direct top-level `anthropic`, `codex`, and `gemini` maps
were rejected because they are more likely to collide with future skill
frontmatter keys.

### Target-filtered Advanced editor

SkillEditor uses enabled target agents to decide which Advanced field groups to
show. A single Codex target shows Codex fields; a single Claude Code target
shows Claude Code fields; a Gemini-only skill shows no target-specific optional
fields until Gemini documents them. Multiple targets render separate groups per
agent instead of one merged list.

The editor renders type-aware controls:

- string: text input
- boolean: toggle
- enum: select
- string list: repeatable value list
- object or object array: compact YAML/JSON object editor with validation

Duplicate fields within the same agent namespace are not allowed. The `agents`
frontmatter field remains preserved metadata and is not exposed as the target
selector.

### Fan-out allowlist as final boundary

Renderers do not trust the frontend. Each renderer emits only fields allowed by
the backend catalog for its target:

- Claude Code writes supported fields to `SKILL.md` frontmatter.
- Codex writes only `name` and `description` to `SKILL.md`, and Codex metadata
  to `agents/openai.yaml`.
- Gemini CLI writes only documented Gemini CLI fields.
- Unknown fields are preserved in canonical storage and omitted from all target
  outputs.

This makes fan-out the final enforcement point, which is required because
canonical files can be edited outside the UI.

### Source-agent import classification

Import classifies fields by the known source agent. Claude Code imports place
recognized Claude Code fields under `anthropic`. Codex imports read `SKILL.md`
for shared fields and `agents/openai.yaml` for Codex metadata. Gemini CLI
imports preserve `name` and `description` and do not invent optional Gemini
fields.

Unknown parseable source fields remain preserved but are not emitted to other
targets. Malformed frontmatter behavior remains governed by the existing broken
canonical skill flow.

## Implementation Contract

In scope:

- Add or update backend structures for field catalog definitions.
- Register the catalog command through the active Tauri command surface.
- Add a typed frontend wrapper and TypeScript field definition types.
- Update canonical parsing and serialization for `x_felina_agent_fields`.
- Replace free-form Advanced key/value rows with grouped target-filtered field
  controls.
- Update import classification and all three fan-out renderers.
- Add localized UI strings.
- Add focused Rust tests for migration, import classification, and renderer
  filtering.

Out of scope:

- Network schema refresh.
- Support for Claude.ai upload-only fields.
- Changes to canonical directory identity or target sidecar storage.
- Automatic deletion of unknown or unsupported stored fields.

Observable behavior:

- Claude Code targets expose Claude Code fields such as `allowed-tools`,
  `effort`, `paths`, and `shell`.
- Codex targets expose `agents/openai.yaml` fields such as
  `interface.display_name`, `interface.short_description`,
  `interface.default_prompt`, `policy.allow_implicit_invocation`, and
  `dependencies.tools`.
- Gemini-only targets do not expose unsupported optional fields.
- Multi-target skills display grouped Advanced sections by agent.
- Pushing a skill never writes agent-specific fields to the wrong target.

Interface and data shape:

- Backend command: `list_skill_field_catalog() -> Vec<SkillFieldDefinition>`.
- Frontend wrapper: `listSkillFieldCatalog(): Promise<SkillFieldDefinition[]>`.
- Canonical extension key: `x_felina_agent_fields`.
- Agent keys: `anthropic`, `codex`, `gemini`, and `standard`.

Failure modes:

- If catalog loading fails, SkillEditor surfaces a localized error and does not
  fall back to free-form cross-agent fields.
- If a value does not match the selected field type, structured save is blocked
  with a localized validation message.
- Unknown stored data remains preserved and omitted from fan-out.

Acceptance criteria:

- `npm run check` passes.
- Rust tests cover flat extras migration, scoped serialization, import
  classification, and renderer allowlists.
- Manual Tauri verification confirms Advanced options change when targets
  change and sample pushes write correct Claude Code, Codex, and Gemini CLI
  files.
- `spectra analyze agent-scoped-skill-fields --json` reports no Critical or
  Warning findings.

## Risks / Trade-offs

- [Risk] Catalog and renderer rules drift. -> Mitigation: backend catalog is
  the source consumed by frontend and mirrored by renderer tests.
- [Risk] Flat extras cannot be classified perfectly. -> Mitigation: classify
  known fields, preserve unknown fields, and never emit unknown fields.
- [Risk] Structured UI removes arbitrary YAML entry from normal editing. ->
  Mitigation: this is intentional for target-owned fields; unknown fields are
  preserved and broken skills still use raw repair.
- [Risk] Codex metadata is split into a sibling file. -> Mitigation: catalog
  entries carry output location so UI and renderer agree on where the field
  belongs.
- [Risk] This changes local agent configuration output. -> Mitigation: add a
  Spectra audit task focused on field leakage, type confusion, and unsafe
  defaults.
