## 1. Scan State Model

- [x] 1.1 實作 Persist per-agent scan cursors 的持久化資料模型，讓每個 agent/source path 保存 last successful mtime、last scan timestamp 與 last error summary；以 Rust storage 單元測試驗證新資料庫會建立 scan state table，既有 token_events schema 保持可讀。
- [x] 1.2 實作 Persist per-agent scan cursors 的讀寫 API，讓 scanner 在 refresh 前可讀取 cursor、refresh 成功後可更新 cursor；以測試驗證 app restart 後重新開啟 storage 仍可讀回 cursor。

## 2. Scanner Behavior

- [x] 2.1 依照 Use file mtime and source identity as scan boundaries 實作 Incremental scan processes changed sources，讓 mtime 新於 cursor 的檔案全部被掃描；以測試建立 75 個 changed files 驗證沒有固定 50 檔截斷。
- [x] 2.2 實作 Incremental scan processes changed sources 的舊檔追加案例，讓已存在但 mtime 變新的 conversation file 會在下一次 refresh 被處理；以 scanner fixture 測試驗證新增事件被 parsed 並 upsert。
- [x] 2.3 保留 SQLite uniqueness remains the duplicate safety net 與 Keep duplicate prevention in SQLite 的 duplicate safety net，讓 intentional rescan 不會插入重複 token_events；以 storage upsert 測試驗證 parsed events 與 inserted events 可分開計數。

## 3. Refresh Contract

- [x] 3.1 實作 Surface refresh errors without failing the whole scan 的 Refresh result reports scan coverage，讓 RefreshResult 回傳 agents scanned、files scanned、files skipped、events parsed、events inserted、errors；以 Rust command 測試或序列化測試驗證 JSON shape。
- [x] 3.2 實作 Refresh result reports scan coverage 的單檔 parse error 行為，讓壞檔錯誤被收集且其他檔案繼續掃描；以 fixture 測試驗證 response errors 包含 agent id、source identifier 與 error message。
- [x] 3.3 同步 TypeScript `RefreshResult` 與 AgentStatusPanel 顯示契約，讓 UI 能呈現 refresh coverage 與最後錯誤摘要；以 `npm run build` 驗證前端型別與編譯通過。

## 4. Audit Follow-up

- [x] 4.1 修正 cursor advancement：若同一 source path 內有任何需要重試的 parse failure，cursor 不得前進到會讓該失敗檔案下次被跳過的位置；以測試覆蓋「舊檔失敗、較新檔成功、下一次 refresh 仍會重試舊檔」。
- [x] 4.2 修正 scan state error propagation：`get_cursor`、`upsert_cursor`、`upsert_error` 的 storage/lock/query 錯誤不得靜默吞掉，refresh 必須回傳系統錯誤；以測試覆蓋讀寫失敗路徑。
- [x] 4.3 修正 refresh coverage：`agents_scanned` 必須由實際 scanned available parsers 計算，不能在 command 或 aggregator 硬寫為 3；以測試覆蓋 unavailable agent 的回傳數字。
- [x] 4.4 修正 AgentStatus contract：`last_scanned` 改由 scan state 的 last scan timestamp 取得，並暴露 persisted last error summary 或等價狀態欄位給 UI。
- [x] 4.5 修正測試隔離：`TokenStorage` 與 `ScanState` 測試不得操作真實 `~/.glyphic/tokens.db`，應使用可注入的 temp DB path 或共享測試資料庫隔離；`cargo test` 預設平行執行必須通過，不需要 `--test-threads=1`。
