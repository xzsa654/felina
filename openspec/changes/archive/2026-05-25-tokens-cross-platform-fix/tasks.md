## 1. Anthropic credential 跨平台修復

- [x] [P] 1.1 在 `src-tauri/src/tokens/ccusage.rs` 中抽出 `read_claude_oauth_token()` helper，macOS 走 Keychain（`security find-generic-password`），其他平台 fallback 讀取 `~/.claude/.credentials.json`。原 `fetch_anthropic_rate_limits()` 改為呼叫此 helper 取得 token。驗證：`cargo check` 通過；Windows 上呼叫 `get_agent_quota` 回傳的 `anthropic_limits.error` 為 `null`、`available` 為 `true`。

## 2. History 頁面 refresh 觸發

- [x] [P] 2.1 修正 History page lists local sessions：在 `src/lib/components/history/HistoryPage.tsx` 的資料載入 `useEffect` 中，於呼叫 `listHistorySessions` 前先 `await api.tokenAnalytics.refresh()`，確保 DB 有最新掃描結果。refresh 失敗時不阻擋頁面（catch 後仍繼續 query）。驗證：首次開啟 History 頁面時，Network 可觀察到 `refresh_token_data` invoke，之後 `list_history_sessions` 回傳非空 sessions 陣列。

## 3. 驗證

- [x] 3.1 啟動 `npm run tauri dev`，打開 Tokens 頁面確認 Anthropic quota panel 有顯示 utilization 數值（或 rate limit 資訊），不再出現 "credentials not found" 錯誤。打開 History 頁面確認 session 列表有資料。
