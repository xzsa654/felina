## 1. 後端:抽出共用定價函式

- [x] 1.1 在 `aggregator.rs` 抽出關聯函式 `cache_efficiency_from_analytics(daily: &TokenAnalytics, pricing: &mut PricingService) -> CacheEfficiency`,承載既有命中率 `cache_read/(input+cache_read)` 與 per-model 省下成本(`Σ cache_read × (input−cache_read 單價)/1M`、缺價退路 `input×0.1`、`get_price` 失敗計 0、負截 0、非 NaN);`build_cache_efficiency` 改為呼叫此函式。先寫測試(TDD):對含混合 model(含一筆缺價)的 daily `TokenAnalytics` fixture,斷言函式輸出命中率與省下成本等於既有 `build_cache_efficiency` 的結果(沿用 2.70+4.50=7.20 範例),再重構至綠燈。驗證:新測試通過、`cargo test` 通過,既有 cache 測試不變。落實設計決策「抽出共用 per-model 定價函式」。

## 2. 後端:批次路徑擴充

- [x] 2.1 在 `types.rs` 為 `TokenAnalyticsPair` 新增 `cache_efficiency: CacheEfficiency` 欄位(`monthly`/`daily` 不變);擴充 `build_analytics_pair` 接受 monthly 與 daily 各自獨立的日期界線(`monthly_date_start/end`、`daily_date_start/end`)與各自 source,並在建出 daily `TokenAnalytics` 後以 1.1 的共用函式計算 `cache_efficiency` 放入回傳,**不**再額外呼叫 `build_analytics` 或 `build_cache_efficiency`。先寫測試(TDD):斷言 (a) monthly 與 daily 套用不同日期界線時各自 totals 反映各自範圍;(b) 回傳的 `cache_efficiency` 與對同一 daily 範圍呼叫 `build_cache_efficiency` 結果相等。驗證:新測試通過、`cargo test` 通過。落實設計決策「批次指令支援兩組獨立日期界線」與「cache efficiency 重用批次內已建的 daily 分析」。
- [x] 2.2 擴充 `get_token_analytics_pair` 指令(`commands/tokens.rs`)簽章對應 2.1 的雙日期界線與雙 source,於單一 aggregator 鎖內呼叫 `build_analytics_pair` 並回傳含 `cache_efficiency` 的 pair;沿用既有 `mark_analytics_transcript_availability`。驗證:`cargo check` 通過;指令仍註冊於 invoke_handler(無新增註冊需求)。這對應 spec 的 **get_token_analytics_pair command** 需求。

## 3. 前端:改用單一批次查詢並移除死碼

- [x] 3.1 擴充 `commands.ts` 的 `getAnalyticsPair` 綁定:參數對應雙日期界線與雙 source,回傳型別加入 `cache_efficiency: CacheEfficiency`;同時移除已無使用者的 `getCacheEfficiency` 綁定。驗證:`tsc --noEmit` 通過;檔內不再有 `getCacheEfficiency`。
- [x] 3.2 在 `useTokenQueries.ts` 新增 `useAnalyticsPair(...)` query hook(沿用 today 的 `staleTime:0`/`refetchInterval:60_000`、`auto_dated` 來源規則,當 overview 或 daily 任一為 today 即啟用即時刷新);移除 `useCacheEfficiency`、`tokenKeys.cacheEfficiency`。驗證:`tsc --noEmit` 通過;檔內不再有 `useCacheEfficiency` 或 `cacheEfficiency` query key。
- [x] 3.3 改寫 `TokensPage.tsx`:以單一 `useAnalyticsPair` 取代 `monthlyQuery`、`dailyQuery`、`cacheEfficiencyQuery`,從回傳值取出 `monthly`、`daily`、`cacheEfficiency` 供既有卡片/表格使用;沿用 overview 與 daily 各自獨立的 preset。驗證:`tsc --noEmit` 通過;`TokensPage.tsx` 不再 import/呼叫 `useTokenAnalytics` 與 `useCacheEfficiency`。這對應 spec 的 **Single batched analytics fetch** 需求,落實設計決策「前端改用單一批次查詢並移除死碼」。

## 4. 驗證與審查

- [x] 4.1 API surface 審查(audit):檢視 `get_token_analytics_pair` 新簽章在三個對手視角下的行為——日期界線全為 `None` 時等同全時段、monthly 與 daily source 為 `None` 時各自走預設來源、雙界線互不影響;記錄結論供 archive notes。驗證:結論已記錄,無未說明的 deviation。
- [x] 4.2 端對端驗證:`cargo check`、`cargo test`、`tsc --noEmit` 全通過;開啟 /tokens 一次載入時 daily `build_analytics` 僅執行一次(以日誌或計數確認,對照原本兩次);快取效率卡、統計卡、Top models 表三處命中率在同資料下一致;overview 與 daily 可各自套用不同 preset。驗證:依上述逐條手動確認通過。
