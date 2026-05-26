## Context

Skill import pulls existing agent-native `SKILL.md` files into the global canonical store under `~/.felina/skills/`. The current importer first tries the canonical parser, then falls back to a string split that only matches LF fences. That fallback can misclassify valid Anthropic source files that omit canonical-only `agents`, especially when the file uses BOM + CRLF, and can turn malformed input into a new canonical file with an empty description.

Relevant existing code:

- `src-tauri/src/commands/canonical_skills.rs` owns canonical frontmatter splitting and parsing.
- `src-tauri/src/commands/skill_import.rs` scans agent-native sources and writes normalized canonical files.
- `src/lib/components/skills/SkillImportWizard.tsx` renders candidates and apply errors.
- `src/lib/types/skills.ts` and `src/lib/tauri/commands.ts` carry the import candidate contract.

Project-knowledge query result: `.knowledge` has a Windows CRLF stat-cache note, but no existing skill import or YAML frontmatter guidance. Current code and specs remain the source of truth.

This touches user filesystem reads and writes. The change requires explicit validation failures before writing canonical files.

## Goals / Non-Goals

**Goals:**

- Preserve valid source metadata when importing legal Anthropic, Codex, or Gemini skills.
- Normalize import parsing around one BOM/LF/CRLF-aware frontmatter splitter.
- Keep canonical skill identity stable when `SKILL.md` frontmatter `name` and the canonical directory name diverge, so UI actions do not strand the skill.
- Preserve malformed source content as a broken canonical skill instead of writing corrupted canonical files or blocking in-app repair.
- Keep raw repair, structured save, fan-out folder naming, and target list mutation (`skill_targets_set`, prune scan, prune apply) anchored to the canonical directory identity after a skill already exists.
- Provide a delete affordance for broken canonical skills from inside the raw repair editor, so the user has an escape hatch when raw editing is not enough.
- Surface the underlying filesystem path of a broken skill and of each target with an OS-level "open in folder" affordance, so disk residue the app data model cannot fully see (pre-fix orphan fan-out folders, externally-edited files) remains discoverable.
- Surface advisory text when the app normalizes YAML `name` to the canonical directory name.
- Add regression coverage for the BOM + CRLF corruption case, malformed YAML cases, target mutation against a mismatched canonical skill, and the canonical-identity-keyed delete from raw mode.

**Non-Goals:**

- Do not repair existing corrupted files on disk.
- Do not change agent-specific rendered frontmatter schemas for Anthropic, Codex, or Gemini; only the output directory identity is in scope.
- Do not change the per-skill target model or multi-source import policy.
- Do not add npm or Cargo dependencies (the existing `tauri-plugin-shell` registered in `lib.rs` is reused for the open-in-folder buttons).
- Do not implement a structured YAML linter or transpiler beyond raw repair validation and canonical `name` normalization.
- Do not auto-detect, scan for, or clean pre-existing fan-out folders previously written under a parsed-name identity by a bugged push. After this change, future pushes correctly target the canonical directory identity, but a project that received a pre-fix push to `<target>/real/` retains that folder on disk. Discovery is delegated to the open-in-folder buttons; removal is a manual user action.
- Do not redesign the `ManagedInventory` row identity in the Projects view. This change keeps `ManagedInventory` displaying skill names using parsed `frontmatter.name`, the same identity the editor's disabled name field reflects, so a single user sees the same label across both surfaces. Switching `ManagedInventory` to a canonical-directory identity belongs in `skill-sync-lifecycle` along with rename support.

## Decisions

### Shared frontmatter splitting for canonical and import paths

Use the canonical splitter behavior as the single parser entry point for `SKILL.md` frontmatter. Make the helper available to import code without duplicating the LF/CRLF/BOM handling logic. The helper must return enough structure to distinguish missing frontmatter, unterminated frontmatter, and a valid split.

Alternative considered: keep a separate import-only splitter. This keeps the edit smaller but preserves the drift that caused this bug.

### Strict source validation before normalization

Import normalization must parse source frontmatter as a YAML mapping before filling canonical fields. Missing `name`, `description`, and `agents` remain repairable. YAML syntax errors, scalar/list frontmatter roots, and nested or repeated frontmatter before body content are detected as validation failures — but detection drives import-as-broken (below), not a hard block.

Alternative considered: preserve permissive fallback and only add CRLF support. That fixes the observed BOM + CRLF case but still allows malformed YAML to become a misleading canonical file.

