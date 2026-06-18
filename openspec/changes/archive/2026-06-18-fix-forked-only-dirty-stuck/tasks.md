## 1. Baseline

- [x] 1.1 執行 `npm run check` 和 `cargo test --lib`（在 `src-tauri/`），記錄現有結果作為 baseline。驗證：兩者皆通過，無 pre-existing failure

## 2. 測試先行

- [x] 2.1 在 `src-tauri/src/commands/canonical_skills.rs` 的測試模組新增單元測試 `test_dirty_not_set_for_forked_only`：建立一個只有 Forked target 的 skill，模擬 repoint 或 rename 後的 dirty 設定邏輯，斷言 `has_pushable_target` 回傳 `false`。驗證：測試在修正前失敗（因為 `has_pushable_target` 尚不存在）
- [x] [P] 2.2 新增單元測試 `test_dirty_set_for_mixed_targets`：建立一個有 Auto + Forked target 的 skill，斷言 `has_pushable_target` 回傳 `true`。驗證：測試在修正前失敗

## 3. 核心實作（滿足 Requirement: Dirty Flag Excludes Forked-Only Skills）

- [x] 3.1 在 `src-tauri/src/commands/canonical_skills.rs` 新增 `has_pushable_target(targets: &[SkillTarget]) -> bool` helper，回傳是否有任何 `enabled && matches!(mode, Auto | Manual)` 的 target。修改 `skill_target_repoint` 函式中 `meta.dirty = true` 為 `meta.dirty = has_pushable_target(&meta.targets)`。修改 `canonical_skill_rename` 函式中 `updated_meta.dirty = true` 為 `updated_meta.dirty = has_pushable_target(&updated_meta.targets)`。驗證：task 2.1 和 2.2 的測試通過

## 4. 驗證（Problem A）

- [x] 4.1 執行 `cargo test --lib` 於 `src-tauri/`，確認新增測試與既有測試全數通過。驗證：exit code 0，無 failure
- [x] 4.2 執行 `npm run check`，確認 TypeScript 無 error。驗證：exit code 0

## 5. 測試先行（Problem B：preview 清除既有卡住的 dirty）

- [x] 5.1 在 `src-tauri/src/commands/fan_out/mod.rs` 測試模組新增單元測試 `preview_clears_stuck_dirty_when_all_noop_or_skipped`：建立一個 `dirty = true` 的 skill，有一個 Manual target（rendered 與 last_sync `pushed_hash` 相同 → NoOp）加一個 Forked target（→ Skipped），呼叫 `skill_sync_preview`（經由 `build_preview_for_skill`）後重新讀取 sync-meta，斷言 `meta.dirty == false`。驗證：測試在修正前失敗（dirty 仍為 true）
- [x] [P] 5.2 在同一測試模組新增單元測試 `preview_keeps_dirty_when_pending_write_exists`：建立一個 `dirty = true` 的 skill，有一個 Manual target 其 rendered 輸出與磁碟現況不同（→ Overwrite），呼叫 preview 後重新讀取 sync-meta，斷言 `meta.dirty` 仍為 `true`。驗證：修正後仍通過（防回歸：有待寫項時不得清 dirty）

## 6. 核心實作（Problem B，滿足 Requirement: Push Preview Clears Stale Dirty When Nothing To Sync）

- [x] 6.1 在 `src-tauri/src/commands/fan_out/mod.rs` 的 `build_preview_for_skill` 內，於 items 與 summary 計算完成後加入 dirty 自我修復：當傳入的 `meta.dirty == true` 且所有 items 的 `operation` 皆為 `SkillSyncPreviewOperation::NoOp` 或 `SkillSyncPreviewOperation::Skipped`（無任何 Create/Overwrite/BlockedDrift/OverwriteUnknown）時，將 `meta.dirty` 設為 `false` 並以 `write_sync_meta_v2(canonical_skill_dir, &meta)` 持久化。`build_preview_for_skill` 目前以 `&SyncMetaV2` 借入，需調整簽章為可寫入路徑（傳 `&mut SyncMetaV2`），並同步更新 `skill_sync_preview`（呼叫點）與 `skill_sync_commit`（呼叫點）兩處傳入 mutable 借用。驗證：task 5.1、5.2 測試通過
- [x] 6.2 確認 `skill_sync_commit` 在呼叫 `build_preview_for_skill` 後，仍以自身 commit 結尾依 Auto/Manual `last_sync` 重算 `meta.dirty` 的邏輯為最終值，preview 的自我修復不得與 commit 的重算衝突或造成 double-write 競態。驗證：既有 commit 相關測試（`cargo test --lib`）全數通過，無回歸

## 7. 驗證（Problem B）

- [x] 7.1 執行 `cargo test --lib` 於 `src-tauri/`，確認 Problem A 與 Problem B 的新增測試與既有測試全數通過。驗證：exit code 0，無 failure
- [x] 7.2 執行 `npm run check`，確認 TypeScript 無 error。驗證：exit code 0

## 8. 前端刷新（Problem B 的使用者端收尾）

實機回報：後端 self-heal 已把 disk `dirty` 清為 `false`，但前端 preview 之後未重載清單，徽章（`SkillList.tsx` 的 `skill.dirty` 紅點 / `PendingPushBar` 的 dirtyCount）仍用記憶體舊資料，使用者看起來像「沒清掉」，需重啟或觸發其他重載動作才消失。

- [x] 8.1 在 `src/lib/components/skills/PendingPushBar.tsx` 的「Push all」流程，`previewAll()` 之後加 `await loadEntries()`，讓 self-heal 清掉的 dirty 反映到 bar。驗證：`npm run check` 通過
- [x] 8.2 在 `src/lib/components/skills/SkillsPage.tsx` 的 `handlePushOne`，`preview()` 之後加 `await loadEntries()`，讓單一 skill 紅點即時刷新。驗證：`npm run check` 通過
