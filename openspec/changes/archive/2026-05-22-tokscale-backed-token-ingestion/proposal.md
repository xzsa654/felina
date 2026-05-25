## Summary

將 `/tokens` production ingestion 從 Felina 自行掃描多 agent 日誌，重構為 tokscale-backed ingestion，讓 tokscale 成為 token usage 的主要資料來源。

## Motivation

`investigate-token-usage-source-of-truth` 的實測 report 已顯示 tokscale export 可被機器讀取並映射為 Felina reconciliation records，readiness 為 `ReadyForMigrationProposal`，recommendation 為 `propose_tokscale_backed_ingestion`。目前 Felina parser dry-run 與既有 DB 存在大幅差異，尤其 Claude/Codex 的 cache、重疊掃描與 cumulative usage 風險，繼續維護本地多 agent parser 會讓 `/tokens` 數字長期不可信。

## Proposed Solution

- 讓 production `refresh_token_data` 以 tokscale CLI/export 作為主要 ingestion backend，將 tokscale records 正規化為 Felina `TokenEvent` 或等價 analytics input。
- 保留現有 `/tokens` Tauri command 與 frontend response shape，讓 UI 不需要因 backend 來源改變而重寫。
- 明確處理 tokscale 不可用、schema 不支援、command failed、parse failed 的 fallback 與錯誤狀態，不再靜默回報錯誤數字。
- 定義既有 `~/.glyphic/tokens.db` 的 migration 策略，避免舊 Felina parser 產生的膨脹資料與 tokscale-backed 資料混算。
- 將 Felina Claude/Codex/Gemini parsers 降級為 diagnostic/fallback path，除非 tokscale 不可用且使用者明確允許 fallback。

## Non-Goals

- 不改 `/tokens` React UI 版面與 Tauri analytics response shape。
- 不直接依賴 tokscale 私有 cache 或內部 storage layout；只使用 tokscale CLI/export 層。
- 不在本 change 內重新設計 token pricing 或 LiteLLM pricing cache。
- 不提交或上傳使用者 token usage 到 tokscale social platform。

## Alternatives Considered

- 繼續修補 Felina parser：已被 source-of-truth investigation 判定風險較高，因為問題橫跨 Claude overlapping directories、Codex cumulative usage、cache token mapping 與長 JSONL coverage。
- 雙軌永久並行 Felina parser 與 tokscale：會讓 production `/tokens` 同時存在兩套相互衝突的真相來源，適合對帳工具但不適合作為主要 ingestion。

## Capabilities

### New Capabilities

- `tokscale-backed-token-ingestion`: 定義 tokscale-backed production ingestion、DB migration/fallback 行為、source observability 與 `/tokens` API 相容性。

### Modified Capabilities

(none)

## Impact

- Affected specs: `tokscale-backed-token-ingestion`
- Affected code:
  - Modified: src-tauri/src/tokens/mod.rs
  - Modified: src-tauri/src/tokens/tokscale.rs
  - Modified: src-tauri/src/tokens/storage.rs
  - Modified: src-tauri/src/tokens/scanner.rs
  - Modified: src-tauri/src/tokens/aggregator.rs
  - Modified: src-tauri/src/commands/tokens.rs
  - Modified: src-tauri/src/tokens/types.rs
  - Modified: src-tauri/Cargo.toml
  - New: src-tauri/src/tokens/tokscale_ingestion.rs
  - New: docs/tokscale-backed-token-ingestion.md
