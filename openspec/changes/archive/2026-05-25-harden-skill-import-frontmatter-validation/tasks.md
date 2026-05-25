## 1. Baseline

- [x] 1.1 Run `npm run check` before code edits and record whether TypeScript has pre-existing errors or warnings; verification is the command output captured in the apply notes.
- [x] 1.2 Run the narrow Rust baseline for skill import tests before code edits so regressions are separable from pre-existing state; verification is `cargo test commands::skill_import` from `src-tauri/` or the narrowest available equivalent.

## 2. Parser fix and field repair (root cause)

- [x] 2.1 Implement Shared frontmatter splitting for canonical and import paths so `SKILL.md` parsing handles UTF-8 BOM, LF, and CRLF consistently for Initial Skill Import; verification is Rust unit coverage for BOM + CRLF valid source import.
- [x] 2.2 Repair parseable-but-incomplete source frontmatter (fill missing `name`, `description`, `agents`) when the frontmatter is a valid YAML mapping; verification is the existing `ensure_required_fields` injection test.
- [x] 2.3 Preserve the existing valid Initial Skill Import project-target behavior; verification is the existing project import target regression test still passing.

## 3. Import-as-broken (replaces blocking)

- [x] 3.1 Implement Import-as-broken over block-at-import using Strict source validation before normalization: keep `validate_source_frontmatter` / `body_has_nested_frontmatter` detection, but on failure drive a verbatim broken write instead of an `Err` — when a source cannot be normalized, `skill_import_apply` writes the source content verbatim to `~/.felina/skills/<name>/SKILL.md`; verification is a Rust test that a malformed-YAML / non-mapping / nested-frontmatter source produces an on-disk canonical `SKILL.md` whose bytes equal the source and which `parse_skill_md` rejects (reads back as `Broken`).
- [x] 3.2 Stop discarding or skipping non-normalizable candidates in `skill_import_apply`: remove the `validationError` apply-skip and the `ensure_required_fields` hard-fail path in favor of the verbatim broken write; verification is a Rust test that a previously-blocked candidate now yields a broken canonical file rather than no file.
- [x] 3.3 [P] Repurpose `validationError` in `SkillImportWizard` from a hard block to an advisory: the candidate stays selectable and imports as broken, the row shows it will import as broken with the detected error, and `deferred` multi-source rows stay visually and behaviorally distinct; verification is component review plus `npm run check`.

## 4. Push guard for broken skills

- [x] 4.1 Implement Push guard for broken skills (already enforced) by confirming and locking the parse-gated guard with a regression test: a broken canonical skill is rejected by `skill_sync_one` (returns `Err` with the parse error) and skipped by `skill_sync_all`; verification is a Rust test asserting both behaviors.
- [x] 4.2 [P] Remove any push affordance for a broken skill in the Skills UI and surface the single-skill push parse error legibly (not a raw propagated string); verification is manual review in `npm run tauri dev` plus `npm run check`.

## 5. Editor raw repair mode

- [x] 5.1 Add backend commands to read the raw `SKILL.md` text of a skill by name regardless of parse success (distinct from `canonical_skills_read`, which errors), and to write raw `SKILL.md` text verbatim by name; verification is a Rust round-trip test: read raw broken text → write corrected text → `parse_skill_md` succeeds, and an unchanged broken round-trip still reads back broken.
- [x] 5.2 Implement `SkillEditor` raw mode: when the selected entry is broken, render a raw `<textarea>` with the full `SKILL.md` text and re-validate with the backend on save — a parseable save clears the broken state and makes the skill pushable, a still-invalid save keeps it broken and shows the parse error; verification is manual review in `npm run tauri dev`.
- [x] 5.3 Route a broken-entry selection from `SkillList` / `SkillsPage` into the editor raw mode (broken entries are currently non-editable); verification is component review plus `npm run check`.
- [x] 5.4 [P] Add i18n keys for raw-mode and broken-skill UI text in `en.ts` and `zh-TW.ts` (no hardcoded display strings); verification is `npm run check` (TranslationDict alignment).

## 6. Safety boundary and audit