### Directory name as canonical skill identity

The canonical directory name is the durable identity for a skill inside the app and on disk. For parseable imports, the source folder name wins over a conflicting frontmatter `name`: import rewrites the canonical frontmatter `name` to match the source folder name before writing `~/.felina/skills/<dir>/SKILL.md`.

Rationale: current app actions mix two identities — directory lookup on the backend and parsed `name` on the frontend. When they diverge, selection can succeed but subsequent read, push, or delete calls target a non-existent directory key and strand the skill. Using the directory name as the canonical identity makes import deterministic and prevents new mismatches from entering canonical storage.

Alternative considered: preserve mismatched names and only warn in the UI. Rejected because the mismatch is not just cosmetic; it breaks command routing and leaves the skill partially unmanageable.

### Canonical identity lifecycle for new and existing skills

New skill creation is the only point where a user-entered `name` creates a canonical identity: the app creates `~/.felina/skills/<name>/` and writes `name: <name>` into frontmatter. After that directory exists, the directory name becomes the sole identity for read, write, raw repair, delete, target sync metadata, and fan-out output folder paths.

For existing skills, structured saves must write back to the existing canonical directory identity rather than using the editable or parsed frontmatter `name` as the filesystem key. If an existing skill's parsed `name` differs from the canonical directory identity, save must normalize the frontmatter `name` to the canonical identity and show a visible advisory. This advisory is informational, not a blocking dialog: the user needs to know the app repaired identity drift, but the save should succeed once the rest of the content is valid.

Alternative considered: allow structured save to rename the canonical skill when `name` changes. Rejected because rename is a separate lifecycle operation with target/orphan implications; silently treating a save as rename is how source, canonical, and pushed folders diverge.

### Import-as-broken over block-at-import

When a source's frontmatter cannot be normalized, import writes the source **verbatim** into `~/.felina/skills/<name>/SKILL.md` rather than refusing the import. The skill then reads back as a `SkillListEntry::Broken` because `parse_skill_md` fails on it. This preserves the user's content, makes the breakage visible in the list, and routes the skill into the editor's raw repair path.

Rationale: the real harm of the original bug was the chain of *silent wrong import + pushable corruption + no in-app repair*. Blocking at import only addresses the first link, discards the user's content, and forces raw-file editing outside the app. Import-as-broken reuses two existing mechanisms — the `Broken` list entry (UI already renders it) and the parse-gated push guard (already blocks broken skills) — so the only genuinely new surface is the editor's raw repair mode.

Alternative considered: block malformed sources at the import gate (the prior design of this change). Rejected because it loses content and leaves the user with no in-app recovery.

Note on the validation helpers: `validate_source_frontmatter` and `body_has_nested_frontmatter` are retained. Their role shifts from "decide whether to refuse the import" to "decide whether the normalized write is safe, or whether to fall back to a verbatim broken write." The detection logic is unchanged; only the action on failure changes.

### Push guard for broken skills (already enforced)

A `Broken` (unparseable) canonical skill must never be fanned out to agent directories. This is already true at the Rust layer: `skill_sync_one` calls `parse_skill_md(&raw)?` and errors on a broken skill; `skill_sync_all` iterates `SkillListEntry` and processes only `Ok` entries. This change confirms that guard, ensures the import wizard's representative push UI does not offer push for a broken skill, and surfaces the parse error legibly rather than as a raw `?`-propagated string.

Alternative considered: add a new dedicated push-guard layer. Rejected as redundant — the parse gate already enforces the invariant.

### Editor raw repair mode

`SkillEditor` today opens only a successfully parsed `CanonicalSkill` and, by design, never exposes raw YAML. A `Broken` list entry carries no `CanonicalSkill`, so it cannot be opened for repair. This change adds a raw repair path:

- A backend command reads the raw `SKILL.md` text of a (possibly broken) skill. `canonical_skills_read` cannot be reused because it errors on parse failure.
- `SkillEditor` detects a broken-entry selection and renders a raw `<textarea>` containing the full `SKILL.md` text instead of the structured fields.
- A backend command writes raw `SKILL.md` text verbatim (used by raw-mode save). On save, the content is re-validated with `parse_skill_md`: if it parses, the skill is no longer broken and becomes pushable; if it still fails, the skill stays broken and the editor shows the parse error.
- When raw-mode save parses successfully, the backend must normalize the saved frontmatter `name` to the canonical directory identity before the skill exits broken state. Example: a broken canonical skill at `~/.felina/skills/smoke-nested/SKILL.md` whose repaired text contains `name: real` must be saved back with `name: smoke-nested`, remain selected as `smoke-nested`, and display an advisory that the YAML name was corrected to match the folder name.

