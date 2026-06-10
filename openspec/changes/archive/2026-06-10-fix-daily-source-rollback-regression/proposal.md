## Why

`default_analytics_source` 自 commit 1ff45fc（mixed source selection）起，Daily/Weekly/Monthly 聚合視圖只要 `tokscale_export` 有資料就無條件選用，完全不查 `active_source`。這破壞了明確 rollback 契約：使用者（或測試）將 active source 明確切回 `felina_parser` 後，Daily analytics 仍回傳 tokscale 資料。單元測試 `active_source_can_roll_back_to_legacy_parser_rows` 自該 commit 起持續失敗（期望 legacy 321 tokens，實得 tokscale 999），且函式 doc comment 仍聲稱「Daily views keep using the active ingestion source so rollback ... behave as before」，與實作矛盾。

## Problem

兩個既有測試編碼了看似衝突、實則可同時成立的語意：

- `active_source_can_roll_back_to_legacy_parser_rows`（失敗中）：active source 明確設為 `felina_parser` 時，Daily 聚合應回傳 parser rows。
- `monthly_analytics_prefers_tokscale_export_over_parser_fallback_active_source`（通過中）：active source 為 `parser_fallback`（tokscale 失敗後的自動 fallback）時，Monthly 聚合仍優先 tokscale。

現行實作用「tokscale rows 存在與否」做判斷，無法區分「明確 rollback（`felina_parser`）」與「自動 fallback（`parser_fallback`）」兩種 active source 狀態，因此前者被忽略。

## Root Cause

`src-tauri/src/tokens/aggregator.rs` 的 `default_analytics_source`，Daily/Weekly/Monthly 分支以 `count_events_for_source(tokscale_export) > 0` 作為唯一條件直接回傳 `tokscale_export`，未先讀取 `active_source()`。commit 1ff45fc 為了讓 dashboard 聚合視圖取得 tokscale 的 model 統計而引入此捷徑，但沒有保留明確 rollback 的判斷，也未同步更新 doc comment 與 Daily rollback 測試。

## Proposed Solution

在 `default_analytics_source` 的 Daily/Weekly/Monthly 分支加入 active source 判斷，三個聚合分支採同一規則：

1. 先讀 `active_source()`。
2. 若 active source 為 `felina_parser`（明確 rollback 或 tokscale 從未成功），直接回傳 active source。
3. 否則（`tokscale_export` 或 `parser_fallback`）維持現行 tokscale 優先：tokscale rows 存在則回 `tokscale_export`，不存在則回 active source。

Hourly 分支維持現狀（一律 active source）。同步把函式 doc comment 改為描述上述真實規則。此修法讓兩個既有測試都按原樣通過，不需翻轉任何測試期望。

## Non-Goals

- 不改動 Hourly 分支與 day-detail 的 mixed source selection（1ff45fc 的其餘行為維持）。
- 不改動 `set_active_source` / `active_source` storage 語意與 fallback 寫入路徑。
- 不新增 UI 或 IPC：本 change 純後端聚合邏輯修正。
- 不處理 Open Questions 中其他項目（AgentId enum 封閉、reconciliation 模組拆分）。
- 捨棄方案 A「把失敗測試期望翻轉為 tokscale 優先」：那會刪除明確 rollback 契約，且與 spec「Isolate legacy parser data」要求的 rollback path 矛盾。

## Success Criteria

- `cargo test --lib tokens::` 全綠：`active_source_can_roll_back_to_legacy_parser_rows` 與 `monthly_analytics_prefers_tokscale_export_over_parser_fallback_active_source` 同時通過，其餘 tokens 測試無 regression。
- `default_analytics_source` 的 doc comment 與實作一致描述三狀態規則（felina_parser 尊重、parser_fallback 與 tokscale_export 走 tokscale 優先）。
- 新增測試覆蓋 Weekly/Monthly 的明確 rollback 情境（active=felina_parser 時回傳 parser rows），固化三分支同規則。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `tokscale-backed-token-ingestion`: 預設 analytics source 解析 SHALL 區分明確 rollback（`felina_parser`）與自動 fallback（`parser_fallback`）— 前者必須被尊重，後者允許聚合視圖維持 tokscale 優先。

## Impact

- Affected specs: tokscale-backed-token-ingestion
- Affected code:
  - Modified: src-tauri/src/tokens/aggregator.rs
  - New: (none)
  - Removed: (none)
- Dependencies: 無 npm / Cargo 依賴變動，無檔案結構變動。
- Compatibility: 非破壞性。正常 tokscale 流程（refresh 成功後 active=tokscale_export）與自動 fallback 行為完全不變；唯一行為變化是明確 rollback 至 felina_parser 時聚合視圖改為尊重該選擇（即修復前的既定契約）。
