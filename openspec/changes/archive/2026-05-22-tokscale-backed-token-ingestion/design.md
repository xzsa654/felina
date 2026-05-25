## Context

`/tokens` 目前的 production ingestion 由 Felina scanner 呼叫 Claude Code、Codex CLI、Gemini CLI parsers，將本機日誌轉成 `TokenEvent` 後寫入 `~/.glyphic/tokens.db`，再由 aggregator 回傳既有 Tauri analytics response。`investigate-token-usage-source-of-truth` 已建立三方對帳，並在真實 tokscale `--json` 輸出可完整映射 `client`、`model`、`provider`、`input`、`output`、`cacheRead`、`cacheWrite`、`reasoning`、`messageCount` 後，將 tokscale readiness 判定為 `ReadyForMigrationProposal`，recommendation 判定為 `propose_tokscale_backed_ingestion`。

現有 Felina parser path 的主要問題不是單一 bug，而是多 agent log semantics 持續漂移：Claude data directories 可能重疊、Codex JSONL 可能混有 cumulative usage、cache token 欄位命名不一致、長 JSONL coverage 不透明。這些 parser 可保留作為診斷工具，但不應再作為 `/tokens` 的主要 truth source。

## Goals / Non-Goals

**Goals:**

- 讓 production token refresh 使用 tokscale CLI/export 作為主要 ingestion backend。
- 保持 `/tokens` Tauri command 與 frontend analytics response shape 相容。
- 將 tokscale output 正規化成 Felina analytics 可消費的資料 shape，包含 agent、provider、model、token fields、message count 與 source metadata。
- 定義舊 `token_events` 的隔離或重建策略，避免舊 Felina parser events 與 tokscale-backed events 混算。
- 將 tokscale unavailable、command failed、unsupported schema、parse failed 變成可觀測狀態，避免靜默產生錯誤數字。
- 保留 Felina parsers 作為 explicit fallback 或 reconciliation diagnostic，不再預設寫入 production analytics storage。

**Non-Goals:**

- 不改 `/tokens` React UI layout、Tauri command 名稱或 frontend response shape。
- 不直接讀 tokscale 私有 cache 或內部資料庫；只使用 tokscale CLI/export 層。
- 不執行 tokscale `submit`、login 或任何上傳 token usage 的行為。
- 不重新設計 pricing provider、currency conversion 或 LiteLLM pricing cache。
- 不刪除 Felina parser 原始碼；刪除可在後續 cleanup change 處理。

## Decisions

### Use tokscale export as the primary production ingestion backend

Production `refresh_token_data` 應先呼叫 tokscale CLI/export，解析 machine-readable output，並將結果轉為 Felina analytics ingestion input。這讓 Felina 不再自行追多個 coding agent 的本機 log format，而是依賴 tokscale 專門維護的 parser coverage。

替代方案是繼續修 Felina parsers。這會把 Claude overlap、Codex cumulative usage、cache mapping、長 JSONL coverage 等問題留在 Felina 內部，且 source-of-truth report 已顯示 Felina rescan 與 tokscale 差異是 material mismatch。

### Keep the analytics API stable while changing the backend

`get_token_analytics`、`refresh_token_data` 與 `/tokens` frontend expected response shape 應維持不變。backend 可以新增 tokscale ingestion module、source metadata 與 storage fields，但 aggregator 必須繼續產生目前 UI 需要的 totals、agent breakdown、model breakdown、time series、cache efficiency 與 refresh status。

替代方案是讓 frontend 直接消費 tokscale JSON。這會把 tokscale schema 泄漏到 UI，讓未來 schema 變動造成前後端同時破壞。

### Normalize tokscale records before storage or aggregation

Tokscale JSON 的 `client`、`input`、`output`、`cacheRead`、`cacheWrite`、`reasoning`、`messageCount` 必須轉成 Felina internal record shape。`client=claude` 對應 `claude-code`，`client=codex` 對應 `codex-cli`，未知 client 必須以 unsupported schema 或 explicit unknown source metadata 回報，不得默默歸到 Claude。

若 tokscale output 只有 aggregate rows 且沒有 per-session timestamp，production ingestion 必須使用明確 bucket strategy：未指定 date scope 時可使用 `all` 或 execution scope metadata；指定 `--since/--until` 時使用該 scope 生成 day/month aggregation，不得偽造不存在的 per-event timestamp。

### Isolate legacy Felina parser data from tokscale-backed data

Migration 必須避免舊 `token_events` 與 tokscale-backed records 混算。可接受策略是新增 source/generation metadata 並只聚合 active generation，或在第一次 tokscale-backed refresh 前以可備份方式重建 token storage。無論採哪一種，實作必須可回滾，且 report 必須寫明舊資料是否仍被 analytics 使用。

