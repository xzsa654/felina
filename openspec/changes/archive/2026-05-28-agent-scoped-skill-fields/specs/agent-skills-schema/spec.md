## ADDED Requirements

### Requirement: Agent-Scoped Field Catalog Reference

The reference SHALL define an agent-scoped skill field catalog for the supported
CLI targets: Claude Code, Codex, and Gemini CLI. Each field definition SHALL
include the target agent, canonical storage namespace, canonical key, output
file location, output field key, value type, enum values when applicable,
source URL, and verified date. The reference SHALL NOT include Claude.ai web
upload fields or non-CLI product fields in this catalog.

#### Scenario: Lookup fields for one CLI target

- **WHEN** a reader looks up field definitions for `codex`
- **THEN** the reference SHALL list Codex `SKILL.md` fields separately from
  `agents/openai.yaml` metadata fields
- **AND** each Codex metadata field SHALL identify `agents/openai.yaml` as its
  output location

#### Scenario: Catalog excludes non-CLI products

- **WHEN** a reader looks up Claude fields in this project reference
- **THEN** the reference SHALL describe Claude Code fields only
- **AND** the reference SHALL NOT include Claude.ai upload-only fields in the
  Claude Code catalog

#### Scenario: Catalog carries verification metadata

- **WHEN** a reader inspects any field entry
- **THEN** the entry SHALL include the source documentation URL and a
  `verified YYYY-MM-DD` date
- **AND** stale verification dates SHALL indicate that maintainers need to
  re-check the vendor documentation before adding or changing fields

### Requirement: Agent-Scoped Canonical Mapping

The reference SHALL describe how canonical agent-scoped field namespaces map to
target outputs. The `anthropic` namespace SHALL map only to Claude Code
`SKILL.md` frontmatter fields. The `codex` namespace SHALL map Codex UI,
policy, and dependency metadata to `agents/openai.yaml` and SHALL keep Codex
`SKILL.md` limited to `name` and `description`. The `gemini` namespace SHALL
map only documented Gemini CLI fields; until Gemini CLI documents additional
fields, Gemini fan-out SHALL emit only `name` and `description`. The `standard`
namespace SHALL represent Agent Skills open-standard fields, and renderers
SHALL emit those fields only when the target implementation explicitly supports
them.

#### Scenario: Map scoped canonical data to target files

- **WHEN** canonical frontmatter contains `anthropic.allowed-tools`,
  `codex.interface.display_name`, and `standard.license`
- **THEN** the Claude Code mapping SHALL route `anthropic.allowed-tools` to
  Claude Code `SKILL.md`
- **AND** the Codex mapping SHALL route `codex.interface.display_name` to
  Codex `agents/openai.yaml`
- **AND** the Gemini CLI mapping SHALL ignore both agent-specific fields unless
  Gemini CLI has matching documented support

##### Example: scoped field routing

| Canonical field | Claude Code output | Codex output | Gemini CLI output |
| ----- | ----- | ----- | ----- |
| `anthropic.allowed-tools` | `SKILL.md` frontmatter `allowed-tools` | ignored | ignored |
| `codex.interface.display_name` | ignored | `agents/openai.yaml` `interface.display_name` | ignored |
| `standard.license` | emitted only if supported by the target catalog | emitted only if supported by the target catalog | emitted only if supported by the target catalog |
