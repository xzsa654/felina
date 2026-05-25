## Context

`/tokens` 目前的資料路徑是 parser 掃描 Claude Code、Codex CLI、Gemini CLI 本機日誌，轉成 Felina `TokenEvent`，再寫入 `~/.glyphic/tokens.db`，最後由 aggregator 產生 model breakdown、agent breakdown、time series 與 cost。近期使用 tokscale 對照後，模型明細與 agent 總量出現不可接受的落差，尤其 Codex CLI 數字可能高於實際使用量、甚至高過 Claude Code。

這個問題不適合再用單點 parser patch 處理。現有程式同時面臨多個不確定性：Codex session JSONL 可能同時包含 per-turn 與 cumulative usage、長檔案截斷會讓 parser coverage 不透明、Claude data directories 可能重疊、cache token 欄位在不同工具間命名不同。tokscale 已經是專門處理多 coding agent usage 的外部工具，因此本 change 先建立可重現對帳與 source-of-truth 決策門檻，再決定是否啟動 ingestion 重構。

## Goals / Non-Goals

**Goals:**

- 建立一個可重現的 token usage reconciliation path，比較 Felina DB、Felina parser rescan 與 tokscale export 的同期間結果。
- 在 agent、model、provider、date bucket、session id 層級輸出差異，讓「Codex 是否被膨脹」這類問題能被定位到來源。
- 明確列出造成差異的候選原因，包括 cumulative usage、截斷、重複掃描、timestamp 缺失、cache token mapping 與 cost/pricing 差異。
- 定義 tokscale 成為 candidate source of truth 的最低條件，避免後續重構建立在不穩定輸出或不完整欄位上。
- 產出 migration decision report，讓後續 change 可以選擇修補 Felina parser 或改成 tokscale-backed ingestion。

**Non-Goals:**

- 不直接替換 `refresh_token_data` 的 production ingestion path。
- 不直接刪除現有 Claude/Codex/Gemini parser。
- 不改動 `/tokens` React UI、Tauri analytics response shape 或現有圖表版面。
- 不在本 change 內重建、清空或自動遷移既有 `~/.glyphic/tokens.db`。
- 不把 tokscale 內部 cache schema 視為穩定 API；除非有明確穩定契約，否則只使用 CLI/export 層。

## Decisions

### Compare three independent token sources

對帳工具同時讀三組來源：既有 `token_events` SQLite 聚合、Felina parser 對原始日誌的 dry-run rescan、tokscale CLI 或 export 結果。只比較 DB 與 tokscale 不足以判斷錯誤發生在 parser、storage 去重、aggregator 還是 tokscale mapping；加入 parser rescan 可把問題切成 ingestion 前後兩段。

替代方案是直接相信 tokscale 並替換 ingestion。這會太快跨進重構，且無法回答既有資料是否需要清理、哪些欄位能安全 mapping、以及差異是否來自 cost/pricing 而非 token count。

### Normalize comparison before judging correctness

三組來源都先轉成 reconciliation record，而不是直接比較各自原生輸出。record 至少包含 source name、agent、provider、model、timestamp bucket、session id、input tokens、output tokens、cache read tokens、cache write tokens、reasoning tokens、event count 與 source path 或 source key。比較時必須分開 token count 差異與 cost 差異，避免 pricing 問題被誤判成 usage 問題。

替代方案是只比總數。總數可以證明有落差，但不能定位 Codex 膨脹是來自某個 session、某個 model、某一天，或某種欄位 mapping。

### Classify mismatch causes explicitly

對帳輸出不只顯示數字不同，還要標記候選原因。Codex 的 `total_token_usage` 被當成 per-turn event、同一 Claude source 被兩個 data directory 掃到、timestamp 為 0 導致 date range 行為不同、長 JSONL 前 500 行截斷、cache input 欄位命名不一致，這些都要有獨立 classification。無法分類的差異要被標成 unknown，而不是靜默吞掉。

替代方案是在報告中只列 raw diff。raw diff 對工程修復幫助有限，後續仍會回到逐檔手查。

### Treat tokscale as candidate source of truth, not a hidden dependency

