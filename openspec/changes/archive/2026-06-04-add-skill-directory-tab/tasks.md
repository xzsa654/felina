## 1. 準備工作

- [x] 1.1 執行 baseline 檢查，記錄目前的 TypeScript 狀態。執行 `npm run check`，確保後續新增的程式碼不會引入新的未處理錯誤。

## 2. 後端指令實作與回傳結構

- [x] 2.1 實作 `SkillFileNode` 結構與檔案排除策略。定義回傳的資料結構，並實作遞迴讀取檔案目錄的邏輯，過濾掉 `SKILL.md` 與 `.felina-sync-meta.json`。驗證：執行 `cargo check` 通過，確認型別與遞迴邏輯正確。對應設計：「1. 後端指令實作與回傳結構」與「2. 檔案排除策略」。涵蓋需求：Skill directory tree retrieval。
- [x] 2.2 實作 Tauri 指令 `get_skill_directory_tree`。在 `src-tauri/src/commands/canonical_skills.rs` 暴露指令供前端呼叫，處理不存在目錄的 Failure modes。驗證：執行 `cargo build` 在 src-tauri/ 下通過。

## 3. 前端介面佈局

- [x] 3.1 實作前端指令 Wrapper。在 `src/lib/tauri/commands.ts` 新增呼叫 `get_skill_directory_tree` 的 API 封裝，並定義對應的 TypeScript 型別。驗證：`npm run check` 無型別錯誤。
- [x] 3.2 在 `SkillEditor.tsx` 中實作「目錄」分頁與檔案清單渲染。依據 Felina UI Guidelines 實作無邊框、文件中心化的 Flex 清單，顯示 `Folder` 與 `FileText` 圖示。驗證：執行 `npm run check` 通過。對應設計：「3. 前端介面佈局」。涵蓋需求：Directory view UI。
- [x] 3.3 新增相關的 i18n 翻譯鍵值。在 `en.ts` 與 `zh-TW.ts` 中加入分頁名稱與錯誤提示文案。驗證：TypeScript 編譯通過，確保 TranslationDict 對齊。

## 4. 系統驗證

- [x] 4.1 手動端到端測試。執行 `npm run tauri dev`，開啟一個具有多個附屬檔案的 Skill，切換到目錄分頁，確認清單正確顯示且排除了 `SKILL.md`，並測試權限/目錄不存在時的錯誤處理是否正常。
