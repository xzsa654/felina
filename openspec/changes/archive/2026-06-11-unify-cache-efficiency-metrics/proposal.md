## Summary

統一 /tokens 各處的快取命中率公式,並讓快取省下成本改用各 model 實際定價計算,而非寫死 Sonnet 單價。

## Motivation

目前快取效率有兩個獨立問題:

1. **兩套不一致的快取比率分母**:
   - 後端 `build_cache_efficiency` 與 `TokensPage` 內嵌計算用「公式 A」:`cache_read / (input + cache_read)`。
   - 前端 `cacheReadRatio()` 與 Top models 表(`getTopModelInsights`)用「公式 B」:`cache_read / (input + output + cache_read + cache_write + reasoning)`。
   - 同一張頁面上,統計卡(有資料時用 A、退路用 B)與 Top models 表(用 B)會顯示彼此矛盾的快取比率,使用者難以解讀。

2. **省下成本寫死 Sonnet 單價**:`cache_cost_saved` 以 `cache_read / 1M * (3.0 - 0.3)` 計算,等於假設所有 token 都是 Sonnet(一般 input $3/M、cache read $0.3/M)。混用 Codex / Gemini / 其他 Claude model 時,省下成本只是粗估,不反映各 model 真實 cache 定價。專案已有 `PricingService`(`get_price`、各 model 的 `input_cost_per_1m` 與 `cache_read_cost_per_1m`),但此處未使用。

3. **前端重複實作**:`get_cache_efficiency` 後端指令存在且已在前端 API 層綁定,但 `TokensPage` 並未呼叫,而是自行內嵌重算(連同寫死的 `(3.0 - 0.3)`),造成邏輯重複與漂移風險。

## Proposed Solution

- **統一快取命中率公式為「公式 A」**:`cache_read / (input + cache_read)`(分母為「可被快取的輸入」= 全新輸入 + 快取讀取),套用於所有顯示點:
  - 前端 `cacheReadRatio()`(`token-insights.ts`)分母改為 `composition.input + composition.cacheRead`。
  - Top models 表 `getTopModelInsights`(`token-insights.ts`)的每模型比率改為 `model.cache_read_tokens / (model.input_tokens + model.cache_read_tokens)`。
  - 統計卡(`TokenStatCards`)沿用 `cacheReadRatio`,自動一致。
- **省下成本改用各 model 實際定價**:後端 `build_cache_efficiency` 改為逐 model 累加:`Σ model.cache_read_tokens × (input_cost_per_1m − cache_read_cost_per_1m) / 1_000_000`,經由 `PricingService.get_price`(沿用既有 `model_breakdown` 的 per-model cache_read)。當某 model 缺 `cache_read_cost_per_1m` 時,以 `input_cost_per_1m × 0.1`(業界常見 10% 快取讀取價)作為退路。
- **消除前端重複實作**:`TokensPage` 改為呼叫後端 `get_cache_efficiency`(新增對應 query hook),不再內嵌重算 `cache_hit_ratio` 與寫死的成本,使前端顯示與後端單一真實來源一致。

## Non-Goals (optional)

- 不更動 token 數字的計算、來源選擇或 refresh 行為。
- 不改變 `CacheEfficiency` 的回傳欄位形狀(`cache_hit_ratio`、`cache_cost_saved` 等名稱與型別維持不變)。
- 不調整 `PricingService` 的定價資料或抓取邏輯,只是改為在快取成本計算中使用它。
- 不新增第三方依賴。

## Alternatives Considered (optional)

- **統一為「公式 B」(分母含 output/cache_write)**:否決。output 與 cache_write 不屬於「可被快取命中的輸入」,放進分母會稀釋並失去「命中率」語意。
- **保留前端內嵌計算、只改公式**:否決。會留下重複邏輯與寫死成本,日後仍易漂移;改呼叫後端可一次消除。

## Impact

- Affected specs: `token-analytics-dashboard`(修改)
- Affected code:
  - Modified:
    - src-tauri/src/tokens/aggregator.rs
    - src/lib/components/tokens/token-insights.ts
    - src/lib/components/tokens/TokensPage.tsx
    - src/lib/components/tokens/hooks/useTokenQueries.ts
  - New: (none)
  - Removed: (none)
- 依賴變動:無新增 npm / Cargo 依賴(沿用既有 PricingService 與 @tanstack/react-query)。
- 風險評估:
  - 顯示數值會改變(快取比率與省下成本),屬預期的修正而非破壞性 API 變更;`CacheEfficiency` 形狀不變。
  - 後端逐 model 取價需處理缺漏定價的退路,避免回傳 NaN 或負值。
  - 屬 UI-related 變更(影響快取效率卡、統計卡、Top models 表呈現)。
