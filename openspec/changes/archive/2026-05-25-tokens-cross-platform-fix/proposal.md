## Problem

Tokens 頁面與 History 頁面在 Windows 上無法正常運作，存在兩個獨立的 bug：

1. **Anthropic quota 資料讀取失敗**：`ccusage.rs` 的 `fetch_anthropic_rate_limits()` 使用 macOS `security find-generic-password` CLI 讀取 Keychain 中的 OAuth token。Windows 沒有此指令，直接 fallback 到錯誤 "Claude Code credentials not found in Keychain"，導致 Anthropic quota 永遠顯示 unavailable。

2. **History 頁面資料為空**：`HistoryPage.tsx` 呼叫 `listHistorySessions` 從 SQLite DB 讀取 session 列表，但 DB 資料需要透過 `refresh_token_data` command 觸發掃描才會寫入。前端定義了 `api.tokenAnalytics.refresh()` wrapper（`commands.ts:327`），但**整個前端沒有任何元件呼叫它**，導致 DB 始終為空。

## Root Cause

### Bug 1: Credential 讀取 macOS-only

`ccusage.rs` 第 50-57 行直接呼叫 `Command::new("security")` 讀取 macOS Keychain。Windows 上 Claude Code 把 OAuth credentials 存在 `~/.claude/.credentials.json`，JSON 結構與 Keychain 內容一致（都有 `claudeAiOauth.accessToken`），但原始程式碼沒有這條 fallback 路徑。

### Bug 2: refresh 從未被觸發

`refresh_token_data` Tauri command 存在於 `commands/tokens.rs:751`，前端 wrapper 存在於 `commands.ts:327`，但沒有任何 page 或 effect 呼叫 `api.tokenAnalytics.refresh()`。History page 的 `useEffect` 只呼叫 `listHistorySessions`（純讀取），不觸發掃描。

## Proposed Solution

### Bug 1 修復

抽出 `read_claude_oauth_token()` helper：
- macOS（`cfg!(target_os = "macos")`）：維持 Keychain 路徑
- 其他平台 / Keychain 失敗時：fallback 讀取 `~/.claude/.credentials.json`
- 結構體 `KeychainCredentials` 已能解析兩者（JSON 格式一致）

### Bug 2 修復

在 TokensPage 或 app 初始化時觸發 `refresh_token_data`，確保 DB 有資料後 History page 才能正常讀取。具體策略：在 TokensPage 的 `useEffect` 中先呼叫 `api.tokenAnalytics.refresh()`，完成後再查詢 analytics 資料。History page 本身也需要在 mount 時呼叫 refresh（或確認 DB 非空後跳過）。

## Success Criteria

- Windows 上 Tokens 頁面的 Anthropic quota panel 能正常顯示 utilization 資料（不再出現 "credentials not found" 錯誤）
- History 頁面在首次開啟時能列出 session 資料（前提：使用者有 Claude Code 使用紀錄）
- macOS 行為不受影響（Keychain 路徑仍為優先）

## Impact

- Affected code:
  - Modified: src-tauri/src/tokens/ccusage.rs, src/lib/components/tokens/TokensPage.tsx, src/lib/components/history/HistoryPage.tsx
  - New: （無）
  - Removed: （無）
