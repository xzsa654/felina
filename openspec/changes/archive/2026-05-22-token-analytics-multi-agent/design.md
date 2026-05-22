## Context

Glyphic 是 Tauri + React 桌面應用，目前 token 系統分為兩部分：(1) Token Savings Optimizer 過濾 CLI 輸出以節省 token，資料存在 `~/.glyphic/savings.jsonl`；(2) Budget/Cost 從 Claude Code stats cache 讀取 `dailyModelTokens`，以靜態定價表（僅 Claude 模型）計算花費。兩個子系統互相獨立，但都沒有可擴充的多 agent 架構。

參考 tokscale 的設計：Rust 原生核心 + AgentParser trait + rayon 平行掃描 + SQLite 快取 + LiteLLM 即時計價 + React recharts 視覺化。

## Goals / Non-Goals

**Goals:**

- 建立 `AgentParser` trait 與 `ParserRegistry`，讓每個 AI coding agent 有獨立的 parser
- 實作 Claude Code parser 作為第一優先，隨後加入 Codex CLI、Gemini CLI
- 以 SQLite（`~/.glyphic/tokens.db`）快取掃描結果，支援增量更新
- 以 LiteLLM API 取得即時模型定價，1 小時 disk cache，static fallback
- 提供 5 個 Tauri commands 給前端查詢聚合後的 token analytics
- 以 recharts 建立完整 Token Analytics 儀表板：時間序列圖、model breakdown、hourly heatmap、cache efficiency、agent 分佈
- 取代舊 `AnalyticsPage`，路由改為 `/tokens`

**Non-Goals:**

- Token Savings Optimizer 保持不動
- 不實作 TUI
- 不引入伺服器端基礎設施

## Decisions

### 使用 SQLite 快取而非每次掃描檔案

Agent 對話紀錄可能達到數十萬行 JSONL，每次頁面載入都重新掃描不可行。SQLite 資料庫作為 materialized cache，增量掃描只處理 `mtime` 在 `MAX(timestamp)` 之後的檔案。

替代方案：每次都全掃（效能差）、只用記憶體快取（重啟後丟失）。

### 使用 rayon 平行掃描而非 async tokio

檔案掃描是 IO-bound 工作，rayon 的 thread-pool 平行處理比 async 的協調開銷更低，且與 tokscale 的做法一致。每個 parser 的檔案獨立處理，無需複雜的 async 協調。

替代方案：tokio async（對 CPU-bound JSON parsing 無優勢）。

### 使用 LiteLLM API 而非純靜態定價

LiteLLM 社群維護完整的模型定價清單（`model_prices_and_context_window.json`），涵蓋 Anthropic、OpenAI、Google 等數十個 provider。透過 HTTP fetch + 1 小時 disk cache 取得最新定價，fallback 到內建 static map。

替代方案：純靜態表（無法跟上新模型）、OpenRouter API（需 API key）。

### 使用 recharts 而非 visx/nivo

recharts 是 React-native 的宣告式圖表庫，支援 AreaChart、BarChart、PieChart 等所需類型，學習曲線低，bundle 適中（~200KB gzipped）。

替代方案：visx（太底層，需自行組合）、nivo（功能強但 bundle 較大）。

### Token Analytics 頁面取代 AnalyticsPage，路由 /tokens

舊 AnalyticsPage 功能有限，直接用新的 TokensPage 取代。`/analytics` 設 redirect 至 `/tokens`。NAV_ITEMS 新增 `"tokens"` item，移除 `"analytics"`。

## Risks / Trade-offs

- **LiteLLM API 可能變更或無法存取** → 1 小時 disk cache + static fallback，不影響基本功能
- **SQLite concurrent access** → Tauri 使用單一 `Mutex<TokenAggregator>`，避免寫入競爭；SQLite WAL mode 支援並行讀取
- **多 agent parser 可能有 bug 導致 parse 失敗** → 每個 parser 獨立，一個失敗不影響其他；parse 錯誤記錄到 log
- **recharts bundle 增加約 200KB** → TokensPage 使用 lazy loading，不影響初始載入
- **舊 AnalyticsPage.svelte 被移除** → 確認沒有其他元件引用該 Svelte 版本

## Migration Plan

1. Phase 1: 實作 Rust tokens 模組（types、scanner、Claude parser、storage、pricing、commands）
2. Phase 2: 實作 React TokensPage + 13 個元件 + 路由更新
3. Phase 3: 加入多 agent parsers + agent filter UI
4. Phase 4: 預算整合、成本預測、匯出、清理舊程式碼

Rollback: 每個 phase 獨立可驗證（`cargo check` + `npm run build`），可隨時停止。

## Open Questions

- 未來是否需要支援自訂 agent parser（plugin 機制）？目前先 hardcode 3 個 parser（Claude Code、Codex CLI、Gemini CLI）。
- 是否需要 token 使用量異常警示（spike detection）？暫不列入本次範圍。
