## 1. Baseline

- [x] 1.1 Run baseline `npm run check` before implementation and record whether any TypeScript errors are pre-existing; verification is the saved command result compared against the final `npm run check`.
- [x] 1.2 Run baseline narrow Rust checks for existing skill modules, starting with `cargo test canonical_skills fan_out skill_import` from `src-tauri/` when those filters compile; verification is the command output recorded before code changes.

## 2. Backend catalog and contracts

- [x] 2.1 Implement **Backend authoritative field catalog** for **Agent-Scoped Field Catalog Reference** in `src-tauri/src/commands/skill_fields.rs` so `list_skill_field_catalog()` returns Claude Code, Codex, Gemini CLI, and standard field definitions with output locations, value kinds, source URLs, and verified dates; verification is a Rust unit test that asserts representative Claude, Codex, Gemini, and standard entries.
- [x] 2.2 Register the field catalog command through `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`, `src/lib/tauri/commands.ts`, and `src/lib/types/skills.ts` so frontend code can call `listSkillFieldCatalog(): Promise<SkillFieldDefinition[]>`; verification is `npm run check` plus a Rust compile check.
- [x] 2.3 Update the reference implementation contract for **Agent-Scoped Canonical Mapping** so catalog output locations distinguish `SKILL.md` frontmatter from Codex `agents/openai.yaml`; verification is a Rust test that routes `anthropic.allowed-tools`, `codex.interface.display_name`, and `standard.license` according to the spec table.

## 3. Canonical storage migration

- [x] 3.1 Implement **Agent-scoped canonical extras** for **Agent-Scoped Canonical Skill Fields** in `src-tauri/src/commands/canonical_skills.rs` so structured saves write `x_felina_agent_fields` while preserving top-level `name`, `description`, and retained `agents`; verification is a Rust serialization test for the new YAML shape.
- [x] 3.2 Add backward-compatible flat extras classification so existing flat `allowed_tools`, `allowed-tools`, `effort`, Codex `interface.*`, and unknown extras remain readable; verification is a Rust migration test that known fields move to scoped namespaces and unknown fields remain preserved but not target-emittable.
- [x] 3.3 Ensure invalid typed values in scoped fields are surfaced to the editor instead of silently dropped; verification is a backend or frontend validation test that an enum mismatch such as `effort: turbo` blocks structured save with an error.

## 4. Import and fan-out enforcement

- [x] 4.1 Implement **Source-agent import classification** in `src-tauri/src/commands/skill_import.rs` so Claude Code imports classify `allowed-tools` and `effort` into `anthropic`, Codex imports classify `agents/openai.yaml` `interface`, `policy`, and `dependencies` into `codex`, and Gemini CLI imports create no synthetic optional fields; verification is one focused Rust import test per target agent.
- [x] 4.2 Implement **Fan-out allowlist as final boundary** for **Target-Scoped Fan-Out Filtering** in `src-tauri/src/commands/fan_out/anthropic.rs`, `codex.rs`, and `gemini.rs` so Codex fields never appear in Claude Code output, Claude Code fields never appear in Codex output, and unknown fields never appear in any target output; verification is renderer snapshot or string-assertion tests for all three target agents.
- [x] 4.3 Preserve canonical unknown fields across save and push without emitting them to agent-native directories; verification is a Rust test that saves a skill containing `vendor_future_flag`, pushes to all three renderers, and confirms target outputs omit the field while canonical data retains it.

## 5. SkillEditor UI

- [x] 5.1 Implement **Target-filtered Advanced editor** for **Target-Filtered Advanced Field Editor** in `src/lib/components/skills/SkillEditor.tsx` so enabled targets determine the available Advanced field groups; verification is manual Tauri validation that Codex-only, Claude-only, Gemini-only, and mixed-target skills show the expected grouped options.
- [x] 5.2 Replace free-form Advanced key/value rows with catalog-driven controls for string, boolean, enum, list, object, and object-array values; verification is `npm run check` and manual save/reopen validation that typed values round-trip through canonical storage.
- [x] 5.3 Update `src/lib/components/skills/SkillsPage.tsx`, `src/lib/components/skills/TargetEditor.tsx`, and skill state plumbing so target changes immediately update available Advanced field groups without editing the retained `agents` metadata; verification is manual Tauri validation that adding/removing a target changes the picker while the canonical `agents` field remains preserved.
- [x] 5.4 Add localized labels, helper text, empty states, and validation errors in `src/lib/i18n/locales/en.ts` and `src/lib/i18n/locales/zh-TW.ts`; verification is `npm run check` confirming `TranslationDict` parity and manual UI review in both locales.

## 6. Verification and audit

- [x] 6.1 Run `cargo build` from `src-tauri/` and the narrowest relevant `cargo test` scope covering `canonical_skills`, `skill_import`, and `fan_out`; verification is successful command output or a documented pre-existing failure comparison against baseline.
- [x] 6.2 Run final `npm run check` and compare with baseline; verification is no new TypeScript errors from this change.
- [x] 6.3 Run `npm run tauri dev` and manually verify creating or editing sample Claude Code, Codex, Gemini CLI, and mixed-target skills shows correct Advanced field options and pushes correct target files; verification is a short manual checklist with paths inspected for expected output.
- [x] 6.4 Run `$spectra-audit` or equivalent audit review for local filesystem writes, YAML type confusion, agent permission defaults, and cross-agent field leakage; verification is an audit note showing no unresolved high-risk findings for this change.
