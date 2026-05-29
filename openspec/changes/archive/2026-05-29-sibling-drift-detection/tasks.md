## 1. 準備與基線

- [x] 1.1 執行 `npm run check` 和 `cargo test --lib` 紀錄現有狀態作為後續驗證基準。

## 2. 後端：Sync Meta 擴展

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 的 `LastSync` struct 新增 `sibling_hashes: HashMap<String, String>` 欄位，加上 `#[serde(default)]` 確保既有 meta 反序列化不報錯。驗證方式：`cargo test --lib` 通過，既有測試不因新增欄位而失敗。

## 3. 後端：Push 寫入 sibling hashes

- [x] 3.1 在 `src-tauri/src/commands/fan_out/mod.rs` 的 push 流程中（`skill_sync_one` 或 `copy_bundled_siblings` 之後），遍歷已複製的 sibling 檔案，計算每個檔案的 raw SHA-256 hash，以正斜線相對路徑為 key 寫入 `last_sync.sibling_hashes`。排除 `SKILL.md` 和 `.felina-sync-meta.json`。驗證方式：新增 Rust 單元測試 — push 包含 sibling 的 skill 後，讀取 sync meta 確認 `sibling_hashes` 包含正確的 key/value。

## 4. 後端：check_drift 擴展

- [x] [P] 4.1 在 `check_drift()` 中新增 sibling 比對邏輯：讀取 agent 端 skill 目錄下所有非 SKILL.md、非 sidecar 檔案，計算 raw SHA-256，與 `sibling_hashes` 比對。新增、刪除或內容變動皆回傳 drifted。若 `sibling_hashes` 為空 map（既有 meta），跳過 sibling 比對。驗證方式：新增 Rust 單元測試覆蓋四個 scenario — sibling 修改/刪除/新增/既有 meta 無 sibling_hashes。
- [x] [P] 4.2 確認 `skill_drift_scan`（batch scan）在 rayon 平行執行時，sibling hash 計算包含在同一個 work unit 內，不需要額外的平行化。驗證方式：`cargo test --lib` 通過。

## 5. 前端：drift badge 反映 sibling 變動

- [x] 5.1 確認前端 `DriftStatus` 型別和 `driftMap` store 不需要修改（因為 `DriftStatus` enum 不變，sibling drift 合併進 `drifted`）。若回傳結構有變動則更新 `src/lib/types.ts` 和 `src/lib/tauri/commands.ts`。驗證方式：`npm run check` 通過。
- [x] 5.2 在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 確認現有 drift 相關 i18n key 的措辭是否需要調整（例如從「SKILL.md has drifted」改為更泛化的描述）。若需要則更新。驗證方式：`npm run check` 通過。

## 6. 驗證與封裝

- [x] 6.1 執行 `npm run check` 和 `cargo test --lib`，確保沒有引入新的錯誤。
- [x] 6.2 執行 `npm run tauri dev` 進行端對端手動驗證：push 一個包含 sibling 的 skill，然後在 agent 端修改/刪除/新增 sibling，確認 drift badge 正確反映。
