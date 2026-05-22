## Summary

將 `/tokens` dashboard 從「圖表集合」重構為 insight-first 使用量摘要，讓使用者一進頁面就能看出 token 使用的主要重點：總量、估算成本、cache 佔比、主要模型與資料解析度。

## Motivation

`toksale-backed` ingestion 讓 `/tokens` 的主要資料來源變成 tokscale aggregate usage，而不是高解析度 per-event timeline。現有前端仍優先呈現 time series、cost trend、hourly heatmap 等時間型圖表；在 aggregate-only 或低解析度資料下，這些圖表不是空白就是語意薄弱，反而遮蔽真正有價值的問題：哪些模型/agent 消耗最多、cache read 為什麼主導總量、估算成本可靠度如何、目前資料解析度能不能支持趨勢判讀。

## Proposed Solution

- 重新安排 `/tokens` 第一屏資訊架構，以 KPI strip、source/status summary、Top Models table、cache breakdown、agent split 作為主要內容。
- 將 Top Models table 升級為主要分析元件，顯示 total tokens、input/output/cache/reasoning 組成、cache read percentage、message count、estimated cost 與 pricing confidence。
- 讓時間型圖表依資料解析度條件顯示：只有 dated/hourly buckets 可用時才呈現趨勢與 heatmap；aggregate-only 時顯示 data resolution panel 與原因說明，不硬畫趨勢。
- 將 refresh/status diagnostics 收斂為 compact source status row，只有失敗或使用者展開時才顯示詳細 diagnostics。
- 將所有成本文案調整為 estimated cost，並在 fallback pricing 或 unknown model pricing 時標示估算限制。

## Non-Goals

- 不改 tokscale ingestion backend、storage migration 或 parser fallback 行為。
- 不重新設計 Tauri command 名稱或破壞既有 `TokenAnalytics` response shape。
- 不新增外部 pricing service、帳單匯入或精準發票對帳。
- 不做整個 app navigation 或 routing redesign。

## Alternatives Considered

- 保留現有圖表並只補 empty state：這能避免空白，但仍把時間圖表放在過高優先級，無法解決「看不出重點」的核心問題。
- 直接要求 backend 產出高解析度 dated buckets：這超出本次前端聚焦範圍，也不符合 tokscale aggregate output 可能只有 summary rows 的現況。

## Impact

- Affected specs: `token-analytics-dashboard`
- Affected code:
  - Modified: src/lib/components/tokens/TokensPage.tsx
  - Modified: src/lib/components/tokens/components/TokenStatCards.tsx
  - Modified: src/lib/components/tokens/components/AgentStatusPanel.tsx
  - Modified: src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - Modified: src/lib/components/tokens/components/ModelBreakdownChart.tsx
  - Modified: src/lib/components/tokens/components/AgentDistribution.tsx
  - Modified: src/lib/components/tokens/components/CacheEfficiencyCard.tsx
  - Modified: src/lib/components/tokens/components/CostBudgetCard.tsx
  - Modified: src/lib/components/tokens/components/TokenTimeSeries.tsx
  - Modified: src/lib/components/tokens/components/TokenCostTimeSeries.tsx
  - Modified: src/lib/components/tokens/components/HourlyHeatmap.tsx
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - Modified: src/lib/types/token-analytics.ts
  - New: src/lib/components/tokens/components/DataResolutionPanel.tsx
  - New: src/lib/components/tokens/components/TopModelsInsightTable.tsx
  - Removed: none
