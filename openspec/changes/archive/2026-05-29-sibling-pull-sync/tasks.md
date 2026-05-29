## 1. 準備與基線

- [x] 1.1 執行 `npm run check` 和 `cargo test --lib` 紀錄現有狀態作為基準。確認 `sibling-drift-detection` 已完成（sync meta 含 `sibling_hashes: Option<BTreeMap<String, String>>` 欄位、`compute_sibling_hashes` helper 可用）。

## 2. 後端：Pull preview 擴展

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 新增 `SiblingChange` struct（`path: String`, `status: SiblingStatus`）和 `SiblingStatus` enum（Added / Modified / Deleted / Conflict）。在 `PullDiffPreview` 回傳結構新增 `sibling_changes: Vec<SiblingChange>` 欄位。驗證方式：`cargo test --lib` 通過。
- [x] 2.2 在 `skill_pull_preview()` 中，讀取 `last_sync_entry.sibling_hashes`（`Option<BTreeMap>`），若為 `None`（legacy）則 `sibling_changes` 為空。若為 `Some(pushed_map)`，使用 `compute_sibling_hashes` 分別算 canonical 端和 agent 端的當前 hash，與 `pushed_map` 三方比對產生 `sibling_changes`。邏輯：agent 端有但 pushed 沒有 → Added；pushed 有但 agent 端沒有 → Deleted；agent hash ≠ pushed hash 且 canonical hash == pushed hash → Modified；agent hash ≠ pushed hash 且 canonical hash ≠ pushed hash → Conflict。驗證方式：新增 Rust 單元測試覆蓋 Added / Modified / Deleted / Conflict / legacy `None` / empty `Some({})` 六個 scenario。

## 3. 後端：Pull 執行擴展

- [x] 3.1 在 `skill_pull_from_target()` 新增 `sibling_resolutions` 參數（`Vec<SiblingResolution>`），定義衝突項目的解決策略（UseAgent / UseCanonical / Skip）。非衝突項目按預設行為處理（Added → 複製、Modified → 覆蓋、Deleted → 刪除）。Pull 完成後更新 sync meta 的 `sibling_hashes` 為 `Some(compute_sibling_hashes(canonical_skill_dir))`，反映 pull 後 canonical 狀態。驗證方式：新增 Rust 單元測試 — pull 後 canonical 目錄包含新增的 sibling、已刪除的 sibling 消失、衝突項目按 resolution 處理、sync meta `sibling_hashes` 更新為 canonical 當前狀態。

## 4. 前端：型別與 commands 擴展

- [x] [P] 4.1 在 `src/lib/types/skills.ts` 新增 `SiblingChange` 和 `SiblingStatus` 型別，擴展 `PullDiffPreview` 包含 `siblingChanges`。在 `src/lib/tauri/commands.ts` 的 pull 相關 wrapper 中傳遞 `siblingResolutions` 參數。驗證方式：`npm run check` 通過。
- [x] [P] 4.2 在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 新增 sibling pull 相關 i18n key（Added / Modified / Deleted / Conflict 狀態文字、衝突解決選項文字）。驗證方式：`npm run check` 通過。

## 5. 前端：PullConfirmDialog 擴展

- [x] 5.1 在 `src/lib/components/skills/PullConfirmDialog.tsx` 中，SKILL.md diff 預覽下方新增 sibling 變動區塊：列出每個 sibling 的路徑和狀態 icon。衝突項目提供選擇（以 agent 端為準 / 以 canonical 端為準 / 跳過），使用者確認時將 resolutions 傳入 pull command。驗證方式：`npm run check` 通過，手動驗證 UI 顯示正確。

## 6. 驗證與封裝

- [x] 6.1 執行 `npm run check` 和 `cargo test --lib`，確保無新錯誤。
- [x] 6.2 執行 `npm run tauri dev` 進行端對端手動驗證：在 agent 端新增/修改/刪除 sibling，pull preview 顯示正確差異，確認 pull 後 canonical 目錄狀態正確。