替代方案是直接 upsert tokscale records 到現有 unique key。這會讓舊 parser 膨脹資料繼續留在 aggregates 中，無法達成 source-of-truth migration 的目的。

### Make fallback explicit and observable

Tokscale unavailable 時，production refresh 不應靜默改回 Felina parser 並宣稱成功。預設行為應回傳 degraded/error refresh status，保留上次成功 tokscale-backed analytics。只有設定 explicit fallback flag 或 diagnostic command 時，才允許 Felina parser path 執行，且 response/report 必須標示資料來源為 fallback。

替代方案是自動 fallback。這會讓使用者再次看到不可信數字，且無法從 UI/API 判斷資料來自 tokscale 或 Felina parser。

## Implementation Contract

Production refresh behavior:

- `refresh_token_data` MUST attempt tokscale-backed ingestion before any Felina parser scan.
- A successful tokscale-backed refresh MUST update analytics storage or cache using records derived from tokscale CLI/export output.
- A successful tokscale-backed refresh MUST expose source metadata indicating `tokscale_export` or equivalent active source in refresh diagnostics.
- Production refresh MUST NOT call tokscale commands that submit, upload, login, or open browser flows.

Data shape:

- The tokscale ingestion module MUST accept machine-readable JSON containing rows with `client`, `model`, `provider`, `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, and `messageCount`.
- The normalized internal shape MUST contain agent, provider, model, input tokens, output tokens, cache read tokens, cache write tokens, reasoning tokens, event or message count, timestamp bucket or scope bucket, and source metadata.
- `client=claude` MUST normalize to `claude-code`; `client=codex` MUST normalize to `codex-cli`; `client=gemini` MUST normalize to `gemini-cli`.
- Unsupported clients or missing required token fields MUST produce an observable unsupported schema result instead of silently using zero-token records.

Storage and migration:

- The implementation MUST prevent legacy Felina parser rows from being aggregated together with tokscale-backed rows after migration.
- The implementation MUST either mark active source/generation in storage or rebuild token storage through a reversible backup step before writing tokscale-backed records.
- Rollback MUST restore the previous storage state or allow the application to resume using the previous parser-backed data without data loss.

Fallback and failures:

- Missing tokscale binary, command failure, unsupported schema, and parse failure MUST be distinct statuses.
- When tokscale refresh fails, `/tokens` analytics MUST NOT be overwritten with empty or partial tokscale data.
- Automatic Felina parser fallback MUST be disabled by default for production refresh.
- If explicit fallback is enabled, the refresh result MUST indicate fallback source and the analytics MUST be distinguishable from tokscale-backed analytics.

Acceptance criteria:

- A unit test MUST verify tokscale JSON rows for Claude and Codex normalize to the internal ingestion shape including cache and reasoning fields.
- A storage or integration test MUST verify legacy parser-backed data is not aggregated with tokscale-backed data after migration.
- A failure-mode test MUST verify missing tokscale binary does not clear previous analytics and reports a distinct failure status.
- A CLI or integration smoke test MUST run a refresh with tokscale available and show `/tokens` analytics totals sourced from tokscale-backed records.
- `spectra analyze tokscale-backed-token-ingestion --json` MUST report no Critical or High findings before apply is considered complete.

Scope boundaries:

- In scope: Rust token ingestion, storage migration/source isolation, refresh diagnostics, tests, and a short implementation report.
- Out of scope: frontend redesign, pricing redesign, tokscale account login/submit, deleting parser modules, and changing route structure.

## Risks / Trade-offs

- [Risk] tokscale CLI is unavailable on a user machine -> Mitigation: surface missing binary status, keep last successful analytics, and document installation or configured binary path.
- [Risk] tokscale JSON schema changes -> Mitigation: parser returns unsupported schema with source metadata instead of silently producing wrong totals.
- [Risk] aggregate tokscale rows lack per-session timestamps -> Mitigation: preserve scope bucket metadata and avoid fabricating per-event timestamps; time-series fidelity is limited to tokscale output granularity.
- [Risk] migration could discard useful historical parser data -> Mitigation: use backup or generation isolation so rollback can restore previous state.
- [Risk] adding tokscale as runtime dependency creates startup latency -> Mitigation: run tokscale only during refresh, keep cached last-successful analytics for normal page render.

## Migration Plan

1. Add tokscale-backed ingestion behind the existing refresh path while preserving current API shape.
2. On first successful tokscale-backed refresh, create a storage backup or new active generation before writing tokscale-backed records.
3. Switch aggregator to read only the active tokscale-backed generation/source.
4. Keep parser-backed data available for rollback or diagnostic comparison but exclude it from production aggregates.
5. Rollback by restoring the backup or switching active source/generation back to parser-backed data.

## Open Questions

(none)
