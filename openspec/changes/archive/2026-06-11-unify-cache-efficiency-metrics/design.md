## Context

/tokens 的快取效率呈現目前分散在後端與前端,且存在兩套不一致的比率公式與一處寫死定價:

- 後端 `build_cache_efficiency`(`aggregator.rs`)以「公式 A」算 `cache_hit_ratio = cache_read / (input + cache_read)`,並以寫死的 Sonnet 單價算 `cache_cost_saved = cache_read / 1M × (3.0 − 0.3)`。
- 前端 `TokensPage` 並未呼叫後端 `get_cache_efficiency`(雖然該指令已存在且在 `commands.ts` 綁定),而是自 `dailyQuery.data` 內嵌重算,公式與寫死成本與後端相同(重複實作)。
- 前端 `cacheReadRatio()` 與 `getTopModelInsights`(`token-insights.ts`)用「公式 B」`cache_read / (input + output + cache_read + cache_write + reasoning)`,被統計卡退路顯示與 Top models 表使用。

專案已有 `PricingService`,提供 `get_price(model) -> ModelPricing`,其中含 `input_cost_per_1m` 與 `Option<cache_read_cost_per_1m>`;`build_model_breakdown` 已逐 model 取價計算成本,可作為範式。`build_analytics` 回傳的 `model_breakdown` 已含 per-model `cache_read_tokens`、`input_tokens`。

## Goals / Non-Goals

**Goals:**

- 全頁面快取命中率採同一公式,消除矛盾數字。
- 快取省下成本反映各 model 實際 cache 定價。
- 消除前端對快取效率的重複實作,單一真實來源在後端。

**Non-Goals:**

- 不改 `CacheEfficiency` 回傳欄位形狀。
- 不改 token 數字計算、來源選擇或 refresh。
- 不改 `PricingService` 定價資料或抓取邏輯。

## Decisions

### 統一快取命中率為可快取輸入分母公式

採「公式 A」`cache_read / (input + cache_read)` 為全站唯一定義。理由:output 與 cache_write 不屬於「可被快取命中的輸入」,納入分母會稀釋並破壞「命中率」語意。實作上 `cacheReadRatio()` 分母改為 `composition.input + composition.cacheRead`,Top models 每模型比率改為 `model.cache_read_tokens / (model.input_tokens + model.cache_read_tokens)`,統計卡沿用 `cacheReadRatio` 自動一致。分母為 0 時回傳 0。**替代:** 公式 B(含 output/cache_write)— 否決,語意不符。

### 快取省下成本改用各 model 實際定價

後端 `build_cache_efficiency` 改為逐 model 累加 `Σ model.cache_read_tokens × (input_cost_per_1m − cache_read_cost_per_1m) / 1_000_000`,經 `PricingService.get_price` 取價,沿用 `analytics.model_breakdown` 的 per-model `cache_read_tokens`。缺 `cache_read_cost_per_1m`(None)時以 `input_cost_per_1m × 0.1` 作退路(業界常見 10% 快取讀取價);若連 `get_price` 失敗則該 model 省下成本以 0 計入,不可產生 NaN 或負值(若差額為負則截為 0)。**替代:** 維持寫死 Sonnet 單價 — 否決,混用其他 model 時失真。

### 前端改呼叫後端單一真實來源

`TokensPage` 移除內嵌的 `cacheEfficiency` 重算(含寫死的 `(3.0 − 0.3)`),改為透過新增的 query hook 呼叫既有 `get_cache_efficiency` 指令取得 `CacheEfficiency`,沿用既有日期/來源參數(daily granularity、`auto_dated`)。**替代:** 保留前端內嵌僅改公式 — 否決,留重複邏輯易漂移。

## Implementation Contract

