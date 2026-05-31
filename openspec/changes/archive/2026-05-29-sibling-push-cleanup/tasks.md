## 1. 準備與基線

- [x] 1.1 執行 `npm run check` 和 `cargo test --lib` 紀錄現有狀態。確認 `sibling-drift-detection` 已完成（`LastSyncEntry.sibling_hashes: Option<BTreeMap<String, String>>`、`compute_sibling_hashes` helper 可用）。

## 2. 後端：Push 孤兒清除

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 的 push 流程中（`copy_bundled_siblings()` 之後），讀取舊 `sibling_hashes`（`Option<BTreeMap>`）。若為 `None`（legacy）或 `Some({})`（無 baseline）則跳過。若為 `Some(map)`，使用 `compute_sibling_hashes` 取 canonical 端現有 sibling，與 `map` 取差集，刪除 agent 端對應的孤兒檔案。刪除失敗時 log warning 但不中斷 push。驗證方式：新增 Rust 單元測試 — canonical 刪除 sibling 後 push，agent 端孤兒被清除。
- [x] 2.2 新增 Rust 單元測試：agent 端使用者手動新增的檔案（不在 baseline 中）不被刪除。
- [x] 2.3 新增 Rust 單元測試：`sibling_hashes` 為 `None`（legacy）時，push 不刪除任何 sibling。新增測試：`sibling_hashes` 為 `Some({})`（無 baseline）時，push 不刪除任何 sibling。

## 3. 後端：Push preview 擴展

- [x] 3.1 在 `SyncPreview` 回傳結構新增 `orphan_siblings: Vec<String>`。在 `skill_sync_preview()` 中計算孤兒清單（舊 baseline 中有但 canonical 端沒有的 sibling），填入 `orphan_siblings`。驗證方式：`cargo test --lib` 通過，新增測試確認 preview 包含正確的 orphan list。

## 4. 前端：SyncPreviewDialog 擴展

- [x] [P] 4.1 在 `src/lib/types/skills.ts` 的 `SkillSyncPreviewItem` 型別新增 `orphanSiblings: string[]`。在 `src/lib/tauri/commands.ts` 對應調整。驗證方式：`npm run check` 通過。
- [x] [P] 4.2 在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 新增 orphan sibling 相關 i18n key（如「以下檔案將從目標目錄移除」）。驗證方式：`npm run check` 通過。
- [x] 4.3 在 `src/lib/components/skills/SyncPreviewDialog.tsx` 中，當 `orphanSiblings` 非空時，在差異明細中顯示將被清除的 sibling 檔案清單。驗證方式：`npm run check` 通過，手動驗證 UI。

## 5. 驗證與封裝

- [x] 5.1 執行 `npm run check` 和 `cargo test --lib`，確保無新錯誤。
- [x] 5.2 執行 `npm run tauri dev` 進行端對端手動驗證：canonical 端刪除 sibling 後 push，確認 push preview 列出將清除的檔案，push 後 agent 端孤兒已刪除。