The raw editor is a plain text area plus re-validation — no structured YAML linter or transpiler (MVP, per Non-Goals).

### Stable canonical-id actions across read, push, repair, delete, and target mutation

Frontend selection and backend commands must use a stable canonical identifier that resolves to the canonical directory, not the parsed display `name`. The list/read contract therefore needs to preserve enough identity for:

- selecting a parseable-but-mismatched canonical skill;
- opening it for structured or raw repair;
- pushing it through the existing parse gate;
- deleting it from inside the app even when its frontmatter `name` disagrees with the directory name;
- mutating its target list — toggling Tracked/Disabled, adding or removing targets, scanning orphans, applying prune — against the correct canonical sidecar (`<canonical-id>/.felina-sync-meta.json`), not a parsed-name lookup that errors with "skill not found";
- consuming a deep-link `?select=<id>` from the Projects view by canonical directory identity, so an editor selection survives parsed-name drift on either end of the navigation.

This can be satisfied by carrying a canonical-id / directory-name field through the list and command wrappers, or by otherwise guaranteeing that every app action targets the directory identity consistently. The exact field name is an implementation choice; the durable contract is that name-vs-directory mismatch SHALL NOT make a skill unreadable, unpushable, undeletable, non-toggleable, or unaddressable from the app.

Alternative considered: fix only import and leave existing mismatched canonical files for manual filesystem cleanup. Rejected because users already have skills in this state, and the product problem is specifically that the app cannot recover them.

Alternative considered: extend `ManagedInventory` to also use canonical identity for its row keys. Rejected for this change because `ManagedInventory` builds rows from the union of a project agent-directory scan (which has only source folder names, no canonical identity) and canonical entries with project targets; reconciling the two row identities is intertwined with rename / scope-move flows that belong in `skill-sync-lifecycle`. `ManagedInventory` keeps using parsed `frontmatter.name` for display, matching what the editor's disabled name field shows.

### Fan-out output folders use canonical identity

Fan-out renderers may continue to render agent-specific frontmatter from the parsed canonical skill content, but the destination subdirectory under each target skills directory must use the canonical directory identity, not parsed `frontmatter.name`. This keeps a repaired `smoke-nested` skill from being pushed to `real/` when the user corrected YAML structure but left `name: real` in the raw editor before normalization.

Alternative considered: rely on raw repair and structured save normalization only. Rejected because fan-out is the final filesystem write boundary; it must defend the same identity invariant even if a mismatched canonical file already exists.

### No automatic cleanup for already corrupted files

This change prevents future silent corruption and surfaces invalid sources as broken skills the user can repair. Existing corrupted files in agent-native directories remain untouched because automatic repair could overwrite user-authored content and bundled files; repair happens only through an explicit user action (import, or raw-mode edit + save).

Alternative considered: add a cleanup command. That belongs in a separate migration or repair change with explicit previews and confirmation.

### Broken canonical skill deletion from raw repair mode

A `Broken` skill that the user does not want to repair must be removable from inside the app. The raw repair editor SHALL surface a Delete action that:

- targets the canonical directory identity (`<canonical-id>`), not parsed `frontmatter.name` — a malformed skill may have no parseable name at all;
- reuses the existing `canonical_skills_delete` command and confirmation dialog used by the structured editor;
- clears the editor view back to the placeholder after deletion succeeds.

Rationale: the import-as-broken model deliberately preserves malformed content as a Broken canonical skill so the user can decide what to do with it. "Decide" has two outcomes — repair, or discard. Without a discard path inside the app, a user who imports a bad file is forced to navigate the filesystem to delete it, undermining the in-app repair pitch.

Alternative considered: only expose delete after raw repair succeeds (i.e. only on parseable skills). Rejected because that leaves the import-as-broken escape hatch incomplete; the user already saw the broken row and made an informed choice to drop it.

### Disk-path escape hatch via "Open in folder" buttons

Two surfaces SHALL display the underlying filesystem path with a button that opens the path in the OS file manager via `tauri-plugin-shell`:

