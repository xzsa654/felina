## 1. 後端成本計算

- [x] 1.1 依設計「快取省下成本改用各 model 實際定價」修改 `build_cache_efficiency`(`aggregator.rs`):改為逐 model 以 `PricingService.get_price` 取價,累加 `Σ cache_read_tokens × (input_cost_per_1m − cache_read_cost_per_1m) / 1_000_000`;缺 cache-read 價時退路 `input_cost_per_1m × 0.1`,`get_price` 失敗該 model 計 0,差額為負截為 0,結果不得為 NaN/負值。同時讓 `cache_hit_ratio` 維持 `cache_read / (input + cache_read)`。驗證:新增/更新單元測試,給定混合 model(含一筆缺價)的 model_breakdown,斷言總省下成本等於逐 model 加總(如 2.70 + 4.50 = 7.20)且非 NaN/非負;`cargo check` 通過。這對應 spec 的 **Cache efficiency card** 需求。

## 2. 前端比率統一

- [x] 2.1 [P] 依設計「統一快取命中率為可快取輸入分母公式」修改 `token-insights.ts`:`cacheReadRatio()` 分母改為 `composition.input + composition.cacheRead`;`getTopModelInsights` 每模型比率改為 `model.cache_read_tokens / (model.input_tokens + model.cache_read_tokens)`;分母為 0 回傳 0。驗證:`pnpm tsc` 通過;對 input=800/cacheRead=200 斷言比率為 0.2;統計卡退路與 Top models 表在同資料下比率一致。這對應 spec 的 **Consistent cache hit ratio across dashboard views** 需求。

## 3. 前端改用後端單一真實來源

- [x] 3.1 依設計「前端改呼叫後端單一真實來源」修改 `TokensPage.tsx` 與 `hooks/useTokenQueries.ts`:新增呼叫既有 `get_cache_efficiency` 指令的 query hook(沿用 daily granularity 與 `auto_dated` 來源、相同日期界線),`TokensPage` 改用其回傳的 `CacheEfficiency`,移除內嵌的 `cache_hit_ratio` 計算與寫死的 `(3.0 - 0.3)` 成本。驗證:`pnpm tsc` 通過;`TokensPage.tsx` 不再含 `(3.0 - 0.3)` 或內嵌 `cache_hit_ratio` 計算;快取效率卡顯示值來自後端。

## 4. UI 規範審查與端對端驗證

- [x] 4.1 對快取效率卡、統計卡、Top models 表的數值呈現執行 `/felina-ui-guidelines` review,記錄命中的 guideline、是否有 deviation 與理由(供 archive notes 使用)。驗證:review 結論已記錄,無未說明的 deviation。
- [x] 4.2 端對端驗證:`cargo check` 與 `pnpm tsc` 通過;同一資料下快取效率卡、統計卡、Top models 表三處的快取命中率數值一致;快取省下成本反映混合 model 的實際定價而非單一 Sonnet 假設;後端 `get_cache_efficiency` 查詢失敗時頁面不凍結、不顯示 NaN。驗證:依上述各項手動逐條確認通過。
