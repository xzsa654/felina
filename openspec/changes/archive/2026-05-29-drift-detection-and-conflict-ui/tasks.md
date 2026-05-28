## 1. Baseline

- [x] 1.1 Run baseline `npm run check` and `cargo test` from `src-tauri/`; record results for comparison against final verification.

## 2. Shared Drift Check Function

- [x] 2.1 Extract a `check_drift` function in `src-tauri/src/commands/fan_out/mod.rs` that takes an agent-side SKILL.md path and a `pushed_hash` string, reads the file, computes `semantic_hash`, and returns a `DriftStatus` enum (`Synced`, `Drifted`, `Missing`, `NoPushHistory`); verification is a Rust unit test that asserts each status variant for matching hash, mismatched hash, missing file, and absent push history.
- [x] 2.2 Refactor `build_preview_for_skill` in `src-tauri/src/commands/fan_out/mod.rs` to call `check_drift` for the initial hash comparison instead of inline logic; verification is all existing `fan_out` tests passing with no behavior change.

## 3. Drift Scan Performance Optimization

- [x] 3.0a Add `rayon` as a dependency in `src-tauri/Cargo.toml`; verification is `cargo check` passing.
- [x] 3.0b Update `check_drift` in `src-tauri/src/commands/fan_out/mod.rs` to accept the `last_sync.at` ISO-8601 timestamp, compare the agent-side file's filesystem mtime against it, and return `Synced` immediately when mtime ≤ push timestamp without reading file content; verification is a Rust unit test that asserts `check_drift` returns `Synced` for a file whose mtime predates the push timestamp and does NOT compute `semantic_hash`.
- [x] 3.0c Update `skill_drift_scan` to use `rayon::par_iter` for targets that pass the mtime fast path and require hash computation; verification is a Rust test confirming the scan result is identical to sequential execution.

## 4. Batch Drift Scan API

- [x] 4.1 Implement `skill_drift_scan` as a `#[tauri::command]` in `src-tauri/src/commands/fan_out/mod.rs` that iterates all canonical skills, reads each skill's sync-meta, calls `check_drift` for each enabled tracked target, and returns a `BTreeMap<String, BTreeMap<String, DriftStatus>>` keyed by skill name then target key; verification is a Rust integration test that sets up two skills with synced and drifted targets and asserts the scan result map.
- [x] 4.2 Register `skill_drift_scan` in `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs` invoke_handler; add a typed frontend wrapper `api.driftScan.scan()` in `src/lib/tauri/commands.ts` and `DriftStatus` type in `src/lib/types/skills.ts`; verification is `npm run check` and `cargo check`.

## 5. Frontend Drift State Store

- [x] [P] 5.1 Add `driftMap: Record<string, Record<string, DriftStatus>>` and `refreshDriftScan(): Promise<void>` to the skills store in `src/lib/stores/skills-store.ts`; `refreshDriftScan` calls `api.driftScan.scan()` and stores the result; verification is `npm run check`.
- [x] [P] 5.2 Add i18n keys for drift status labels (`drifted`, `missing`, `synced`) and the drift badge tooltip in `src/lib/i18n/locales/en.ts` and `src/lib/i18n/locales/zh-TW.ts`; verification is `npm run check` confirming TranslationDict parity.

## 6. CoverageMatrix Drifted State

- [x] 6.1 Update `cellSyncState` in `src/lib/components/skills/CoverageMatrix.tsx` to check the drift scan result from the skills store and return a `drifted` state when the drift map reports drifted for the skill-target pair; add a visual indicator using `text-warning` semantic color; verification is manual Tauri validation that a drifted target shows the warning indicator in the matrix.

## 7. TargetEditor Drift Indicator

- [x] 7.1 Update `src/lib/components/skills/TargetEditor.tsx` to read the drift scan result from the skills store and display a drift badge on target rows where the drift map reports drifted; the badge SHALL use `text-warning` semantic color and be visible without expanding or hovering; verification is manual Tauri validation that a drifted target row shows the badge.

## 8. Drift Scan Trigger

- [x] 8.1 In `src/lib/components/skills/SkillsPage.tsx`, call `refreshDriftScan()` after the initial `loadEntries()` on mount, after `handleReload()`, and on a `visibilitychange` event listener (when `document.visibilityState === 'visible'`); verification is manual Tauri validation that modifying an agent-side SKILL.md externally and then refocusing the app window updates the CoverageMatrix to show drifted.

## 9. Verification

- [x] 9.1 Run `npm run check` and compare with baseline; verification is no new TypeScript errors.
- [x] 9.2 Run `cargo test` from `src-tauri/` and compare with baseline; verification is no new test failures and new drift tests passing.
- [x] 9.3 Run `npm run tauri dev` and manually verify end-to-end: (a) push a skill to a target, (b) externally edit the agent-side SKILL.md, (c) refocus the app, (d) CoverageMatrix shows drifted indicator, (e) TargetEditor shows drift badge, (f) push preview still shows BlockedDrift with Override/Detach options.
