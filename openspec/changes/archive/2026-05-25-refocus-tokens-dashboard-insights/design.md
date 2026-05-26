## Context

`/tokens` 已從 Felina parser-backed dashboard 轉向 tokscale-backed production ingestion。這讓 `/tokens` 更接近使用量與成本摘要工具，而不是高解析度活動監控工具。現有前端仍保留多個時間型圖表與 scan diagnostics，導致 aggregate-only 資料被硬套進 trend/heatmap，使用者很難快速回答「主要 token 花在哪裡」「cache read 是否主導總量」「成本估算是否可信」。

目前前端資料來源仍是既有 Tauri analytics response shape：`TokenAnalytics`、`ModelBreakdown`、`AgentBreakdown`、`CacheEfficiency`、`RefreshResult`。本 change 應優先重排與解釋現有資料，不要求 backend schema redesign。

## Goals / Non-Goals

**Goals:**

- 讓 `/tokens` 第一屏優先呈現 usage/accounting insights，而不是圖表數量。
- 將 Top Models、cache composition、estimated cost、source/data resolution 變成主要判讀入口。
- 讓 time series、cost trend、hourly heatmap 僅在資料解析度支援時出現。
- 讓 refresh/source diagnostics 精簡但可展開，錯誤時仍清楚可見。
- 保持 `/tokens` Tauri command 與主要 frontend response shape 相容。

**Non-Goals:**

- 不改 tokscale ingestion、storage migration、parser fallback 或 source-of-truth 策略。
- 不新增外部 pricing provider 或精準帳單系統。
- 不刪除現有 chart components；可重排、降級、條件顯示或改為 secondary panel。
- 不做跨頁 navigation redesign。

## Decisions

### Make Top Models the primary analytical surface

Top Models table 應成為頁面主體，因為 tokscale aggregate data 最可靠的切面是 model/agent/provider/message count 與 token composition。表格應預設依 total tokens 或 estimated cost 排序，並顯示 cache read percentage，讓使用者一眼看出用量主因。

替代方案是保留 model cost bar chart 作為主視覺。這在模型數少時可讀，但無法同時呈現 cache ratio、message count、pricing confidence 等決策資訊。

### Gate temporal charts by data resolution

Time series、cost trend 與 hourly heatmap 必須根據資料是否含有 dated/hourly buckets 顯示。若 response 只有 `all` bucket 或 hourly heatmap 為空，頁面應顯示 data resolution explanation，而不是把 aggregate data 畫成趨勢。

替代方案是用 single-bar fallback 顯示 aggregate total。這比空白好，但仍會讓時間型圖表佔據主視覺，與 insight-first 目標相衝突。aggregate totals 應在 KPI、Top Models 與 composition panels 中呈現。

### Treat cost as estimated unless pricing confidence is explicit

所有成本文案應使用 estimated cost。當 model pricing 來自 fallback heuristic 或未知模型時，UI 應標示估算限制；若目前 API 無法逐 row 回傳 pricing source，前端可先用 conservative copy 標示整體成本為 estimated，後續可在 API 增加 pricing confidence。

替代方案是隱藏 cost。這會丟失使用者需要的 accounting signal；較務實的方式是清楚標示估算性質。

### Keep source status compact and diagnostic detail expandable

Source/status row 應顯示 active source、refresh status、last successful source、fallback used、messages/rows summary。詳細 files scanned、errors、inserted rows 等 diagnostics 應只在錯誤或展開狀態顯示，避免佔據分析區域。

替代方案是完全隱藏 diagnostics。這會讓 tokscale missing binary、unsupported schema 或 fallback 狀態難以排查。

## Implementation Contract

Runtime behavior:

- `/tokens` first viewport SHALL prioritize KPI summary, source/data-resolution status, Top Models insights, cache composition, and agent split.
- Temporal charts SHALL NOT be primary content when analytics data contains only aggregate/all-scope buckets.
- If dated buckets are unavailable, the page SHALL show a data resolution panel explaining that trends and hourly activity are unavailable for aggregate-only data.
- If dated buckets are available, the page SHALL allow time series and cost trend views to render as secondary analysis.
- If hourly heatmap data is unavailable, the page SHALL show a clear unavailable state instead of an empty grid.
- Cost labels SHALL communicate that values are estimated.
- Source/refresh diagnostics SHALL be visible in compact form and expandable or emphasized on errors.

Interface and data shape:

- The change SHOULD preserve existing Tauri command names: `get_token_analytics`, `get_cache_efficiency`, `get_available_agents`, and `refresh_token_data`.
- The implementation MAY add frontend-only derived view models for total tokens, cache percentage, pricing confidence copy, and data resolution classification.
- The implementation MAY add optional frontend type fields only if they remain backward-compatible with existing serialized responses.
- The implementation MUST NOT require ingestion backend changes for the first apply pass.

Acceptance criteria:

- A manual `/tokens` review with aggregate-only tokscale data shows no misleading time trend or hourly heatmap as primary content.
- Top Models table displays total token composition and highlights cache-heavy models.
- KPI labels and cost panels use estimated-cost wording.
- Refresh/source status remains visible but does not dominate the page when refresh succeeds.
- `npm run check` passes.

Scope boundaries:

- In scope: `/tokens` React components, token analytics frontend types, i18n strings, visual hierarchy, conditional chart rendering, and focused frontend tests or type checks.
- Out of scope: tokscale command construction, storage schema, parser changes, pricing provider network integration, and app-level route redesign.

## Risks / Trade-offs

- [Risk] Removing or demoting time charts may feel like lost functionality for parser-backed dated data -> Mitigation: keep temporal analysis as secondary content when dated buckets exist.
- [Risk] Estimated-cost wording may reduce perceived precision -> Mitigation: this is intentional; current pricing coverage includes fallback behavior and should not be presented as exact billing.
- [Risk] More table-centric UI can feel dense -> Mitigation: use compact operational-dashboard styling, clear sorting, restrained cards, and avoid nested card layouts.
- [Risk] Existing tests may only cover data shape, not layout hierarchy -> Mitigation: add focused component/unit checks where practical and require manual visual verification for aggregate-only and dated data states.
