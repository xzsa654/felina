<!--
Each task description MUST state:
- the behavior or contract being delivered (what is observably true when the
  task is complete), and
- the verification target that proves completion (test, CLI invocation,
  analyzer check, manual assertion, or content review).

File paths are supporting context for locating the work, never the task
itself. "Edit file X" is not a valid task — it is missing both behavior and
verification.
-->

## 1. 準備階段 (Preparation)

- [x] 1.1 執行 `npm run check` 並記錄現有 TypeScript errors / warnings，建立開發基準，驗證時以此對比確保未引入新錯誤。

## 2. 元件抽離與重構 (Component Extraction)

- [x] [P] 2.1 建立 `src/lib/components/skills/SyncInfoBar.tsx` 元件，並實作狀態分組邏輯（將 targets 分為 Synced, Pending, Missing 等群組），呈現為摘要 Chip 排版，取代原本展開的列表。驗證：元件編譯無錯誤，且可通過 `npm run check` (Requirement: Sync Info Status Grouping)。
- [x] [P] 2.2 在 `<SyncInfoBar>` 元件中加入展開/摺疊狀態管理。實作：含有 Pending 或 Missing 的群組預設為展開，Synced 群組預設為摺疊。驗證：在元件內模擬不同 target 狀態能正確設定初始展開值，無型別錯誤 (Requirement: Auto-Expansion of Actionable States)。
- [x] [P] 2.3 實作互動式展開切換，讓使用者點擊特定狀態的摘要 Chip 時，能切換該群組 target 詳細清單的顯示/隱藏。驗證：元件編譯無錯誤，事件處理函式正確綁定 (Requirement: Interactive Expansion)。
- [x] 2.4 修改 `src/lib/components/skills/SkillsPage.tsx`，將舊有直列清單區塊移除，改為匯入與渲染新的 `<SyncInfoBar>` 元件。驗證：`npm run check` 無錯誤，Props 介面對接正確。

## 3. 驗證與測試 (Verification)

- [x] 3.1 執行 `npm run tauri dev` 啟動應用，手動確認 Sync Info 區塊已縮放為 Chip 形式，且 Pending/Missing 項目會預設展開、Synced 項目預設隱藏，點擊 Chip 可正常切換。驗證：手動測試操作符合所有場景。
