## 1. Tokscale Production Source

- [x] 1.1 依照 Use tokscale export as the primary production ingestion backend 與 Use tokscale as production token ingestion source，建立 tokscale-backed production ingestion entrypoint，讓 `refresh_token_data` 成功時以 tokscale export 更新 analytics source 而不是預設呼叫 Felina parsers；以 unit test 或 integration test 驗證 active source 為 `tokscale_export` 且 parser path 未被自動使用。
- [x] 1.2 依照 Normalize tokscale records before storage or aggregation 與 Normalize tokscale usage rows，補齊 tokscale ingestion normalization，讓 `client=claude/codex/gemini`、`input`、`output`、`cacheRead`、`cacheWrite`、`reasoning`、`messageCount` 轉成 internal analytics shape；以 fixture test 驗證 Claude/Codex examples 的 agent、cache、reasoning、message count 完整保留。
- [x] 1.3 依照 Normalize tokscale records before storage or aggregation 與 Normalize tokscale usage rows，對 missing required fields、unsupported clients、zero-token rows 回傳 unsupported schema 或 observable error，不產生 zero-token production records；以 table-driven test 驗證 unsupported schema cases。

## 2. API Compatibility and Aggregation

- [x] 2.1 依照 Keep the analytics API stable while changing the backend 與 Preserve `/tokens` analytics API compatibility，讓 `get_token_analytics` 與 `/tokens` frontend response shape 維持既有欄位與型別，但 totals、agent breakdown、model breakdown、time series、cache metrics 來自 tokscale-backed normalized data；以 serialization test 或 command integration test 驗證 response shape 相容。
- [x] 2.2 依照 Keep the analytics API stable while changing the backend，讓 refresh result 與 diagnostics 暴露 active source、last successful refresh、failure status，不要求 frontend schema redesign；以 command-level test 驗證成功與失敗 response 都包含可觀測 source/status。

## 3. Storage Migration and Isolation

- [x] 3.1 依照 Isolate legacy Felina parser data from tokscale-backed data 與 Isolate legacy parser data from tokscale-backed data，實作 active source/generation 或 reversible backup/rebuild migration，讓 migration 後 production analytics 不會混算 legacy parser rows；以 storage integration test 驗證 legacy total 與 tokscale total 不相加。
- [x] 3.2 依照 Isolate legacy Felina parser data from tokscale-backed data，保留 rollback 路徑，讓 migration 失敗或使用者回退時可恢復 migration 前 storage state 或 active generation；以 storage test 或 CLI smoke test 驗證 rollback 後舊 analytics 可讀。
- [x] 3.3 依照 Isolate legacy Felina parser data from tokscale-backed data，產出 `docs/tokscale-backed-token-ingestion.md`，記錄 migration 策略、backup/active generation 行為、rollback 指令或手動步驟；以 content review 驗證文件包含 source isolation 與 rollback 說明。

## 4. Failure Modes and Fallback

- [x] 4.1 依照 Make fallback explicit and observable 與 Surface tokscale failures without corrupting analytics，實作 missing binary、command failed、unsupported schema、parse failed 的 distinct refresh statuses，且失敗時不清空或覆寫 last successful analytics；以 failure-mode tests 驗證每個 status 與 preserve-last-success behavior。
- [x] 4.2 依照 Make fallback explicit and observable 與 Require explicit parser fallback，停用 automatic parser fallback，並只在 explicit fallback option 啟用時執行 Felina parser path；以 test 驗證預設失敗不跑 parser、explicit fallback 會標示 active source 為 parser fallback。
- [x] 4.3 依照 Use tokscale as production token ingestion source，確認 production code 不呼叫 tokscale `submit`、login、browser-flow command，只使用 machine-readable local report command；以 unit test 或 command construction test 驗證 tokscale args 僅包含 allowed report flags。

## 5. Verification and Handoff

- [x] 5.1 執行真實或 mocked tokscale-backed refresh smoke test，確認 `/tokens` analytics totals 來自 tokscale-backed records、legacy parser rows 未混算、失敗時保留 last successful analytics；將指令與結果摘要寫入 `docs/tokscale-backed-token-ingestion.md`。
- [x] 5.2 執行 `cargo test --manifest-path src-tauri/Cargo.toml tokens::`，確認 token ingestion、storage、aggregator、failure-mode tests 通過；若本機環境無法執行，需在 `docs/tokscale-backed-token-ingestion.md` 記錄阻塞原因。
- [x] 5.3 執行 `spectra analyze tokscale-backed-token-ingestion --json` 與 `spectra validate tokscale-backed-token-ingestion`，確認 proposal、design、spec、tasks 無 Critical 或 High 問題且 change 可進入 apply；以 CLI output 驗證。
