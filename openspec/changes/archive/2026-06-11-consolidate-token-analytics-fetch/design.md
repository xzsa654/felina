## Context

`/tokens` 頁面載入時,`TokensPage` 會發出三支同步 Tauri 指令,各自獨立取得 aggregator `Mutex` 並在主執行緒執行:

- `get_token_analytics`(monthly) → `build_analytics(Monthly, monthlyBounds, monthlySource)`
- `get_token_analytics`(daily) → `build_analytics(Daily, dailyBounds, "auto_dated")`
- `get_cache_efficiency` → `build_cache_efficiency` 內部再呼叫 `build_analytics(Daily, dailyBounds, "auto_dated")`

第二與第三支的 `build_analytics(Daily, …)` 參數完全相同,等於同一份 daily 分析被算兩次;且 `build_cache_efficiency` 只用到該份分析的 totals 與 `model_breakdown`,其餘子查詢(time_series、agent_breakdown、top_sessions、hourly_heatmap)全被丟棄。

`build_analytics_pair`(後端)與 `getAnalyticsPair`(前端綁定)已存在且用途即批次取得 monthly+daily,但目前無呼叫點,且其簽章對 monthly 與 daily 共用單一 `date_start/date_end`。而 `TokensPage` 的 overview 與 daily 分頁各自有獨立 preset(`monthlyDays` 來自 `datePreset`、`dailyDays` 來自 `dailyPreset`),故批次路徑需支援兩組獨立日期界線才能取代現況。

per-model cache 成本與命中率邏輯目前位於 `build_cache_efficiency`(unify-cache-efficiency-metrics 已落地):`Σ model.cache_read_tokens × (input_cost_per_1m − cache_read_cost_per_1m)/1_000_000`、缺 cache-read 價退路 `input × 0.1`、`get_price` 失敗該 model 計 0、差額為負截 0、非 NaN;命中率 `cache_read /(input + cache_read)`。

## Goals / Non-Goals

**Goals:**

- 單次鎖、單支指令供應 monthly + daily + cache efficiency,消除重複的 daily `build_analytics`。
- 批次路徑支援 monthly 與 daily 各自獨立的日期界線。
- per-model 定價邏輯抽成單一共用函式,批次路徑與既有 `build_cache_efficiency` 共用,不重複實作。
- 前端 `TokensPage` 以單一查詢取代三個 hook,移除隨之失效的死碼。

**Non-Goals:**

- 不改命中率公式或 per-model 定價語意。
- 不改 token 數字、來源選擇、refresh。
- 不改 `CacheEfficiency` / `TokenAnalytics` 既有欄位名稱與型別。
- 不改 DayDetailPanel 的 `get_day_*` 指令。

## Decisions

### 批次指令支援兩組獨立日期界線

`get_token_analytics_pair` 與 `build_analytics_pair` 的簽章由共用單一 `date_start/date_end`,改為接受 `monthly_date_start/monthly_date_end` 與 `daily_date_start/daily_date_end` 兩組。理由:overview 與 daily 分頁 preset 可各自不同,共用單一界線會破壞既有行為。此指令目前無呼叫點,改簽章不影響其他既有呼叫。**替代:** 共用單一界線 — 否決,與現有獨立 preset 行為不符。

### cache efficiency 重用批次內已建的 daily 分析

`build_analytics_pair` 先建 daily `TokenAnalytics`,再以該份分析(totals + `model_breakdown`)直接計算 cache efficiency 後放入回傳,不另呼叫 `build_analytics`。回傳型別 `TokenAnalyticsPair` 新增欄位 `cache_efficiency: CacheEfficiency`。理由:消除重複 daily 掃描,這正是本變更的核心目的。**替代:** pair 內再呼叫 `build_cache_efficiency` — 否決,等於沒解決重複。

### 抽出共用 per-model 定價函式

把 `build_cache_efficiency` 中的成本/命中率計算抽成一個輸入為「daily `TokenAnalytics`(或其 totals + `model_breakdown`)+ `&mut PricingService`」、輸出 `CacheEfficiency` 的關聯函式。`build_cache_efficiency`(保留作為獨立指令)與 `build_analytics_pair` 皆呼叫它。理由:單一真實來源,避免兩處定價邏輯漂移。**替代:** 在 pair 內複製定價迴圈 — 否決,易漂移。

### 前端改用單一批次查詢並移除死碼

