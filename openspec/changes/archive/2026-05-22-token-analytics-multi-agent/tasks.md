## 1. Rust 模組基礎架構

- [x] 1.1 在 `src-tauri/Cargo.toml` 新增 dependencies：`rayon`、`simd-json`、`walkdir`、`reqwest`
- [x] 1.2 建立 `src-tauri/src/tokens/mod.rs`、`src-tauri/src/tokens/types.rs`，定義 `TokenEvent`、`TokenAnalytics`、`ModelBreakdown`、`AgentBreakdown`、`TimeGranularity`、`AgentId` 等所有資料結構
- [x] 1.3 在 `src-tauri/src/lib.rs` 加入 `mod tokens`，在 `src-tauri/src/commands/mod.rs` 加入 `pub mod tokens`

## 2. AgentParser trait + Claude Code Parser（token-data-ingestion）

- [x] 2.1 建立 `src-tauri/src/tokens/parsers/mod.rs`，定義 `AgentParser` trait（`agent_id`、`data_directories`、`file_patterns`、`parse_file`、`is_available`）與 `ParserRegistry`，確保實作「AgentParser trait for extensible agent support」規格
- [x] 2.2 建立 `src-tauri/src/tokens/parsers/claude_code.rs`，實作 `ClaudeCodeParser`：掃描 `~/.claude/projects/*/**.jsonl` 與 `~/.claude/stats-cache.json`，解析 `usage` 欄位（input/output/cache_read/cache_write tokens），確保實作「Claude Code parser extracts token events」規格

## 3. Scanner + Storage（token-data-ingestion）

- [x] 3.1 建立 `src-tauri/src/tokens/scanner.rs`，實作 `TokenScanner` 使用 rayon 平行掃描（`par_iter` + `walkdir` + glob），體現「使用 rayon 平行掃描而非 async tokio」設計決策，確保實作「Parallel file scanner with rayon」規格
- [x] 3.2 建立 `src-tauri/src/tokens/storage.rs`，實作 SQLite 資料庫（`~/.glyphic/tokens.db`），體現「使用 SQLite 快取而非每次掃描檔案」設計決策，含 `token_events` table schema、migration、upsert、查詢方法，確保實作「SQLite storage for token events」規格

## 4. Pricing Service（token-pricing）

- [x] 4.1 建立 `src-tauri/src/tokens/pricing.rs`，實作 `PricingService`：LiteLLM HTTP fetch (`reqwest`) + 1 小時 disk cache + 「Static pricing fallback」（涵蓋 Claude、OpenAI、Google 模型），體現「使用 LiteLLM API 而非純靜態定價」設計決策，確保實作「LiteLLM pricing fetch with disk cache」規格
- [x] 4.2 實作 `PricingService::calculate_cost()` 方法，依照 token 數量與各維度定價計算總成本（USD），確保實作「Cost calculation per token event」規格

## 5. Aggregator + Tauri Commands（token-analytics-api）

- [x] 5.1 建立 `src-tauri/src/tokens/aggregator.rs`，實作 `TokenAggregator`：SQL GROUP BY 聚合查詢（time series buckets、model breakdown、agent breakdown、hourly heatmap data），支援 `TimeGranularity` 與可選 filter 參數
- [x] 5.2 建立 `src-tauri/src/commands/tokens.rs`，實作「get_token_analytics command」、「get_model_breakdown command」、「get_cache_efficiency command」、「get_available_agents command」、「refresh_token_data command」五個規格需求，定義 `TokenState` managed state（`Mutex<TokenAggregator>`）
- [x] 5.3 在 `src-tauri/src/lib.rs` 註冊 `TokenState` managed state 與五個新 commands；更新 `src-tauri/src/commands/budget.rs` 的 `get_cost_summary` 改為使用 `TokenAggregator` 聚合後的數據

## 6. React 前端基礎（token-analytics-dashboard）

- [x] 6.1 安裝 recharts：`npm install recharts`（體現「使用 recharts 而非 visx/nivo」設計決策）
- [x] 6.2 建立 `src/lib/types/token-analytics.ts`，定義所有前端型別（`TokenAnalytics`、`ModelBreakdown`、`TokenBucket`、`CacheEfficiency`、`AgentStatus`、`TimeGranularity` 等），並在 `src/lib/types/index.ts` 匯出
- [x] 6.3 在 `src/lib/tauri/commands.ts` 新增 `api.tokenAnalytics` 物件，含 `get`、`getModelBreakdown`、`getCacheEfficiency`、`getAvailableAgents`、`refresh` 方法

## 7. Token Analytics 頁面核心（token-analytics-dashboard）

- [x] 7.1 建立 `src/lib/components/tokens/TokensPage.tsx`，使用 `PageScaffold` 包裝，體現「Token Analytics 頁面取代 AnalyticsPage，路由 /tokens」設計決策，確保實作「TokensPage replaces AnalyticsPage」規格
- [x] 7.2 建立 `src/lib/components/tokens/components/GranularityPicker.tsx`（H/D/W/M toggle 按鈕群）、`DateRangeFilter.tsx`（預設 7d/30d/90d/全部 選項）、`RefreshButton.tsx`（觸發 `refresh_token_data` 並顯示 loading 狀態）
- [x] 7.3 建立 `src/lib/components/tokens/components/TokenStatCards.tsx`，顯示 total tokens、total cost、event count、agent count、cache hit ratio 五個 stat card，確保實作「Token stat cards show summary metrics」規格

