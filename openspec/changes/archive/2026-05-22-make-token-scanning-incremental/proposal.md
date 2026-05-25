## Why

目前 token 掃描的實作參考 tokscale 的多 agent 架構，但實際行為是每次只掃各資料目錄最近 50 個檔案，再依 SQLite unique constraint 避免重複。這會讓舊檔新增事件、超過 50 個活躍檔案、以及掃描錯誤回報的行為不夠可預期。

## What Changes

- 將 token 掃描改為明確的增量掃描語意，記錄每個 agent 與資料來源的掃描 cursor。
- 重新定義 refresh 結果，使 UI 能知道哪些 agent 被掃描、哪些資料來源被跳過、哪些檔案解析失敗。
- 保留 SQLite event 去重作為安全網，但不再把去重視為主要的增量策略。
- 移除固定最近 50 個檔案造成的資料遺漏風險，改以 cursor、mtime 與必要的重掃條件控制掃描範圍。

## Non-Goals

- 不調整模型費用公式或定價來源。
- 不新增新的 agent 類型。
- 不改動 TokensPage 的圖表版面，除非為了顯示既有 refresh/status 欄位的真實資料。

## Capabilities

### New Capabilities

- `token-incremental-scanning`: 定義多 agent token 資料的增量掃描、cursor 儲存、錯誤回報與防遺漏行為。

### Modified Capabilities

(none)

## Impact

- Affected specs: token-incremental-scanning
- Affected code:
  - Modified: src-tauri/src/tokens/scanner.rs
  - Modified: src-tauri/src/tokens/storage.rs
  - Modified: src-tauri/src/tokens/aggregator.rs
  - Modified: src-tauri/src/commands/tokens.rs
  - Modified: src-tauri/src/tokens/types.rs
  - Modified: src/lib/types/token-analytics.ts
  - Modified: src/lib/components/tokens/components/AgentStatusPanel.tsx
  - New: src-tauri/src/tokens/scan_state.rs
