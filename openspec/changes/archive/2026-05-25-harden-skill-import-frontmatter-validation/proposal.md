## Problem

Skill import can silently corrupt a source `SKILL.md` when the file starts with a UTF-8 BOM, uses CRLF line endings, lacks the canonical-only `agents` field, or contains malformed frontmatter. The broken output has a new outer frontmatter with `description: ''` while the original frontmatter remains in the body, so an agent reads an empty description and does not load the skill correctly.

The harm is a three-part chain, not a single parse bug:

1. **Silent wrong import** — the importer produces wrong content with no indication anything is broken.
2. **Pushable corruption** — a corrupted-but-parseable canonical file can be pushed (fanned out) to agent directories, propagating the corruption.
3. **No in-app repair** — `SkillEditor` only opens a successfully parsed `CanonicalSkill` and by design never exposes raw frontmatter, so a user who notices a broken skill cannot fix it inside the app and must edit the raw file in a file manager.

## Root Cause

`skill_import_apply` first parses the source with the canonical parser. That parser requires `agents`, while valid Anthropic source skills can omit it. On parse failure, `ensure_required_fields` fell back to `raw.split_once("\n---\n")`, which does not handle CRLF closing fences and drops YAML parse failures into an empty mapping. The fallback then wrapped the whole source as body instead of reporting an invalid source file.

## Proposed Solution

- **Root-cause fix (done)**: reuse one BOM/LF/CRLF-aware frontmatter splitter for canonical reads and import normalization, and repair parseable-but-incomplete frontmatter (fill missing `name`, `description`, `agents`). A valid BOM + CRLF Anthropic source now imports correctly with its `description` preserved and no second frontmatter block in the body.
- **Canonical identity alignment**: import SHALL treat the source skill directory name as the stable canonical identity. When a parseable source frontmatter `name` disagrees with the source folder name, the canonical write rewrites `name` to the folder name so the stored file, UI identity, and filesystem directory stay aligned.
- **Import-as-broken (replaces blocking)**: when a source's frontmatter cannot be normalized (malformed YAML, non-mapping root, nested/repeated frontmatter), import writes the source verbatim into `~/.felina/skills/<name>/SKILL.md` and the skill surfaces as a `Broken` list entry — instead of refusing the import. Content is preserved, not discarded, and the breakage is visible rather than silent.
- **Push guard**: a `Broken` (unparseable) canonical skill SHALL NOT be fanned out. The backend already enforces this (`skill_sync_one` errors on parse failure, `skill_sync_all` skips non-`Ok` entries); this change confirms it and ensures the UI does not offer push for a broken skill and surfaces the parse error legibly.
- **Editor raw repair**: `SkillEditor` SHALL be able to open a `Broken` skill in a raw mode that shows the full raw `SKILL.md` text, lets the user edit it, and re-validates with `parse_skill_md` on save — writing normally when it parses and keeping the skill broken with a visible error when it does not. This is the in-app repair path that closes the chain.
- **Stable canonical-id actions**: selection, read, push, repair, delete, and target list mutation (set / prune scan / prune apply) flows SHALL stay anchored to a stable canonical directory identity rather than assuming the parsed frontmatter `name` is always the lookup key. A skill with a name-vs-directory mismatch must remain actionable in the app until the mismatch is healed — including the ability to toggle target Tracked/Disabled, add or remove targets, and run orphan prune against the correct canonical sidecar.
- **Canonical identity lifecycle correction**: new skill creation uses the user-entered name to create the initial canonical directory identity, but every later edit, raw repair, save, delete, target mutation, and fan-out path uses that canonical directory identity. If a raw repair or structured save produces parseable YAML whose `name` is missing or differs from the canonical directory, the app SHALL normalize `name` back to the directory identity and surface a visible advisory instead of silently letting the skill become `real` while its canonical folder remains `smoke-nested`.
- **Broken skill in-app deletion**: a `Broken` canonical skill SHALL be deletable from inside the editor's raw repair mode, keyed on the canonical directory identity. This is the escape hatch for the import-as-broken model — a user who imports a malformed source and decides not to repair it must be able to discard it without leaving the app.
- **Disk-path escape hatch**: the raw repair editor and per-target rows SHALL expose the underlying filesystem path with a button that opens the path in the OS file manager. This makes pre-existing orphan fan-out folders (and any disk state the app data model cannot fully represent) discoverable without requiring the app to scan or auto-clean them.

## Success Criteria

