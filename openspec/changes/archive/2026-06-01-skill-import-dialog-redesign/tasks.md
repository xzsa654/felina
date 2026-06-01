## 1. 基礎設施與準備

- [x] 1.1 Baseline: 執行 `npm run check` 記錄現有的 TypeScript warnings / errors，確保可以明確區分本次 change 新引入的問題。驗證: CLI 輸出紀錄。
- [x] 1.2 i18n 更新: 新增 `skills.importDialog.*` 相關的英/繁中語系 key (包含標題、狀態、按鈕與衝突選項)，支援 Split view staging area for imported skills 與 Inline resolution for staging name conflicts。驗證: `npm run check` 通過且 TypeScript `TranslationDict` 無錯誤。

## 2. 核心元件實作

- [x] 2.1 狀態推導邏輯: 實作純函式推導拖曳與衝突狀態，包含從檔名判定是否與現有 canonical skill 同名。驗證: 撰寫 `node:test` 測試確保各種狀態推導皆正確，並執行測試通過。涵蓋 Inline resolution for staging name conflicts 的邏輯。
- [x] 2.2 SkillStagingCard 元件: 實作無邊框的 Skill Card，根據傳入狀態渲染綠色 `Ready` 標籤，或在發生衝突時展開包含 Overwrite / Rename 按鈕的警告區塊 (狀態顏色與視覺回饋)。驗證: 透過 `npm run tauri dev` 於獨立環境或頁面手動確認元件能正確切換狀態並顯示對應選項。
- [x] 2.3 ImportStagingDialog 元件架構: 建立 雙區塊佈局與拖曳機制 (Split view staging area for imported skills)，實作 `ImportStagingDialog.tsx`，左半部為 `discoveredSkills`，右半部為 `stagingSkills`，並整合原生的 HTML5 `draggable` 與 `onDrop` 事件，支援卡片拖拉與雙擊移動。驗證: 透過 `npm run check` 確認 TypeScript 型別無誤。

## 3. 整合與串接

- [x] 3.1 Browser Dialog 整合: 實作 系統檔案選擇器 (Browser Dialog) 整合，於對話框左側加入點擊觸發 Tauri `open` dialog 的功能，選取檔案或 ZIP 後將檔案資訊載入至左側陣列 (Import skills from ZIP)，而不直接匯入。驗證: `npm run check` 通過，確保與 @tauri-apps/plugin-dialog 的整合無型別錯誤。
- [x] 3.2 匯入執行與衝突把關: 實作底部的 `Import` 按鈕邏輯，當右側佇列中有任何卡片處於衝突狀態時按鈕為 disabled。點擊後批次呼叫現有後端匯入 API。驗證: 確認點擊邏輯完整且 `npm run check` 通過。
- [x] 3.3 頁面入口替換: 修改 `SkillsPage.tsx`，將原有的單純匯入按鈕改為開啟新版的 `ImportStagingDialog`。驗證: `npm run check` 通過。

## 4. 最終驗證

- [x] 4.1 手動 UI 驗證: 啟動 `npm run tauri dev`，開啟 Import Dialog，測試從系統視窗載入檔案、雙區塊拖拉、雙擊移動、引發同名衝突、選擇 Rename 解決衝突，以及最終成功匯入的完整流程。驗證: 人工確認操作與視覺回饋皆符合預期，且後端成功建立 Canonical skill 目錄。
- [x] 4.2 Code Quality 驗證: 再次執行 `npm run check` 與 `cargo check --lib`。驗證: 確保沒有引入新的型別錯誤與編譯警告。

## 5. 路徑不變量與 Import scan 去重

- [x] 5.0 確立 Shared `.agents/skills` Convention 不變量 (artifact-only): spec `skill-library-management` 新增 Shared `.agents/skills` Convention requirement，明確記載非 Anthropic agent (codex / gemini antigravity) 共用 `.agents/skills/` 是 OpenAgents 業界約定、不是 bug，並要求未來掃描/fan-out/import 程式碼以此為前提撰寫。驗證：spec validate 通過 + 後續實作改動前先 grep 此 requirement 確認方向一致。

(Import scan path deduplication)

- [x] 5.1 Gemini 路徑收斂 (Import scan path deduplication): `src-tauri/src/commands/agent_paths.rs` 新增 `GEMINI_LEGACY_GLOBAL` 常數與 `AgentPathsConfig::extra_global_paths()` method，回傳某 agent 需額外探測的 legacy global 路徑，並自動排除等於該 agent configured global 的路徑。`src-tauri/src/commands/skill_import.rs` 的 `skill_import_scan` 與 `skill_import_scan_quick` 改用 `extra_global_paths()`，移除硬編的 `~/.gemini/antigravity-cli/skills` fallback。行為：當 gemini configured global 與 legacy probe 相同時，該目錄只被掃一次，單一 gemini skill 顯示為一筆 candidate 而非 multi-source。驗證：`cargo check --lib` 通過，grep 確認 skill_import.rs 無硬編 antigravity 路徑。
- [x] 5.2 共用目錄保留多 agent 選擇 (Import scan path deduplication): 確認 `src-tauri/src/commands/skill_import.rs` 的 `group_by_name` 對於不同 agent 同 source_path 的情境（如 codex 與 gemini 共用 `.agents/skills`）仍維持 multi-source 行為，讓使用者選擇匯入時的 agent 歸屬；不做盲目去重，因為使用者選擇的 source_agent 會決定 SkillTarget 的 agent 欄位與 agent-specific side-effects（例如 codex 才會 merge `openai.yaml`）。驗證：既有測試 `cargo test --lib group_by_name_defers_multi_source_keeps_single_source` 通過。