- the raw repair editor header — `~/.felina/skills/<canonical-id>/SKILL.md`, so a user whose YAML is beyond plain-text repair can drop into a richer editor or hand the file to another tool;
- each row in `TargetEditor` — the resolved fan-out destination `<target>/<canonical-id>/`, so a user can inspect what was actually pushed (or what was pushed before this change's fan-out identity fix).

This affordance is the chosen mitigation for the residual orphan problem described under Risks: after this change, future pushes write to `<target>/<canonical-id>/`, but pre-fix pushes that landed at `<target>/<parsed-name>/` remain on disk and are invisible to the prune scan (which loops over the canonical id). Rather than expand prune to also scan parsed-name candidates (more code, more edge cases under rename), the open-in-folder button lets the user navigate to the agent directory and clean residue manually.

The button uses the existing `tauri-plugin-shell` already registered in `lib.rs`; no new dependency. The frontend calls `open` on the directory path (not the file path) so the user lands at the containing folder.

Alternative considered: extend `skill_prune_orphans_scan` to also probe `<target>/<parsed_name>/` when parsed name differs from canonical id. Rejected because (a) rename has not yet been designed and may introduce more parsed-name variants that this probe would need to chase; (b) the orphan would still need explicit user confirmation to delete, which is exactly what the file manager already provides; (c) probing adds backend complexity for a transient situation that should resolve as users edit and re-push their skills.

## Implementation Contract

Behavior:

- A valid Anthropic source with BOM + CRLF + missing `agents` preserves its source `description` and body when written to canonical storage (root-cause splitter fix).
- Applying an import selection whose source frontmatter normalizes safely writes a parseable canonical `SKILL.md` with required fields filled.
- Applying an import selection whose source frontmatter normalizes safely uses the source skill directory name as the canonical identity; if the source frontmatter `name` differs, the canonical write rewrites `name` to the directory name.
- Applying an import selection whose source frontmatter cannot be normalized (malformed YAML, non-mapping root, nested/repeated frontmatter) writes the source **verbatim** to canonical, so the skill reads back as a `Broken` list entry. The import is not refused and the source content is not discarded.
- A `Broken` canonical skill is never fanned out: `skill_sync_one` errors and `skill_sync_all` skips it. The UI does not offer push for a broken skill.
- A `Broken` skill can be opened in the editor's raw mode, edited as raw `SKILL.md` text, and on save re-validated: if it parses it becomes a normal pushable skill; if not it remains broken with a visible error.
- A canonical skill whose directory name and parsed frontmatter `name` diverge remains selectable and actionable in-app: read, push, delete, repair, AND target list mutation (set, prune scan, prune apply) target the canonical directory identity until the mismatch is healed.
- A raw repair save that parses but contains `name` missing or different from the canonical directory identity normalizes `name` to the directory identity before leaving broken state and shows an advisory that the YAML name was corrected.
- A structured save for an existing skill writes to the existing canonical directory identity, normalizes `frontmatter.name` to that identity, and does not create or select a second canonical skill named after the edited or parsed YAML `name`.
- Fan-out writes each target skill directory under the canonical directory identity. Parsed `frontmatter.name` cannot redirect output to a different folder.
- Toggling a target between Tracked and Disabled, adding a target, removing a target, and running orphan prune on a canonical skill SHALL succeed when invoked from the editor regardless of whether `frontmatter.name` matches the canonical directory identity; the backend sidecar lookup SHALL use the canonical directory identity.
- A `Broken` canonical skill SHALL be deletable from inside the raw repair editor. The delete confirmation dialog SHALL surface the canonical directory identity (not parsed `frontmatter.name`, which may be absent or wrong), and on confirm SHALL remove `~/.felina/skills/<canonical-id>/`.
- A deep-link `?select=<id>` from the Projects view that targets a canonical skill SHALL be resolved by canonical directory identity; selection SHALL succeed even when the canonical skill's parsed `frontmatter.name` differs from the deep-link parameter.
- The raw repair editor SHALL display the canonical `SKILL.md` path and an "Open in folder" button that opens the containing canonical directory in the OS file manager.
- Each row in `TargetEditor` SHALL provide an "Open target folder" button that opens the resolved fan-out destination (`<target>/<canonical-id>/` for the row's agent + scope + project) in the OS file manager. The button SHALL be disabled and surface a tooltip when the destination path is missing on disk.

Interface / data shape:

- `ImportCandidate` carries an optional `validationError` string (Rust + TypeScript) used as a pre-import advisory in the wizard; it does not block import.
- Parseable import normalization rewrites `frontmatter.name` to the source directory name when they disagree, instead of preserving the mismatched source `name`.
- `skill_import_apply` writes a verbatim broken canonical file for a candidate whose source cannot be normalized, instead of erroring.
- A backend command returns the raw `SKILL.md` text of a skill by name regardless of whether it parses (distinct from `canonical_skills_read`, which errors on parse failure).
- A backend command writes raw `SKILL.md` text verbatim for a skill by name (used by editor raw-mode save).
- Frontend list state and command wrappers carry or preserve a stable canonical directory identity separate from any user-visible display `name`, so delete/push/repair/target-mutation do not rely on `frontmatter.name` as the lookup key.
- `TargetEditor` receives the canonical directory identity (not parsed `frontmatter.name`) from `SkillsPage` as its `skillName` prop, and uses that value for every backend call it makes (`skill_targets_set`, `skill_prune_orphans_scan`, `skill_prune_orphans_apply`).
- `SkillsPage`'s deep-link consumer (`?select=`) matches the requested name against canonical directory identity (via `skillListEntryCanonicalId`), not parsed `e.skill.name`.
- The raw repair editor accepts an optional `onDelete` callback alongside `onSaved`; when supplied, the editor renders a Delete button alongside Save, and clicking it triggers the existing delete confirmation dialog with the canonical directory identity as the target.
- The frontend exposes an `openPath(path: string)` helper (thin wrapper over `@tauri-apps/plugin-shell`'s `open`) consumed by the raw repair editor and `TargetEditor` rows. The exact module location is an implementation detail.
- Save and raw-repair responses must provide enough information for the UI to show a non-blocking advisory when `frontmatter.name` was normalized to the canonical directory identity. The exact response shape is an implementation detail, but the advisory must include the canonical name and must not require translating user-authored names or paths.
- Existing `deferred` multi-source candidates remain separate from `validationError`.

Failure modes:

- Read failures during scan continue to be ignored as today.
- A source that cannot be normalized becomes a verbatim broken canonical write, not a process-wide failure and not a silent normalized write.
- Raw-mode save that still fails `parse_skill_md` keeps the skill broken and reports the parse error; it does not silently accept invalid content as valid.
- Raw-mode save that parses but contains a mismatched or missing YAML `name` succeeds after canonical-name normalization and surfaces an advisory; it must not leave the skill half-repaired under one name and pushed under another.
- A canonical skill with a lingering name-vs-directory mismatch is still actionable in the app; the mismatch must not degrade into "cannot push", "cannot delete", or "cannot open" behavior.
- No agent-native or canonical file is auto-repaired without an explicit user action (import or raw-mode save).

Acceptance criteria:

- Rust unit tests cover: BOM + CRLF valid import (description preserved, no nested block), malformed-YAML / non-mapping / nested source imported as a verbatim broken canonical file (reads back as `Broken`, not silently normalized), and raw-write-then-reparse round trip (broken raw text → save fixed text → parses).
- Rust unit tests cover parseable import with mismatched `frontmatter.name` vs. source folder name, proving the canonical write rewrites `name` to the folder identity.
- Rust or frontend regression coverage proves a raw repair of `~/.felina/skills/smoke-nested/SKILL.md` containing `name: real` saves as `name: smoke-nested`, remains selected by `smoke-nested`, and does not create `~/.felina/skills/real/`.
- Regression coverage proves fan-out of a canonical directory `smoke-nested` with parsed or previously-stored `name: real` writes to the `smoke-nested/` target folder and not `real/`.
- A broken canonical skill is rejected by `skill_sync_one` and skipped by `skill_sync_all` (regression test).
- Regression coverage proves `skill_targets_set` and `skill_prune_orphans_scan` succeed against a canonical skill whose directory identity differs from its parsed `frontmatter.name`, using the canonical directory identity as the lookup key.
- Frontend regression or component contract review proves the raw repair editor renders a Delete button when an `onDelete` prop is supplied, and that activating it routes through the same confirmation dialog and `canonical_skills_delete` call used by the structured editor.
- TypeScript check passes with the updated candidate type, wizard rendering, editor raw mode (Save + Delete + path/open-folder), and `TargetEditor` (per-target open-folder button) changes.
- Manual `npm run tauri dev`: a malformed source imports as a broken skill, cannot be pushed, is deletable from the app (both via raw mode Delete and via Skills list selection + delete), and is repairable in the editor raw mode; a valid BOM + CRLF source imports cleanly; a name-vs-directory mismatch does not strand the skill across read/push/delete/repair/target-mutation flows; the raw editor's "Open in folder" button opens `~/.felina/skills/<canonical-id>/` in the OS file manager; a `TargetEditor` row's "Open target folder" button opens the resolved fan-out destination.
- `spectra analyze harden-skill-import-frontmatter-validation --json` has no Critical or Warning findings; `spectra validate harden-skill-import-frontmatter-validation` succeeds.

In scope:

- Import normalization with BOM/LF/CRLF handling and field repair.
- Canonical identity alignment between source folder names, canonical directory names, and app action routing.
- Canonical identity lifecycle for new versus existing skills, including raw repair normalization, structured save normalization, user advisory text, and fan-out output folder identity.
- Canonical identity for target list mutation (`skill_targets_set`, prune scan, prune apply) and for the `?select=` deep-link consumer.
- Import-as-broken for non-normalizable sources, plus an in-editor Delete action for broken skills.
- Confirming the parse-gated push guard and removing any push affordance for broken skills.
- Editor raw repair mode + raw read/write commands + canonical path display + "Open in folder" button.
- `TargetEditor` per-row "Open target folder" button.
- Regression tests around import parsing, broken-write round trip, push guard, target mutation under name-vs-directory mismatch, and the raw-mode Delete contract.

Out of scope:

- Existing corrupted file auto-repair (no user action).
- Agent-specific rendered frontmatter schema changes beyond canonical-name normalization.
- Multi-source import resolution, arbitrary-folder import, push dry-run, scope moves, skill rename (remain in `skill-sync-lifecycle`).
- Structured YAML linter / transpiler.
- Detection or cleanup of pre-fix orphan fan-out folders written to `<target>/<parsed-name>/` by earlier bugged pushes. The "Open target folder" button surfaces them; cleanup is a manual user action.
- `ManagedInventory` row identity change in the Projects view. Display continues to use parsed `frontmatter.name`, matching the editor's disabled name field, so the user sees one consistent label per skill across surfaces.

## Risks / Trade-offs

- [Risk] A malformed source now lands in canonical as a broken skill the user must notice and repair. -> Mitigation: the broken entry is visible in the list with its error, cannot be pushed, and is repairable in the editor's raw mode — content is preserved, not silently corrupted.
- [Risk] Shared parser changes could affect canonical list/read behavior. -> Mitigation: preserve existing canonical parser error strings where practical and add targeted tests before changing call sites.
- [Risk] Existing mismatched canonical skills may need a new stable-id field or routing update across multiple frontend/backend layers. -> Mitigation: treat canonical directory identity as the contract, propagate it explicitly through list/read/write/delete wrappers, and cover delete/push/read regressions with tests plus manual smoke.
- [Risk] Nested-frontmatter detection could misclassify a body that intentionally starts with a YAML fence, causing a verbatim broken write for an otherwise-importable file. -> Mitigation: only treat a body that starts immediately with a frontmatter-style `---` block as nested, which matches the corruption pattern; and import-as-broken (not block) means the user can still recover via raw-mode repair.
- [Risk] A raw verbatim write could store content that never parses. -> Mitigation: the push guard blocks broken skills, and raw-mode save re-validates so the user gets immediate feedback until the content parses.
- [Risk] After this change, pushes write to `<target>/<canonical-id>/` — but a user whose project received a pre-fix push to `<target>/<parsed-name>/` retains that ghost folder on disk, and the existing prune scan (which loops over canonical id) does not detect it. The agent runtime will load both copies and may render the wrong one. -> Mitigation: the `TargetEditor` per-row "Open target folder" button lets the user navigate to the actual fan-out destination and discover residue. Cleanup is a manual filesystem action. We considered extending prune to also scan parsed-name candidates, but rejected it because (a) it adds complexity for a transient situation that self-resolves as users edit and re-push, and (b) rename support in `skill-sync-lifecycle` will need to revisit the prune scope anyway.
- [Risk] An "Open in folder" button could expose the user to broken paths (e.g., the project root was renamed/deleted). -> Mitigation: the button SHALL be disabled with a tooltip when the destination path does not exist on disk; the existing project-not-found indicator already surfaces this state, so the button just inherits it.

## Migration Plan

No data migration is performed. After implementation, a malformed source imports as a broken canonical skill (content preserved, push-blocked, repairable) instead of a silent corrupted write. Rollback is the prior importer behavior, which reintroduces silent corrupted writes.

## Open Questions

None.
