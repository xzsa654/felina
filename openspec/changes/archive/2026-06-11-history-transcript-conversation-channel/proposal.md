## Why

History 頁的 session transcript 目前把所有 JSONL entry 一律攤平成 user / assistant / tool / system / usage 五種 role，原始資料中可區分「後台運作內容」的訊號（Claude Code 的 `isSidechain` / `isMeta`、tool_result block、harness 注入文字、Codex 的 `reasoning` / `function_call` payload type）在解析時被丟棄。結果是 UI 上標為 "User" 的 entry 混入大量使用者根本沒打過的內容（tool 結果、system-reminder、skill 展開），使用者無法只看「真正的對話」。

## What Changes

- 後端 `TranscriptEntry` 新增 `channel` 欄位（`"conversation"` 或 `"background"`），transcript 解析時依結構訊號為主、內文 prefix 為輔分類：
  - `background`：sidechain entry（`isSidechain: true`）、meta entry（`isMeta: true`）、content 為 tool_result / function_call_output block 的 entry、`type: "system"` 行、Codex `reasoning` / `function_call` payload、內文以 harness 注入 prefix（`<system-reminder>`、`<command-name>`、`<local-command-stdout>`、`Caveat:`）開頭的 user entry
  - `conversation`：使用者實際輸入與 assistant 回覆文字
  - `usage` entry 不參與此分類（維持既有 role 機制）
- 前端 History 頁既有的 transcript filter（All / Conversation / Usage）語意升級：**Conversation 改為只顯示 `channel == "conversation"` 的 entry**（排除後台內容與 usage）；All 與 Usage 行為不變
- 分類為啟發式容錯設計：無法判定的 entry 一律歸 `conversation`（漏判頂多多顯示，不誤吞真對話）

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `history-page`: transcript entry 新增 channel 分類需求（conversation / background），Conversation filter 的顯示語意由「非 usage」改為「僅 conversation channel」

## Impact

- Affected specs: openspec/specs/history-page/spec.md
- Affected code:
  - Modified: src-tauri/src/commands/tokens.rs（transcript 解析：channel 判定邏輯 + 單元測試）
  - Modified: src-tauri/src/tokens/types.rs（TranscriptEntry 增 channel 欄位）
  - Modified: src/lib/types/token-analytics.ts（前端型別對齊）
  - Modified: src/lib/components/history/HistoryPage.tsx（Conversation filter 語意升級）
- 無新增依賴（npm / Cargo 皆不需要）
- Backward compatibility：`channel` 為新增欄位，序列化採 serde 預設值，舊資料路徑不受影響；UI 行為變更僅影響 Conversation filter 的過濾結果，無破壞性 API 變更
