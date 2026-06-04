## 1. Baseline 與刪除資格契約

- [x] 1.1 執行 baseline `npm run check`，記錄實作前 TypeScript errors / warnings，讓最終驗證可區分本 change 新引入問題與 pre-existing 狀態；驗證方式：命令輸出與退出碼已記錄於 apply 工作紀錄。
- [x] [P] 1.2 實作前端 canonical Cascade eligibility 純函式，使 enabled `auto` / `manual` / legacy `tracked` 回傳 eligible，disabled / `detached` / `forked` 回傳 ineligible，落實 **Canonical cascade eligibility uses enabled managed targets** 與 **Frontend eligibility is a reusable pure helper**；驗證方式：`tests/sync-status-utils.test.ts` 的 node:test 覆蓋六種 mode / enabled 組合並通過。
- [x] [P] 1.3 調整後端 `canonical_skills_delete_with_policy` 的 target directory resolution，使 Cascade 只解析 enabled `TargetMode::Auto | TargetMode::Manual`，且 legacy `tracked` 經既有 serde alias 後仍 eligible，落實 **Backend remains authoritative for filesystem deletion**；驗證方式：`src-tauri/src/commands/canonical_skills.rs` 相關 Rust filesystem tests 證明 Auto / Manual 被刪除，disabled / detached / forked 被保留。

## 2. Explicit Canonical Delete Policy UI 對齊

- [x] 2.1 更新 `DeletePolicyDialog` 使用共用 eligibility 純函式，讓 Cascade count、target summary、preserved count 與 disabled state 對 enabled managed targets 一致，落實 `Explicit Canonical Delete Policy`；驗證方式：node:test 通過，且元件檢查確認不再直接硬編 `mode === "tracked"`。
- [x] 2.2 更新 English 與繁體中文 delete Dialog 文案，以「已啟用且受 Felina 管理」描述 Cascade eligibility，落實 **Delete dialog copy describes managed enabled targets**，且不翻譯 skill name、path 或 agent id；驗證方式：`npm run check` 透過 `TranslationDict` 確認兩語系 key 結構一致。

## 3. 整合驗證與安全審查

- [x] [P] 3.1 執行相關 node tests 與 `npm run check`，確認前端 eligibility、Dialog 使用方式與 i18n 無回歸，並與 task 1.1 baseline 比較；驗證方式：所有命令退出碼為 0，或清楚記錄僅有 pre-existing 問題。
- [x] [P] 3.2 執行相關 Rust tests 與 `cargo build`（工作目錄 `src-tauri/`），確認 policy-aware command、legacy alias 與 filesystem delete boundary 可編譯且測試通過；驗證方式：所有命令退出碼為 0。
- [x] 3.3 執行 `npm run tauri dev` 手動驗證 canonical delete Dialog 與實際檔案結果：Auto / Manual targets 列入摘要並由 Cascade 刪除，無 eligible targets 時 Cascade 反灰，disabled / detached / forked targets 保留；驗證方式：逐項記錄 UI count、按鈕狀態與磁碟結果。
- [x] 3.4 執行 `/felina-ui-guidelines` review，確認本 change 重用既有 Modal 與文件中心化操作風格，並將命中的 guideline 與 deviation 結論記入 archive notes；驗證方式：review 結論已記錄且無未處理 deviation。
- [x] 3.5 執行 `/spectra-audit align-canonical-delete-target-modes` 審查 destructive filesystem delete、target eligibility 與前後端摘要一致性；驗證方式：無未處理 Critical / Warning，或完成修正並重跑相關測試。
- [x] 3.6 執行 `spectra analyze align-canonical-delete-target-modes --json` 與 `spectra validate align-canonical-delete-target-modes`，確認 artifacts、spec coverage 與實作交付條件一致；驗證方式：無 Critical / Warning 且 validation 通過。
