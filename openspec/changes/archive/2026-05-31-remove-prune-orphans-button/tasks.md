## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量，作為本 change 前後比較基準。驗證：記錄輸出結果。

## 2. 後端移除（Explicit Orphan Prune requirement）

- [x] [P] 2.1 移除 Explicit Orphan Prune 後端實作：從 `src-tauri/src/commands/canonical_skills.rs` 移除 `OrphanFile` struct、`skill_prune_orphans_scan` function、`skill_prune_orphans_apply` function，以及所有相關的 orphan prune 單元測試（`orphan_scan_detects_removed_target`、`orphan_scan_preserves_disabled_tracked_and_flags_detached`、`orphan_apply_deletes_confirmed_and_preserves_others`、`orphan_scan_returns_empty_for_no_agent_files`）。驗證：`cargo build -p felina` 在 `src-tauri/` 通過，grep `prune_orphans` 在 `canonical_skills.rs` 中無結果。
- [x] [P] 2.2 從 `src-tauri/src/lib.rs` 的 `invoke_handler!` 移除 `skill_prune_orphans_scan` 與 `skill_prune_orphans_apply` 兩個 command 註冊。驗證：`cargo build -p felina` 通過。

## 3. 前端 Bridge 與 Types 移除

- [x] [P] 3.1 從 `src/lib/tauri/commands.ts` 移除 `skillPrune` wrapper（`scan` 與 `apply` 兩個函式）。驗證：`npm run check` 通過，grep `skillPrune` 在 `commands.ts` 中無結果。
- [x] [P] 3.2 從 `src/lib/types/skills.ts` 移除 `OrphanFile` interface，從 `src/lib/types/index.ts` 移除 `OrphanFile` re-export。驗證：`npm run check` 通過，grep `OrphanFile` 在 types 目錄下無結果。

## 4. 前端 UI 移除（Explicit Target Removal Policy — 移除 orphan prune 引用）

- [x] 4.1 更新 Explicit Target Removal Policy 前端：從 `src/lib/components/skills/TargetEditor.tsx` 移除「清除孤立檔案」按鈕及其所有關聯邏輯：`pruneOrphans` state、`setPruneOrphans`、`pruneMessage` state、scan handler、apply handler、ConfirmDialog、以及 `OrphanFile` import。移除後 TargetEditor 不再提供手動 orphan 掃描/刪除功能，使用者透過「刪除 target → 移除 target 並刪除檔案」達成相同目的。驗證：`npm run check` 通過，grep `pruneOrphan\|prune_orphan\|OrphanFile` 在 `TargetEditor.tsx` 中無結果。

## 5. i18n 清理

- [x] [P] 5.1 從 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 移除 `skills.targets.pruneOrphans`、`skills.targets.noOrphans`、以及 prune confirm dialog 相關 keys（`skills.confirm.prune.*`）。驗證：`npm run check` 通過（TranslationDict type 強制 en/zh-TW 結構對齊，缺 key 會 compile error），grep `pruneOrphan\|noOrphan` 在 locales 目錄下無結果。

## 6. 驗證

- [x] 6.1 執行 `npm run check`，確認 TypeScript errors/warnings 數量與 baseline（task 1.1）相比無新增。驗證：`npm run check` 零 error 通過。
- [x] 6.2 執行 `cargo test --lib -p felina`，確認 Rust 單元測試全部通過且無 orphan prune 相關測試殘留。驗證：測試全通過，grep `orphan_scan\|orphan_apply` 在測試輸出中無結果。
- [x] 6.3 `npm run tauri dev` 手動驗證：(1) TargetEditor 頁面載入正常、無「清除孤立檔案」按鈕；(2) 新增/刪除 target 流程正常運作；(3) Push sync 流程正常運作（orphan sibling 自動清理不受影響）。驗證：三項行為皆符合預期。