- [x] 6.1 Enforce No automatic cleanup for already corrupted files: apply changes do not touch existing agent-native or canonical files except through an explicit user action (import or raw-mode save); verification is code review against the design Non-Goals.
- [x] 6.2 Re-run `$spectra-audit harden-skill-import-frontmatter-validation` covering the new raw read/write commands, import-as-broken write, and editor raw mode because they read and write user filesystem skill files; verification is audit findings recorded or explicitly noted as none.

## 6. Canonical identity alignment

- [x] 6.3 Implement **Directory name as canonical skill identity** for Initial Skill Import so parseable imports rewrite a mismatched frontmatter `name` to the source folder name before writing canonical storage; verification is a Rust regression test covering `name != source dir` import and asserting the written canonical `SKILL.md` uses the directory identity.
- [x] 6.4 Implement **Stable canonical-id actions across read, push, repair, and delete** for a broken canonical skill and parseable mismatch cases so Skills list selection, `canonical_skills_read`, push, raw repair, and delete keep targeting the canonical directory identity instead of `frontmatter.name`; verification is backend/frontend regression coverage plus `npm run check`.
- [x] 6.5 Preserve app actionability for a canonical skill with mismatched frontmatter name and directory so the user can still delete the skill from the app and does not hit a stuck push/delete/read state; verification is a regression test or component contract review that exercises delete and read against a mismatched canonical skill.

## 7. Final verification

- [x] 7.1 Run `cargo test commands::skill_import` and the fan-out push-guard test from `src-tauri/` and confirm all regression tests pass; verification is exit code 0.
- [x] 7.2 Run `cargo build` from `src-tauri/` to confirm modified Rust commands compile in the Tauri backend; verification is exit code 0 (or documented external lock on `felina.exe`, lib build clean).
- [x] 7.3 Run `npm run check` to confirm frontend TypeScript, import candidate typing, wizard rendering, editor raw mode compile; verification is exit code 0 or documented pre-existing baseline-only failures.
- [x] 7.4 Run `npm run tauri dev` and manually verify: a malformed source imports as a broken skill, the broken skill cannot be pushed, the broken or mismatched-name skill can still be deleted from the app, the editor raw mode repairs it to a pushable state without changing the canonical identity, `smoke-nested` with repaired YAML `name: real` is normalized to `name: smoke-nested` and pushes to `smoke-nested/`, and a valid BOM + CRLF Anthropic skill still imports cleanly; verification is manual assertion recorded in apply notes.
- [x] 7.5 Run `spectra analyze harden-skill-import-frontmatter-validation --json` and `spectra validate harden-skill-import-frontmatter-validation`; verification is no Critical or Warning analyzer findings and validation exit code 0.

## 8. Canonical identity lifecycle corrections

- [x] 8.1 Implement **Canonical identity lifecycle for new and existing skills** so new skill creation uses the initial form `name` to create the canonical directory once, while structured saves for existing skills keep writing to the existing canonical directory identity and normalize `frontmatter.name` to that identity instead of creating/selecting a second skill; verification is frontend/backend regression coverage plus `npm run check`.
- [x] 8.2 Implement **Editor raw repair mode** name normalization so a raw repair of `~/.felina/skills/smoke-nested/SKILL.md` whose YAML parses with `name: real` saves as `name: smoke-nested`, remains selected/actionable as `smoke-nested`, and does not create `~/.felina/skills/real/`; verification is a Rust or frontend regression test plus manual review.
- [x] 8.3 Implement **Fan-out output folders use canonical identity** so pushing a canonical directory `smoke-nested` with parsed or previously-stored `frontmatter.name: real` writes to the target `smoke-nested/` folder and not `real/`; verification is a fan-out regression test.
- [x] 8.4 Add the visible advisory for automatic YAML `name` normalization in raw repair and structured save flows, using `en.ts` and `zh-TW.ts` i18n keys and not translating user-authored names or paths; verification is `npm run check` and manual UI review.
- [x] 8.5 Re-run `cargo test --lib` or the narrowest relevant Rust scopes plus `npm run check` after the identity lifecycle corrections; verification is exit code 0 or documented baseline-only warnings.

## 9. Stable canonical identity for target mutation and deep-link