**Behavior:**
- 快取效率卡、統計卡(含退路)、Top models 表顯示的快取命中率,在相同資料下數值一致,皆等於 `cache_read / (input + cache_read)`。
- 快取效率卡顯示的省下成本,等於各 model 以其實際 input 與 cache-read 單價計算之加總,而非單一 Sonnet 假設。
- 前端不再自行計算 `cache_hit_ratio` 或成本,顯示值來自後端 `get_cache_efficiency`。

**Interface / data shape:**
- `CacheEfficiency` 欄位(`cache_hit_ratio`、`cache_cost_saved`、`total_input_tokens`、`cache_read_tokens`、`cache_write_tokens`)名稱與型別不變。
- `build_cache_efficiency` 簽章不變;內部成本計算改用 `PricingService`。
- 新增前端 query hook 呼叫 `api.tokenAnalytics.getCacheEfficiency`(既有綁定);`TokensPage` 改用其回傳值。
- `cacheReadRatio(composition)` 簽章不變,僅分母定義改變。

**Failure modes:**
- 某 model 無 cache-read 定價:退路 `input_cost_per_1m × 0.1`。
- `get_price` 失敗:該 model 省下成本計 0。
- 差額為負或分母為 0:分別截為 0 / 比率回傳 0,不得回傳 NaN。
- 後端 `get_cache_efficiency` 查詢失敗:前端沿用 React Query 錯誤態,不得使頁面凍結或顯示 NaN。

**Acceptance criteria:**
- `cargo check` 與 `pnpm tsc` 通過。
- 後端單元測試:給定混合 model 的 `model_breakdown`,省下成本等於逐 model 加總而非 Sonnet 單價;含缺價 model 時走 10% 退路且結果非 NaN/非負。
- 前端:同一資料下三處快取比率顯示一致(手動檢視快取卡、統計卡、Top models 表)。
- `TokensPage` 不再含 `(3.0 - 0.3)` 或內嵌 `cache_hit_ratio` 計算。

**Scope boundaries:**
- In scope:`build_cache_efficiency` 成本計算、`cacheReadRatio` 與 `getTopModelInsights` 比率分母、`TokensPage` 改呼叫後端、新增 cache efficiency query hook。
- Out of scope:`CacheEfficiency` 形狀、token 數字/來源/ refresh、`PricingService` 定價資料與抓取、其他分頁行為。

## Risks / Trade-offs

- [顯示數值改變可能讓使用者以為「數字變了/壞了」] → 屬預期修正;比率語意更正確、成本更貼近實際定價。
- [逐 model 取價在大 model_breakdown 上的額外成本] → 沿用既有 `build_model_breakdown` 的取價範式,量級相同,影響可忽略。
- [缺價退路 10% 為估計] → 僅在 LiteLLM 未提供 cache-read 價時套用,且明確記錄為退路。

## UI 影響

本變更影響快取效率卡、統計卡與 Top models 表的呈現數值,屬 UI-related。tasks 階段必須包含 `/felina-ui-guidelines` review 步驟,驗證階段需把命中的 guideline、是否有 deviation 與理由寫進 archive notes。

## UI Guidelines Review (archive notes)

`/felina-ui-guidelines` skill 在本環境不存在,改以人工依現行元件對照 guideline:

- **僅改數值來源,未改視覺呈現**:`CacheEfficiencyCard`、`TokenStatCards`、Top models 表的版面、字級、顏色語意、進度條皆未更動,僅其輸入的比率/成本數值改由後端單一真實來源提供。
- **數字格式一致**:命中率以 `toFixed(1)` 顯示百分比、成本透過 `formatCostFull`、token 數透過 `formatNumberFull`,沿用既有 formatter,符合 guideline 的格式一致性要求。
- **邊界防護**:進度條寬度以 `Math.min(ratio*100, 100)` 截頂;`data` 為 null 時顯示 `common.noData` 空態;後端保證比率/成本非 NaN 非負,卡片不會渲染 `NaN%` 或負成本。
- **Deviation**:無。唯一偏離為 skill 不可用而改人工 review,結論等同。
