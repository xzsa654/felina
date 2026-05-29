## 1. 準備與基線

- [x] 1.1 Baseline: 執行 `npm run check` 紀錄現有 TypeScript 錯誤與警告，並執行 `cargo check --lib` 確保 Rust 層建置通過，作為後續驗證基準。

## 2. 前端介面與元件實作

- [x] 2.1 實作 `CreateSkillDialog` UI 元件。在前端新增對話框，包含 Skill Name 文字輸入與 Initial Target 下拉選擇 (可選 Global、Project 或 None)。驗證方式：在開發環境中掛載該 Dialog 並顯示無錯誤。滿足「新增 CreateSkillDialog 元件」設計決策。
- [x] 2.2 串接 `SkillsPage` 主頁面的「新增 Skill」按鈕。變更按鈕行為，點擊後不再直接建立空白檔案，而是開啟 `CreateSkillDialog`。驗證方式：點擊新增按鈕會彈出新建的 Dialog 且無 console error。對應 Interactive Skill Creation Flow 需求。

## 3. 建立與同步邏輯串接

- [x] 3.1 實作建立流程。在 `CreateSkillDialog` 送出時，前端依序呼叫 `canonical_skills_write` 建立檔案，接著根據選項呼叫設定目標指令寫入 sync-meta。驗證方式：開發模式下操作送出，確認網路請求順序呼叫且能攔截處理錯誤，並實踐「前端依序呼叫現有 API」決策。
- [x] 3.2 建立完成轉導。流程成功後（或設定 Target 失敗但給予 Toast 提示後），將路由導航至新建 Skill 的編輯畫面。驗證方式：手動執行新建流程，確認成功後畫面跳轉至該 Skill Editor，完成 Interactive Skill Creation Flow。

## 4. 驗證與封裝

- [x] 4.1 執行 `npm run check`，確保沒有引入新的 TypeScript errors 或 warnings。
- [x] 4.2 執行 `npm run tauri dev` 進行端對端手動驗證：
  1. 輸入名稱 `test-create`，Target 選擇 Global Anthropic，確認檔案系統與 `.felina-sync-meta.json` 皆產生對應內容。
  2. 輸入名稱 `test-none`，Target 選擇 None，確認產生 SKILL.md 但 Target 列表為空，滿足 Interactive Skill Creation Flow 的所有情境。