- A valid Anthropic skill with BOM, CRLF line endings, and no `agents` field imports with the original `description` preserved and no second frontmatter block in the body.
- A source with malformed YAML, a non-mapping root, or nested/repeated frontmatter imports as a `Broken` canonical skill (content preserved) rather than being silently corrupted or blocked.
- A parseable imported source whose frontmatter `name` differs from its source folder name is stored canonically with `name` rewritten to the folder name, so import does not create a canonical name-vs-directory mismatch.
- A `Broken` canonical skill cannot be pushed to any agent directory.
- A user can open a `Broken` skill in the editor's raw mode, fix the frontmatter, and on save the skill parses and becomes pushable.
- A canonical skill whose stored frontmatter `name` and directory name diverge remains selectable, repairable, deletable, and pushable by stable canonical identity until it is healed.
- A broken skill imported from `~/.claude/skills/smoke-nested/` whose repaired YAML contains `name: real` is normalized on save to `name: smoke-nested`, remains selected as `smoke-nested`, and pushes to the `smoke-nested/` target folder rather than creating or updating `real/`.
- A newly-created skill still uses the user's initial `name` as the canonical directory identity; only later edits are constrained by the existing canonical identity.
- Existing valid Anthropic, Codex, and Gemini imports still work; missing `name`, `description`, and `agents` are filled only when the frontmatter itself is parseable.
- Toggling Tracked/Disabled, adding or removing targets, and running orphan prune on a canonical skill whose `frontmatter.name` differs from the directory identity SHALL succeed against the correct sidecar, not error with "skill not found" against a parsed-name lookup.
- A `Broken` canonical skill SHALL be deletable from inside the editor's raw repair mode in a single action, and the delete SHALL target the canonical directory identity rather than the (potentially absent or mismatched) parsed name.
- The raw repair editor SHALL display the canonical `SKILL.md` path with a button that opens the containing folder in the OS file manager, and each target row SHALL provide the same affordance for its fan-out destination so users can discover and clean residue the app does not surface.

## Non-Goals

- Do not auto-repair already corrupted files in `~/.claude/skills/`, `~/.felina/skills/`, `.agents/skills/`, or other agent-native directories without an explicit user action.
- Do not redesign multi-source import resolution, arbitrary-folder import, push dry-run, or the broader skill sync lifecycle (those remain in `skill-sync-lifecycle`).
- Do not add a structured YAML linter / transpiler; the raw editor is a plain text area plus re-validation on save.
- Do not add npm or Cargo dependencies (`tauri-plugin-shell` is already loaded by the app and is reused for the open-in-folder buttons).
- Do not auto-detect, scan, or clean pre-existing fan-out folders that were written under a parsed-name identity by prior bugged pushes. These ghost folders remain on disk; the open-in-folder buttons make them discoverable, but cleanup is a manual user action handled outside the app.
- Do not redesign the Projects view's `ManagedInventory` row identity. This change continues to display skill names there using the same source (parsed `frontmatter.name`) as the editor's disabled name field, keeping the two surfaces visually consistent; switching `ManagedInventory` to a canonical-directory identity belongs in `skill-sync-lifecycle` along with rename support.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `multi-agent-skills`: agent-native skill import distinguishes repairable missing canonical fields from malformed source frontmatter; malformed sources import as `Broken` canonical skills that cannot be pushed and can be repaired in the editor's raw mode, instead of being silently canonicalized or blocked at import.
- `multi-agent-skills`: imported and existing canonical skills use a stable canonical directory identity for app actions, raw repair, structured save, and fan-out target folder naming; parseable imports and repaired/edited canonical files rewrite mismatched frontmatter `name` values to the canonical directory name, and name-vs-directory mismatches no longer strand or rename a skill in the UI.

## Impact

- Affected code:
  - Modified: src-tauri/src/commands/skill_import.rs
  - Modified: src-tauri/src/commands/canonical_skills.rs (raw read/write commands for possibly-broken skills; stable canonical-id read/delete behavior)
  - Modified: src-tauri/src/commands/fan_out/mod.rs (confirm push guard surfaces a legible error; ensure fan-out paths use canonical directory identity)
  - Modified: src-tauri/src/commands/skill_import.rs (directory-name identity normalization for parseable imports)
  - Modified: src/lib/components/skills/SkillImportWizard.tsx
  - Modified: src/lib/components/skills/SkillEditor.tsx (raw repair mode for broken skills; in-editor Delete keyed on canonical identity; canonical path display + "Open in folder" button)
  - Modified: src/lib/components/skills/SkillList.tsx (open broken entry → editor; stable canonical-id selection; no push for broken)
  - Modified: src/lib/components/skills/SkillsPage.tsx (route broken-entry selection into the editor; keep push/delete/repair/target-mutation actions bound to canonical identity; deep-link `?select=` consumer matches by canonical directory identity)
  - Modified: src/lib/components/skills/TargetEditor.tsx (target list mutation keyed on canonical identity; per-target "Open target folder" button)
  - Modified: src/lib/types/skills.ts
  - Modified: src/lib/tauri/commands.ts
  - Modified: src/lib/i18n/locales/en.ts, src/lib/i18n/locales/zh-TW.ts
  - Modified: AGENTS.md
  - New: none
  - Removed: none
- Dependencies: none
- Compatibility: valid imports remain supported; malformed imports become visible `Broken` skills (content preserved, push-blocked, in-app repairable) instead of silent corrupted writes or hard import failures.
