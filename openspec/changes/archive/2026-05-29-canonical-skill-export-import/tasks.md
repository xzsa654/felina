## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings 數量，作為後續驗證的 baseline。驗證：記錄輸出結果，確認 error count

## 2. 後端：skill_library 模組

- [x] [P] 2.1 新增 `zip` crate 依賴至 `src-tauri/Cargo.toml`。行為：`cargo build` 在 `src-tauri/` 成功編譯且可 `use zip::*`。驗證：`cargo build` 通過
- [x] [P] 2.2 建立 `src-tauri/src/commands/skill_library.rs` 並在 `src-tauri/src/commands/mod.rs` 註冊模組。行為：模組可被其他 command 引用。驗證：`cargo build` 通過
- [x] 2.3 實作 `skill_library_export` command（Requirement: Export all canonical skills as ZIP）。行為：遍歷 `~/.felina/skills/` 下所有 skill 目錄，將每個 skill 的 SKILL.md 及子目錄/檔案寫入 ZIP，排除 `.felina-sync-meta.json` 和 `.git/`。接收 `output_path: String` 參數（前端透過 Tauri save dialog 取得）。skill 庫為空時回傳錯誤。驗證：撰寫 Rust 單元測試 — (a) 含子目錄的 skill 正確打包、(b) `.felina-sync-meta.json` 和 `.git/` 被排除、(c) 空庫回傳 error
- [x] 2.4 實作 `skill_library_import` command（Requirement: Import skills from ZIP）。行為：讀取 ZIP 檔，將每個頂層目錄解壓至 `~/.felina/skills/`。跳過不含 `SKILL.md` 的目錄。同名 skill 直接覆寫。不寫入 `.felina-sync-meta.json`。回傳 `{ imported: usize, skipped: usize }`。驗證：撰寫 Rust 單元測試 — (a) 正常匯入含子目錄的 skill、(b) 缺 SKILL.md 的目錄被跳過、(c) 同名覆寫正確、(d) 不產生 `.felina-sync-meta.json`
- [x] 2.5 實作 `skill_library_reset` command（Requirement: Reset skill library）。行為：刪除 `~/.felina/skills/` 下所有內容（含 `.git/`），保留 `~/.felina/skills/` 目錄本身。回傳 `{ deleted: usize }`（刪除的 skill 數量）。驗證：撰寫 Rust 單元測試 — (a) 刪除所有 skill 目錄和 `.git/`、(b) `~/.felina/skills/` 目錄仍存在、(c) 回傳正確刪除數量
- [x] 2.6 在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊 `skill_library_export`、`skill_library_import`、`skill_library_reset` 三個 commands。驗證：`cargo build` 通過，三個 command 可被前端 invoke

## 3. 前端：commands wrapper + types

- [x] [P] 3.1 在 `src/lib/tauri/commands.ts` 新增 `skillLibraryExport(outputPath: string)`、`skillLibraryImport(inputPath: string)`、`skillLibraryReset()` 三個 invoke wrapper，以及 `SkillLibraryImportResult` 和 `SkillLibraryResetResult` TypeScript 型別。驗證：`npm run check` 通過，型別與後端回傳結構對齊

## 4. 前端：SkillLibrarySection 元件

- [x] 4.1 新增 `src/lib/components/settings/SkillLibrarySection.tsx`（Requirement: Skill Library section in Felina Settings）。行為：顯示 section 標題、目前 canonical skill 數量、三個操作按鈕（Export 用 Download icon、Import 用 Upload icon、Reset 用 Trash2 icon）。Reset 按鈕使用 danger 語意色。驗證：`npm run check` 通過
- [x] 4.2 實作 Export 功能。行為：點擊 Export 按鈕後呼叫 Tauri save dialog（預設檔名 `felina-skills-backup.zip`），使用者選擇路徑後呼叫 `skillLibraryExport`，成功顯示 toast/訊息，失敗顯示錯誤。驗證：`npm run check` 通過
- [x] 4.3 實作 Import 功能。行為：點擊 Import 按鈕後呼叫 Tauri open dialog（篩選 `.zip`），使用者選擇檔案後呼叫 `skillLibraryImport`，成功顯示匯入/跳過數量，失敗顯示錯誤。驗證：`npm run check` 通過
- [x] 4.4 實作 Reset 功能。行為：點擊 Reset 按鈕後顯示確認 dialog，警告所有 skill 將被永久刪除並建議先匯出。使用者確認後呼叫 `skillLibraryReset`，顯示刪除數量。取消則不做任何事。驗證：`npm run check` 通過
- [x] 4.5 在 `FelinaSettingsPage.tsx` 掛載 `<SkillLibrarySection />`，滿足 Felina Settings Page requirement 中新增的 Skill Library section。驗證：`npm run check` 通過

## 5. i18n

- [x] [P] 5.1 在 `src/lib/i18n/locales/en.ts` 和 `src/lib/i18n/locales/zh-TW.ts` 新增 `felinaSettings.skillLibrary` namespace 下的所有 i18n keys：section 標題、描述、按鈕文字、確認 dialog 文案、成功/失敗訊息、空庫提示。驗證：`npm run check` 通過（TypeScript TranslationDict 強制 en/zh-TW 結構對齊）

## 6. 驗證

- [x] 6.1 `npm run check` 通過，error count 與 baseline 一致（未引入新 error）
- [x] 6.2 `cargo build` 在 `src-tauri/` 通過
- [x] 6.3 `cargo test --lib` 在 `src-tauri/` 通過，含本 change 新增的 export/import/reset 單元測試
- [x] 6.4 `npm run tauri dev` 手動驗證：(a) Felina Settings 頁面顯示 Skill Library section 及 skill 數量、(b) Export 產出 ZIP 且內容正確（含子目錄、不含 `.felina-sync-meta.json`）、(c) Import ZIP 後 skill 正確還原且 sync meta 自動 backfill、(d) Reset 清空所有 skill 後數量歸零、(e) Reset 前確認 dialog 正常顯示，取消不刪除