`TokensPage` 以單一 `useAnalyticsPair` 查詢取代 `monthlyQuery`、`dailyQuery`、`cacheEfficiencyQuery`;其回傳值提供 `monthly`、`daily`、`cacheEfficiency`。`getAnalyticsPair` 綁定擴充為接受兩組日期界線並回傳含 `cache_efficiency` 的 pair。today 行為(`staleTime: 0`、`refetchInterval: 60_000`)沿用至批次查詢;當 overview 或 daily 任一為 today 時即啟用即時刷新。移除 unify-cache-efficiency-metrics 新增的 `useCacheEfficiency` hook、`tokenKeys.cacheEfficiency` 與 `getCacheEfficiency` 綁定(全頁無其他使用者)。**替代:** 保留三個 hook 僅後端合併 — 否決,前端仍多次往返且留死碼。

## Implementation Contract

**Behavior:**

- 開啟 /tokens 一次載入時,後端對 daily `build_analytics` 僅執行一次(原為兩次);monthly 與 daily 分析、cache efficiency 由單一指令在一次鎖內回傳。
- 快取效率卡、統計卡、Top models 表顯示的命中率與省下成本,數值與行為與變更前一致(來自後端、per-model 定價、命中率 `cache_read/(input+cache_read)`)。
- overview 與 daily 分頁的日期 preset 仍可各自獨立套用。

**Interface / data shape:**

- `get_token_analytics_pair(monthly_date_start, monthly_date_end, daily_date_start, daily_date_end, monthly_source, daily_source)` → `TokenAnalyticsPair`。
- `TokenAnalyticsPair` 新增 `cache_efficiency: CacheEfficiency`;`monthly`、`daily` 欄位不變。
- 新增關聯函式(命名如 `cache_efficiency_from_analytics`)輸入 daily `TokenAnalytics` 與 `&mut PricingService`,輸出 `CacheEfficiency`;`build_cache_efficiency` 改為呼叫它。
- 前端 `getAnalyticsPair({ monthlyDateStart, monthlyDateEnd, dailyDateStart, dailyDateEnd, monthlySource, dailySource })` → `{ monthly, daily, cache_efficiency }`。
- 前端新增 `useAnalyticsPair(...)`;移除 `useCacheEfficiency`、`tokenKeys.cacheEfficiency`、`getCacheEfficiency`。

**Failure modes:**

- 沿用既有定價失敗處理:某 model 無 cache-read 價走 `input × 0.1`;`get_price` 失敗該 model 計 0;差額負截 0;命中率分母 0 回傳 0;結果不得 NaN/負。
- 批次指令查詢失敗:前端沿用 React Query 錯誤態,頁面不凍結、不顯示 NaN。

**Acceptance criteria:**

- `cargo check` 與 `tsc --noEmit` 通過。
- 後端單元測試:呼叫擴充後的 `build_analytics_pair`,斷言回傳的 `cache_efficiency` 與對同一 daily 範圍呼叫 `build_cache_efficiency` 結果一致(命中率與省下成本相等),驗證共用函式無行為偏差。
- 後端單元測試:斷言 monthly 與 daily 可套用不同日期界線(各自 totals 反映各自範圍)。
- 前端:`TokensPage` 不再 import/呼叫 `useTokenAnalytics`、`useCacheEfficiency`;改用單一 `useAnalyticsPair`;三處快取數值在同資料下一致(手動檢視)。
- 程式碼中不存在未被呼叫的 `getCacheEfficiency` / `useCacheEfficiency`。

**Scope boundaries:**

- In scope:`get_token_analytics_pair`/`build_analytics_pair` 簽章與回傳擴充、抽出共用定價函式、`TokenAnalyticsPair` 加欄位、前端改單一批次 hook 並移除死碼。
- Out of scope:命中率/定價語意、token 數字/來源/refresh、`get_day_*`、`CacheEfficiency`/`TokenAnalytics` 既有欄位形狀、其他分頁。

## Risks / Trade-offs

- [改 `build_analytics_pair` 簽章] → 該指令目前無呼叫點,改動風險低;以單元測試覆蓋新雙界線行為。
- [批次單支查詢失敗時三塊資料同時不可用] → 可接受;原本三支任一失敗也各自缺塊,且單支失敗的錯誤態更一致,且省去多次鎖競爭。
- [today 刷新改以單支查詢 60s 輪詢] → 由三支各自輪詢縮為一支,反而降低主執行緒負載。