## 8. 視覺化元件（token-analytics-dashboard）

- [x] 8.1 建立 `src/lib/components/tokens/components/TokenTimeSeries.tsx`（recharts `AreaChart`，stacked input/output/cache），與 `TokenCostTimeSeries.tsx`（recharts `AreaChart`，daily cost trend），確保實作「Token time series chart」與「Cost time series chart」規格
- [x] 8.2 建立 `src/lib/components/tokens/components/ModelBreakdownChart.tsx`（recharts `BarChart`）+ `ModelBreakdownTable.tsx`（可排序表格），確保實作「Model breakdown chart and table」規格
- [x] 8.3 建立 `src/lib/components/tokens/components/HourlyHeatmap.tsx`：7×24 CSS Grid，5 階色彩 quantile scale，hover tooltip 顯示 token/cost，確保實作「Hourly heatmap grid」規格
- [x] 8.4 建立 `src/lib/components/tokens/components/CacheEfficiencyCard.tsx`：progress bar 顯示 hit ratio % + cost saved，確保實作「Cache efficiency card」規格
- [x] 8.5 建立 `src/lib/components/tokens/components/AgentDistribution.tsx`（recharts `PieChart`）+ `AgentStatusPanel.tsx`（agent 列表含狀態與 RefreshButton），確保實作「Agent distribution chart」與「Agent status panel」規格
- [x] 8.6 建立 `src/lib/components/tokens/components/CostBudgetCard.tsx`：daily/monthly 預算進度條 + 超標警告 + monthly projection，確保實作「Cost budget card」規格

## 9. 路由與整合（app-routing delta）

- [x] 9.1 在 `src/lib/stores/navigation.ts` 中：`Page` type 新增 `"tokens"`，移除 `"analytics"`；`NAV_ITEMS` 替換 analytics 項目為 `{ id: "tokens", label: "Tokens", icon: "coins" }`，確保「Routes defined for all 18 pages」規格的 page-to-path mapping 更新
- [x] 9.2 在 `src/router.tsx`：新增 `/tokens` lazy route、`/analytics` redirect 至 `/tokens`；移除 `AnalyticsPage` 的 lazy import，確保實作「Legacy analytics route redirects to tokens」與「Analytics redirect from old route」規格
- [x] 9.3 在 `src/lib/components/layout/Header.tsx` 中：`PAGE_TITLES` 新增 `tokens: "Tokens"`，移除 `analytics`；`PAGE_DESCRIPTIONS` 對應更新
- [x] 9.4 更新 `src/lib/components/dashboard/DashboardPage.tsx` 的 cost card，改用 `api.tokenAnalytics.get({ granularity: "daily" })` 取得今日花費與 7-day trend，取代舊 `api.budget.getCostSummary()`

## 10. 清理舊程式碼

- [x] 10.1 刪除 `src/lib/components/analytics/AnalyticsPage.tsx` 與 `src/lib/components/analytics/AnalyticsPage.svelte`，完成「Analytics page route」的 REMOVED 規格（舊 analytics 頁面由 TokensPage 取代）
- [x] 10.2 確認無其他檔案 import 舊 `AnalyticsPage`（TypeScript 編譯應無錯誤）

## 11. 多 Agent Parser（Phase 3）

- [x] 11.1 建立 `src-tauri/src/tokens/parsers/codex_cli.rs`：實作 `CodexCliParser`，讀取 Codex CLI session data（`~/.codex/sessions/`），parse 為 TokenEvent
- [x] 11.2 建立 `src-tauri/src/tokens/parsers/gemini_cli.rs`：實作 `GeminiCliParser`，讀取 Gemini CLI JSON session files，parse 為 TokenEvent
- [x] 11.3 更新 `AgentDistribution.tsx` 與 `AgentStatusPanel.tsx`：加入 agent filter 多選下拉與跨 agent 比較視圖

## 12. 預算整合與匯出（Phase 4）

- [x] 12.1 在 `CostBudgetCard.tsx` 中串接 `api.budget.get()` / `api.budget.set()`，顯示可編輯的 daily/monthly budget 設定，超標顯示警告
- [x] 12.2 在 `TokenCostTimeSeries.tsx` 中加入 monthly projection 虛線（基於當月已花費金額推算月底成本）
- [x] 12.3 新增 `src/lib/components/tokens/components/ExportButton.tsx`：支援 CSV 與 JSON 格式匯出當前 token analytics 數據

## 13. 驗證

- [x] 13.1 執行 `cargo check`，確認 Rust 編譯通過
- [x] 13.2 執行 `npx tsc --noEmit`，確認 TypeScript 型別檢查通過
- [x] 13.3 執行 `npm run build`，確認 Vite build 成功且 TokensPage 獨立 chunk
- [x] 13.4 執行 `npm run tauri dev`，手動驗證：/tokens 頁面顯示 Claude Code token 數據、granularity 切換正常、heatmap 色彩正確、model breakdown 排序正確、refresh 按鈕觸發重新掃描
