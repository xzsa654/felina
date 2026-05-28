## 1. Baseline

- [x] 1.1 執行 baseline `npm run check`，記錄目前 TypeScript 結果，完成條件是 final verification 能確認本 change 沒新增 TypeScript errors。
- [x] 1.2 從 `src-tauri/` 執行 baseline Rust narrow check `cargo test skill_sync_all_preview --lib`；若 filter 目前沒有測試，記錄結果並在實作後新增對應測試。完成條件是 baseline 狀態可與 final Rust test 比對。

## 2. Backend Preview Filtering

- [x] 2.1 實作 Requirement: Pending-Push Sync State 的 Push all affected filtering：`skill_sync_all_preview` SHALL skip clean skills and skills without pushable tracked targets before building previews, so returned `SkillSyncAllPreview.skills` contains only dirty affected skills. Verification: add or update Rust tests in `src-tauri/src/commands/fan_out/mod.rs` proving a dirty skill is included while a clean skill and a dirty targetless skill are excluded.
- [x] 2.2 Ensure Push all summary matches filtered previews: the aggregated summary SHALL merge only included dirty affected previews, so summary counts cannot reflect clean or targetless skills. Verification: Rust test asserts the returned summary equals the operations from the included dirty skill only.
- [x] 2.3 Preserve existing per-skill preview behavior: `skill_sync_preview(name)` SHALL still preview the requested skill when invoked directly, regardless of whether Push all would include it. Verification: Rust test or existing test output confirms direct preview still works for a named dirty skill.

## 3. Frontend Dialog Behavior

- [x] 3.1 Update Push all dialog handling so `PendingPushBar` passes only backend-filtered preview entries to `SyncPreviewDialog` and does not reconstruct the full skill list on the frontend. Verification: `npm run check` passes and manual UI verification with one dirty skill shows only that skill in the confirmation dialog.
- [x] [P] 3.2 Review `SyncPreviewDialog` empty-state behavior for the filtered Push all result: if the preview array is empty because no dirty affected skills remain, the dialog SHALL not present a misleading full-skill list. Verification: content review plus `npm run check`; add localized empty copy only if current UI can surface an empty dialog.

## 4. Verification

- [x] 4.1 Run final frontend static gate `npm run check`; completion requires exit 0 or no new failures compared with baseline.
- [x] 4.2 From `src-tauri/`, run `cargo test skill_sync_all_preview --lib`; completion requires tests covering dirty-only Push all preview filtering to pass.
- [x] 4.3 Run `spectra analyze push-all-affected-list-bug --json` and `spectra validate push-all-affected-list-bug`; completion requires no unresolved Critical or Warning findings.
- [x] 4.4 Manually verify in `npm run tauri dev`: with exactly one dirty skill and at least one clean skill, Push all confirmation dialog lists only the dirty skill; after confirm, the dirty skill is pushed and clean skills are not shown as affected.
