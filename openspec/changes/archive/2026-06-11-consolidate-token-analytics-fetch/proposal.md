## Summary

把 /tokens 頁面的 monthly、daily、cache efficiency 三次分開的後端查詢,合併成單一 `get_token_analytics_pair` 批次呼叫,消除 daily 分析被重複計算與多次鎖競爭。

## Motivation

目前 `TokensPage` 每次載入會觸發三支同步 Tauri 指令,各自獨立取得 aggregator `Mutex` 並跑在主執行緒:

- `get_token_analytics`(monthly)
- `get_token_analytics`(daily,`auto_dated`)
- `get_cache_efficiency`(`auto_dated`)

其中 `get_cache_efficiency` 內部又呼叫一次 `build_analytics(Daily, …)`,與 daily 查詢的參數(日期界線、來源)完全相同,等於同一份 daily 分析被算了兩次,且其完整計算(time_series、agent_breakdown、top_sessions、hourly_heatmap)中除了 totals 與 model_breakdown 以外全被丟棄。三次同步指令各自鎖主執行緒,放大首載與 today 自動刷新時的卡頓。

專案已存在 `get_token_analytics_pair` 指令(後端 `build_analytics_pair`)與前端綁定 `getAnalyticsPair`,設計用途即「一次鎖、一次回 monthly+daily」,但目前無任何呼叫點。本變更改用並擴充此批次路徑,並把 cache efficiency 一併納入回傳。

## Proposed Solution

擴充批次路徑,使其在一次鎖內供應 monthly、daily 與 cache efficiency:

- 後端:擴充 `get_token_analytics_pair` 指令與 `build_analytics_pair`,接受 monthly 與 daily 各自獨立的日期界線(對應頁面上 overview 與 daily 分頁可各自選 preset),並在回傳的 pair 中新增 cache efficiency 欄位。
- cache efficiency 直接重用 `build_analytics_pair` 內部已建好的 daily `TokenAnalytics`(其 `model_breakdown` 已含 per-model `input_tokens`/`cache_read_tokens`),透過抽出的共用定價函式計算 `cache_cost_saved`,不再額外跑一次 `build_analytics`。
- 抽出共用函式承載既有 per-model 定價邏輯(`Σ cache_read × (input − cache_read 單價)`、缺價 10% 退路、`get_price` 失敗計 0、非負非 NaN、命中率 `cache_read /(input + cache_read)`),供批次路徑與既有 `build_cache_efficiency` 共用,避免重複實作。
- 前端:`TokensPage` 以單一 `useAnalyticsPair` 查詢取代 monthly/daily/cacheEfficiency 三個 hook,從回傳值取出 monthly、daily、cacheEfficiency;沿用既有 `auto_dated` 來源規則與 today 的 staleTime/refetchInterval 行為。移除已不再使用的 `useCacheEfficiency` hook、`getCacheEfficiency` 綁定與其 query key。

## Non-Goals

- 不改快取命中率公式或 per-model 定價邏輯本身(沿用 unify-cache-efficiency-metrics 既有語意)。
- 不改 token 數字計算、來源選擇(`auto_dated`/`pick_dated_source`)或 refresh 流程。
- 不改 DayDetailPanel 的 `get_day_*` 系列指令。
- 不改 `CacheEfficiency`、`TokenAnalytics` 既有欄位的名稱與型別。

## Alternatives Considered

- 方案 A(最小):讓前端從 daily 查詢回傳的 `model_breakdown` 自行算 cache efficiency,僅留輕量定價指令。否決:定價需後端 `PricingService`,且仍維持兩支以上呼叫與重複 daily 掃描,無法解決鎖競爭。
- 維持現狀並只移除 `get_cache_efficiency` 的重複 `build_analytics`:否決,仍是三次獨立鎖呼叫。

## Impact

- Affected specs: token-analytics-api、token-analytics-dashboard
- Affected code:
  - Modified:
    - src-tauri/src/commands/tokens.rs
    - src-tauri/src/tokens/aggregator.rs
    - src-tauri/src/tokens/types.rs
    - src/lib/tauri/commands.ts
    - src/lib/components/tokens/hooks/useTokenQueries.ts
    - src/lib/components/tokens/TokensPage.tsx
  - Removed:
    - 前端 useCacheEfficiency hook 與 getCacheEfficiency 綁定(整支移除,非檔案刪除)