本 change 只評估 tokscale 是否適合成為 source of truth。tokscale 可成為後續 ingestion backend 的條件是：可用非互動命令產生 machine-readable output、輸出欄位能映射到 Felina `TokenEvent`、版本或 schema 可記錄、命令失敗時有可診斷錯誤、缺少 binary 時不破壞現有 `/tokens` 功能。

替代方案是直接讀 tokscale 內部儲存或 cache。這會把 Felina 綁到外部工具的私有 layout，後續 tokscale 升級時風險較高。

### Gate the migration with a decision report

調查完成後必須產出 `docs/token-usage-source-of-truth.md`，內容包含執行命令、比較期間、三組來源版本或 schema、主要差異表、原因分類、建議路線與下一步 Spectra change 名稱。若 tokscale 達到條件，後續才開 tokscale-backed ingestion 重構；若未達條件，後續只針對已定位的 parser/storage 問題修補。

替代方案是在同一 change 內同時調查與重構。這會讓 scope 過大，且在 source-of-truth 還沒確認前修改 production ingestion，容易製造新的不可信資料。

## Implementation Contract

新增一個 local-only reconciliation command 或 binary，預設不改寫 `~/.glyphic/tokens.db`。呼叫者可以指定 date range、agent filter、model filter 與是否執行 tokscale comparison。命令完成時輸出 machine-readable JSON 與 human-readable summary，兩者都必須包含三組來源的 totals、per-agent totals、per-model totals、per-day totals、session-level top mismatches 與 mismatch classifications。

JSON response 必須區分來源：`felina_db` 代表既有 SQLite 聚合，`felina_rescan` 代表 parser dry-run 結果，`tokscale_export` 代表 tokscale CLI/export 結果。每個來源必須記錄 collection status，例如 `ok`、`missing_binary`、`command_failed`、`unsupported_schema`、`parse_failed`。tokscale 不可用時，command 仍可比較 Felina DB 與 Felina parser rescan，並在 report 中明確標示 tokscale source unavailable。

命令不得更新 scan cursors，不得 upsert token events，不得觸發 production refresh。任何需要讀取原始 agent log 的行為都必須是 read-only。若需要暫存資料，必須使用 temporary path 或 memory-only 結構，不能污染 production token storage。

接受標準是：同一 date range 下，reviewer 能用一個命令產出 report，看到 Codex CLI 與 Claude Code 的 source-by-source 差異；若 Codex 顯著高於 tokscale，報告能指出 top mismatching sessions 或 model buckets；若差異原因無法分類，報告必須保留 unknown bucket 並列出足夠 metadata 供人工追查。

Interface depth check:

- Seam location: reconciliation contract 屬於 token ingestion 旁路，應放在 tokens 模組下並由獨立 binary 或 local command 觸發，不屬於 `/tokens` UI render path。
- Adapter count: tokscale adapter 只負責執行命令與解析 export；normalization 與 diff classification 不應混在 adapter 內。
- Depth: reconciliation module 有實際行為，包括 source collection、normalization、diff aggregation、classification 與 report rendering，不是單純 pass-through。
- Deletion test: 若刪除 reconciliation module，production `/tokens` 仍可運作，但團隊會失去判斷 parser 修補或 tokscale migration 的依據；因此它是決策工具，不是 production runtime dependency。

## Risks / Trade-offs

- [Risk] tokscale CLI/export schema 可能變動 → Mitigation: report 記錄 tokscale version 或 command metadata，parser 對未知 schema 回傳 `unsupported_schema`，不靜默產生錯誤數字。
- [Risk] 對帳工具讀取大量本機日誌可能很慢 → Mitigation: date range 與 agent filter 為一等參數，summary 先輸出聚合結果，session-level 明細限制 top mismatches。
- [Risk] 使用者誤以為本 change 已修正 production `/tokens` 數字 → Mitigation: proposal、design、tasks 都明確標示本 change 不替換 production ingestion，也不修改 UI response shape。
- [Risk] source-of-truth 判斷仍可能卡在 unknown mismatch → Mitigation: unknown 必須可觀測，report 保留 source path/session/model/date metadata，讓下一個 change 能針對性修補。