- [x] 9.1 Implement **Target list mutation uses canonical identity** (addresses Decision: Stable canonical-id actions across read, push, repair, delete, and target mutation) so SkillsPage passes the canonical directory identity (not parsed `frontmatter.name`) to `<TargetEditor>` as `skillName`, and so `TargetEditor`'s three backend calls (`skill_targets_set`, `skill_prune_orphans_scan`, `skill_prune_orphans_apply`) operate against the canonical sidecar; verification is a Rust regression test that `skill_targets_set` succeeds against a canonical skill whose `frontmatter.name` differs from its directory identity, plus `npm run check`.
- [x] 9.2 Implement **SkillsPage deep-link consumer matches by canonical identity** so the `?select=<id>` effect resolves the entry by `skillListEntryCanonicalId(e) === want` instead of `e.skill.name === want`; verification is a frontend regression or component review plus `npm run check`.
- [x] 9.3 Verify and document **`ManagedInventory` row identity is intentionally unchanged** for this change: rows in the Projects view continue to display parsed `frontmatter.name`, matching the editor's disabled name field. Capture this in apply notes plus the design Non-Goals; do NOT modify `ManagedInventory.tsx` row identity. Verification is a manual review note recorded against `src/lib/components/projects/ManagedInventory.tsx`.

## 10. Broken skill deletion and disk-path escape hatch

- [x] 10.1 Implement **Broken canonical skill deletion from raw repair mode** (addresses Decision: Broken canonical skill deletion from raw repair mode) so `SkillEditor` accepts an `onDelete` prop in raw mode and renders a Delete button alongside Save; activating it routes through the same `ConfirmDialog` and `canonical_skills_delete` call the structured editor uses, keyed on the canonical directory identity carried by `brokenRaw`; verification is a frontend regression or component review plus `npm run check`.
- [x] 10.2 [P] Implement **Disk-path escape hatch via "Open in folder" buttons** for the raw repair editor (addresses Decision: Disk-path escape hatch via "Open in folder" buttons) so the editor header shows the canonical `SKILL.md` path and an icon button that calls `tauri-plugin-shell`'s `open` against the canonical directory; verification is a manual review in `npm run tauri dev`.
- [x] 10.3 [P] Implement **Disk-path escape hatch via "Open in folder" buttons** for `TargetEditor` per-row so each target row resolves its fan-out destination (`<target>/<canonical-id>/`) and exposes an icon button that calls `tauri-plugin-shell`'s `open` against that path. The button SHALL be disabled with a tooltip when the destination does not exist on disk; verification is a manual review in `npm run tauri dev`.
- [x] 10.4 [P] Add i18n keys for the Delete button in raw mode, the canonical-path label, the "Open in folder" / "Open target folder" buttons, and their tooltips (disabled state) in `en.ts` and `zh-TW.ts`; verification is `npm run check` (TranslationDict alignment).
- [x] 10.5 Add `@tauri-apps/plugin-shell` (already loaded in `lib.rs`) to `package.json` dependencies if not already present, and expose an `openPath(path)` frontend helper consumed by raw repair editor and `TargetEditor`; verification is `npm run check` (no new runtime dependency added at the Rust side; the plugin is already registered).

## 11. Final re-verification

- [x] 11.1 Run `cargo test --lib` or the narrowest relevant Rust scopes covering canonical skills + fan-out + skill import; verification is exit code 0 or documented baseline-only warnings.
- [x] 11.2 Run `npm run check`; verification is exit code 0.
- [x] 11.3 Run `spectra analyze harden-skill-import-frontmatter-validation --json` and `spectra validate harden-skill-import-frontmatter-validation`; verification is no Critical or Warning analyzer findings and validation exit code 0.
- [x] 11.4 Run `npm run tauri dev` and manually verify the combined behavior: toggling Tracked/Disabled on a name-vs-directory mismatched skill succeeds; deleting a `Broken` skill from raw mode removes the canonical directory; the deep-link from Projects opens a mismatched skill correctly; the raw editor's Open-in-folder button opens `~/.felina/skills/<canonical-id>/`; a `TargetEditor` row's Open-target-folder button opens the resolved fan-out destination and is disabled when missing. Verification is manual assertions recorded in apply notes.
