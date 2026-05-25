## Why

`/tokens` 的模型明細與 agent 總量目前出現可信度落差，例如 Codex CLI 數字可能高於實際使用量、甚至高過 Claude Code。既有實作已經多次修補 scanner、parser、cursor 與去重，但核心問題是 Felina 仍在自行追多個 AI coding agent 的日誌格式；在決定是否改由 tokscale 作為 ingestion source 前，需要先建立可重現的對帳與決策依據。

## What Changes

- 新增 token usage source-of-truth investigation，讓 Felina 能在同一期間比較三組數據：現有 `token_events` SQLite 聚合、現有 Felina parser 重新掃描結果、以及 tokscale CLI/export 結果。
- 新增診斷輸出，列出 agent、model、provider、date bucket、session id 層級的差異，並標示可能原因，例如 cumulative usage 被當成 per-turn usage、長 JSONL 被截斷、同一來源被重複掃描、timestamp 缺失或 cache token 欄位 mapping 不一致。
- 定義 tokscale 作為 candidate source of truth 的驗收條件：輸出格式可機器讀取、欄位可映射到 Felina `TokenEvent`、差異可追溯、失敗模式可觀測。
- 產出 migration decision report，明確建議保留 Felina parser、修補既有 parser、或啟動後續 tokscale-backed ingestion 重構。
- 保留 `/tokens` 現有 UI 與 Tauri analytics response shape；本 change 不直接替換 production ingestion path。

## Capabilities

### New Capabilities

- `token-usage-source-of-truth`: 定義 token usage 對帳、差異診斷、tokscale source-of-truth 評估與 migration decision gate。

### Modified Capabilities

(none)

## Impact

- Affected specs: `token-usage-source-of-truth`
- Affected code:
  - New: `src-tauri/src/tokens/reconciliation.rs`
  - New: `src-tauri/src/tokens/tokscale.rs`
  - New: `src-tauri/src/bin/glyphic_token_reconcile.rs`
  - New: `docs/token-usage-source-of-truth.md`
  - Modified: `src-tauri/src/tokens/mod.rs`
  - Modified: `src-tauri/Cargo.toml`
  - Modified: `src-tauri/src/tokens/parsers/codex_cli.rs`
  - Modified: `src-tauri/src/tokens/parsers/claude_code.rs`
