## 1. Reconciliation Source Collection

- [x] 1.1 依照 Compare three independent token sources 與 Reconcile independent token usage sources，建立 read-only reconciliation entrypoint，讓操作者可用 date range 執行 Felina SQLite、Felina parser dry-run、tokscale export 三方收集且不寫入 `token_events` 或 scan cursors；以 integration test 或 CLI smoke test 驗證執行後 production DB row count 與 scan state 不變。
- [x] 1.2 依照 Treat tokscale as candidate source of truth, not a hidden dependency 與 Reconcile independent token usage sources，實作 tokscale adapter 的 `missing_binary`、`command_failed`、`unsupported_schema`、`parse_failed` 狀態，讓 tokscale 不可用時仍可完成 Felina DB vs Felina parser dry-run 對帳；以 mock command 或 fixture 測試驗證每個 status 出現在 JSON report。
- [x] 1.3 依照 Compare three independent token sources，讓 Felina parser dry-run 可讀取原始 agent logs 並產出聚合結果，但不得呼叫 `refresh_token_data`、不得 upsert events、不得更新 cursor；以測試驗證 dry-run source collection 不改變 storage 且可回傳 Claude/Codex agent totals。

## 2. Normalization and Diff Classification

- [x] 2.1 依照 Normalize comparison before judging correctness 與 Normalize token source records，定義 normalized reconciliation record，包含 source、agent、provider、model、timestamp bucket、session id、input/output/cache/reasoning tokens、event count 與 source metadata；以 unit test 驗證 Felina parser fixture 與 tokscale fixture 會轉成相同 record shape。
- [x] 2.2 依照 Report scoped aggregate differences，實作 total、agent、model、provider、date bucket、session id 層級 diff，且 token count 差異與 cost/pricing 差異分開呈現；以 fixture 測試驗證 Codex total 高於 tokscale 時 report 包含 agent-level 與 top model/session mismatch。
- [x] 2.3 依照 Classify mismatch causes explicitly 與 Classify mismatch causes，實作 mismatch classification：`cumulative_as_incremental_candidate`、`truncated_jsonl_candidate`、`overlapping_source_directory_candidate`、`missing_timestamp_candidate`、`cache_token_mapping_mismatch`、`reasoning_token_mapping_mismatch`、`storage_duplicate_behavior`、`pricing_only_mismatch`、`unknown`；以 table-driven unit tests 驗證每個 classification 都可被產生。

## 3. Source-of-Truth Evaluation

- [x] 3.1 依照 Treat tokscale as candidate source of truth, not a hidden dependency 與 Evaluate tokscale source-of-truth readiness，檢查 tokscale machine-readable output、field coverage、`TokenEvent` mapping coverage、failure observability、version/schema traceability 與 missing binary behavior；以 fixture 測試驗證 readiness 可回傳 `ready_for_migration_proposal` 或 `blocked` 並列出原因。
- [x] 3.2 依照 Gate the migration with a decision report 與 Produce a migration decision report，產出 `docs/token-usage-source-of-truth.md`，記錄 command、scope、source statuses、aggregate differences、mismatch classifications、tokscale readiness 與 recommendation；以 content review 驗證 report recommendation 只會是 `keep_felina_parser`、`patch_felina_parser`、`propose_tokscale_backed_ingestion`、`defer_pending_evidence`。
- [x] 3.3 依照 Gate the migration with a decision report，加入 material mismatch threshold 或明確判斷規則，讓 Codex 顯著高於 tokscale 時 recommendation 可穩定導向 migration proposal 或 parser patch；以 fixture 測試驗證 material mismatch 與 non-material mismatch 產生不同 recommendation。
- [x] 3.4 補齊 tokscale `--json` 實際輸出的 `client`、`input`、`output`、`cacheRead`、`cacheWrite`、`reasoning`、`messageCount` schema mapping，讓 Claude/Codex records 可完整映射為 reconciliation record；以 fixture 測試與真實 reconciliation report 驗證 tokscale readiness 可達 `ready_for_migration_proposal`。

## 4. Verification and Scope Guardrails

- [x] 4.1 驗證 Reconcile independent token usage sources 的 read-only contract：執行 reconciliation 前後，`~/.glyphic/tokens.db` 的 token event count 與 scan state 不因本工具改變；以 CLI smoke test 或 automated integration test 記錄結果。
- [x] 4.2 驗證 Report scoped aggregate differences 與 Produce a migration decision report 的實際可用性：針對目前本機資料執行一次指定 date range 的 reconciliation，確認 report 能列出 Claude/Codex 差異、top mismatching buckets 與 unknown classification；以手動驗證紀錄附在 change notes 或 report。
- [x] 4.3 執行 `spectra analyze investigate-token-usage-source-of-truth --json`，確認 proposal、design、spec、tasks 在 Coverage、Consistency、Ambiguity、Gaps 檢查中無 Critical 或 High 問題；以 analyzer JSON 結果驗證。
- [x] 4.4 執行 Rust 測試或最小 build 驗證 reconciliation 模組不破壞現有 token analytics API；以 `cargo test` 或 scoped package test 結果驗證，若因本機環境無法執行，需在 report 中記錄阻塞原因。
