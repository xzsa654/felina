## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings。驗證：記錄輸出結果。

## 2. Agent Fields 分卡片（Agent Fields Collapsible Cards requirement）

- [x] 2.1 重構 Settings 分頁中的 AgentFieldsEditor 渲染方式：將現有的單一展開區塊改為按 agent（anthropic / codex / gemini）分卡片，垂直堆疊。每張卡片以 `bg-bg-secondary/30 border border-border rounded` 包裹，header 顯示 agent 名稱和 ChevronDown/ChevronRight 摺疊 toggle。只有該 skill 實際有設定欄位的 agent 才顯示卡片，空的不佔位。預設展開。驗證：`npm run check` 通過；Settings 分頁顯示按 agent 分組的摺疊卡片。

## 3. Advanced Extras 卡片化（Advanced Extras Card requirement）

- [x] 3.1 將 Settings 分頁中的 Advanced Extras 區塊包裝在與 Agent Fields 相同樣式的卡片容器中。新增 `+ Add property` 按鈕（`Plus` icon + 文字），點擊後在 extras 列表底部新增一個空的 key-value row。驗證：`npm run check` 通過；點擊 Add property 新增空 row。

## 4. Focus 回饋（Advanced Extras Card requirement — Focus ring）

- [x] [P] 4.1 為 Settings 分頁內所有 input / textarea 欄位統一加入 `focus:ring-1 focus:ring-accent` class。驗證：`npm run check` 通過；手動 focus 任一欄位時出現 accent 色 ring。

## 5. i18n

- [x] [P] 5.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 `skills.editor.addProperty`（"Add property" / "新增屬性"）。驗證：`npm run check` 通過。

## 6. 驗證

- [x] 6.1 執行 `npm run check`，確認零 error。驗證：與 baseline 相比無新增。
- [x] 6.2 `npm run tauri dev` 手動驗證：(1) Settings 分頁 Agent Fields 按 agent 分卡片顯示；(2) 無欄位的 agent 不顯示卡片；(3) 卡片可摺疊/展開；(4) Advanced Extras 有卡片樣式和 Add property 按鈕；(5) 輸入欄位 focus 時有 ring 回饋。驗證：五項行為皆符合預期。
