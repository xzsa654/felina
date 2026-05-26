## Why

目前 `/tokens` 可以看出哪個 session 用量異常，也能定位原始 transcript 檔，但使用者仍缺少一個可瀏覽過往對話紀錄的主頁。新增 History 頁可以把「用量分析」與「回看對話內容」串起來，讓 `/tokens` 成為快速入口，而不是唯一的檢視位置。

## What Changes

- 新增 History 頁面，註冊為 top-level navigation page，讓使用者可瀏覽本機既有 agent session 紀錄。
- 新增 session transcript API，提供 session 列表、單一 transcript 讀取與既有 reveal-in-file-manager 行為。
- `/tokens` Daily Top sessions 從單純定位檔案，延伸為可 deep link 到 History 頁的特定 session。
- History viewer 以本機原始 transcript 檔為來源，呈現基本 metadata、訊息列表與來源路徑。
- 保持敏感資料面保守：不把完整 transcript 匯入 token analytics DB，不自動建立永久內容快取。

## Non-Goals

- 不做全文搜尋引擎。
- 不做 AI 摘要或自動標題生成。
- 不同步或上傳 transcript 內容。
- 不承諾 Gemini transcript 完整支援；若來源格式不足，需清楚顯示 unavailable 狀態。

## Capabilities

### New Capabilities

- `history-page`: 瀏覽本機 agent session 歷史紀錄、讀取 transcript，並支援從 token analytics deep link 到指定 session。

### Modified Capabilities

- `app-pages`: 新增 History 為已註冊頁面，並保持 Sidebar、Header、Command Palette 與 route table 一致。
- `app-routing`: 新增 `/history` route，支援 query/state deep link 到指定 session。
- `token-analytics-dashboard`: `/tokens` Daily Top sessions 可導向 History 的指定 session，而不只定位原始檔。
- `token-analytics-api`: session analytics 回傳與 transcript commands 提供 enough information for History linking and reading.

## Impact

- Affected specs: `history-page`, `app-pages`, `app-routing`, `token-analytics-dashboard`, `token-analytics-api`
- Affected code:
  - New: `src/lib/components/history/HistoryPage.tsx`
  - Modified: `src/router.tsx`, `src/lib/stores/navigation.ts`, `src/lib/components/layout/Sidebar.tsx`, `src/lib/components/layout/Header.tsx`, `src/lib/components/shared/CommandPalette.tsx`, `src/lib/components/tokens/components/DayDetailPanel.tsx`, `src/lib/tauri/commands.ts`, `src/lib/types/token-analytics.ts`, `src-tauri/src/commands/tokens.rs`, `src-tauri/src/tokens/types.rs`, `src-tauri/src/tokens/aggregator.rs`, `src-tauri/src/lib.rs`
  - Removed: none
