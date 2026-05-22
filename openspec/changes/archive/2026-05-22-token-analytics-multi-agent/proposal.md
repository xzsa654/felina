## Why

Glyphic 目前僅支援 Claude Code 的 token 追蹤，計價表靜態寫死，視覺化僅有基礎統計卡片。專案未來將支援多 agent 選擇（Claude Code、Codex CLI、Gemini CLI），需要一個可擴充的 token 資料層與完整的 analytics 儀表板，參考 tokscale 架構（Rust 原生核心 + 多 agent parser + LiteLLM 即時計價 + 豐富視覺化）。

## What Changes

- **重寫 token 資料層**：新增 `src-tauri/src/tokens/` Rust 模組，包含 `AgentParser` trait、3 個 agent parser（Claude Code、Codex CLI、Gemini CLI）、rayon 平行掃描器、SQLite 快取（`~/.glyphic/tokens.db`）、LiteLLM 計價服務
- **新增 Tauri commands**：`get_token_analytics`、`get_model_breakdown`、`get_cache_efficiency`、`get_available_agents`、`refresh_token_data`
- **新增 Token Analytics 儀表板**：`TokensPage` + 13 個視覺化元件（recharts 圖表、hourly heatmap、cache efficiency、agent 分佈、預算卡片），取代舊 `AnalyticsPage`
- **路由更新**：新增 `/tokens` 路由與 nav item，`/analytics` redirect 至 `/tokens` — **BREAKING**：移除 `AnalyticsPage.tsx` 及 `.svelte` 版本
- **Dashboard 整合**：cost card 改用新 token analytics API
- **計價升級**：從靜態 Claude-only 定價表改為 LiteLLM HTTP 即時計價 + 1 小時 disk cache + static fallback

## Non-Goals

- Token Savings Optimizer（filter/sidecar/savings.jsonl）保持不動，是獨立子系統
- 不實作 TUI（桌面應用已提供 GUI）
- 不引入伺服器端基礎設施（全部 local-first）

## Capabilities

### New Capabilities

- `token-data-ingestion`: 多 agent token 資料擷取層，包含 AgentParser trait、平行掃描器、SQLite 儲存
- `token-pricing`: 即時計價服務，從 LiteLLM API 取得模型定價並以 1 小時 disk cache 快取，附 static fallback
- `token-analytics-api`: Tauri commands 提供聚合後的 token 分析數據（時間序列、model breakdown、cache efficiency、agent 狀態）
- `token-analytics-dashboard`: React 儀表板頁面，包含 recharts 圖表、hourly heatmap、model breakdown、cache efficiency card、agent 分佈、預算卡片

### Modified Capabilities

- `app-routing`: 新增 `/tokens` 路由與 `"tokens"` nav item；`/analytics` 改為 redirect 至 `/tokens`；移除 AnalyticsPage 路由

## Impact

- Affected specs: `token-data-ingestion`, `token-pricing`, `token-analytics-api`, `token-analytics-dashboard`（新建）；`app-routing`（修改）
- Affected code:
  - New: `src-tauri/src/tokens/`（10 個 Rust 檔案）
  - New: `src-tauri/src/commands/tokens.rs`
  - New: `src/lib/types/token-analytics.ts`
  - New: `src/lib/components/tokens/`（15 個 TypeScript 檔案）
  - Modified: `src-tauri/Cargo.toml`
  - Modified: `src-tauri/src/lib.rs`
  - Modified: `src-tauri/src/commands/mod.rs`
  - Modified: `src-tauri/src/commands/budget.rs`
  - Modified: `src/lib/types/index.ts`
  - Modified: `src/lib/tauri/commands.ts`
  - Modified: `src/lib/stores/navigation.ts`
  - Modified: `src/router.tsx`
  - Modified: `src/lib/components/dashboard/DashboardPage.tsx`
  - Modified: `src/lib/components/layout/Header.tsx`
  - Removed: `src/lib/components/analytics/AnalyticsPage.tsx`
  - Removed: `src/lib/components/analytics/AnalyticsPage.svelte`
