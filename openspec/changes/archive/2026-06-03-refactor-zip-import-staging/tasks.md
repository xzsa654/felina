## 1. 建立基準與前置作業

- [x] 1.1 執行 `npm run check` 取得當前 TypeScript 檢查基準。驗證：命令完成並記錄現有 warnings/errors。

## 2. 後端實作：新增 `skill_import_scan_zip` 與移除舊指令

- [x] 2.1 實作 `skill_import_scan_zip` Tauri command，將 ZIP 解壓至系統暫存目錄並掃描 `SKILL.md`，過濾無效資料夾後回傳 `ImportCandidate`（滿足 `Import skills from ZIP` requirement 以及 Decision 1: 新增 `skill_import_scan_zip` Tauri 指令）。驗證：在 `src-tauri/src/commands/skill_import.rs` 成功編譯，且 `cargo test --lib` 執行通過。
- [x] 2.2 移除 `skill_library.rs` 內的 `skill_library_import` public Tauri command 與註冊，避免未來直接寫入 canonical 發生覆寫（滿足 Decision 2: 廢棄並移除 `skill_library_import`）。驗證：`cargo check --lib` 通過且沒有 dead code warning。
- [x] 2.3 在 `src-tauri/src/commands/mod.rs` 和 `src-tauri/src/lib.rs` 註冊新的 `skill_import_scan_zip` 指令並清理舊有註冊。驗證：`cargo check --lib` 在 `src-tauri` 目錄下執行成功無誤。

## 3. 前端實作：介接新 API 支援 Staging 流程

- [x] 3.1 於 `src/lib/tauri/commands.ts` 移除舊有的 `api.skillLibrary.import`，並新增對應 `skill_import_scan_zip` 的 wrapper 函式。驗證：`npm run check` 成功捕捉舊 API 被移除導致的 Type error。
- [x] 3.2 在 `ImportStagingDialog.tsx` 中，修改 `handleBrowseFiles` 以呼叫 `skill_import_scan_zip`，並將回傳結果更新至 `Discovered` 狀態。驗證：`npm run check` 執行無錯誤，表示 React 元件正確介接新的 API 型別。

## 4. 手動端對端驗證

- [x] 4.1 執行 `npm run tauri dev` 進行手動驗證。驗證：點擊匯入按鈕,選擇一個包含多個 skill 的 ZIP 檔,確認有效 skill 正確出現在右側 Staging 清單中(直送 staging,呼應 Decision 3),不寫入 `~/.felina/skills`,且不包含 `.felina-sync-meta.json`,完成 `Import skills from ZIP`、Decision 1、Decision 3 驗證。

## 5. Apply 階段 scope corrections（apply 過程實地發現,寫回 artifacts）

- [x] 5.1 移除 `src/lib/components/settings/SkillLibrarySection.tsx` 的 Import 按鈕 + `handleImport` handler + 未使用的 `open` dialog import + `Upload` icon import(對齊 Decision 2 scope correction,讓 SkillsPage 的 Import dialog 成為唯一 ZIP 入口)。
- [x] 5.2 移除 `src/lib/i18n/locales/{en,zh-TW}.ts` 內 `felinaSettings.skillLibrary.{import,importSuccess,importError}` 三個孤兒 i18n key 並調整 `description` 文案。驗證:`npm run check` 通過。
- [x] 5.3 `ImportStagingDialog.tsx` 的 `handleBrowseFiles` 改為將 ZIP candidates 透過 `createStagingItem` 包成 `StagingItem` 直接 `setStaging`(實作 Decision 3: ZIP 候選直送 Staging,不進 Discovered),以 `sourcePath` Set 去重避免重複按 Browse 重複加入。同名衝突繼續走 `SkillStagingCard` 內建的 overwrite / rename UI。
