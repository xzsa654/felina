## Context

Felina 的 token 統計頁(/token)在全新安裝後首次匯入大量歷史資料時會整個 UI 死當。問題不在缺少進度提示,而在並發模型:

- `refresh_token_data`(token 指令)在 `spawn_blocking` 內以 `state.aggregator.lock()` 取得 aggregator 鎖,並在整個 refresh 期間(tokscale npx 呼叫 + 完整 JSONL parser 掃描,首次可達數分鐘)持有不放。
- 所有讀取指令(`get_token_analytics`、`get_model_breakdown`、`get_day_*`、`get_available_agents`)是同步 `pub fn`,在 Tauri v2 下跑於主執行緒,且每一個都要 `state.aggregator.lock()`。refresh 持鎖期間這些讀取全部卡在主執行緒 → UI 死當。
- 放大因素:parser 路徑的 DB 寫入 `upsert_events_for_source` 以逐筆 `INSERT OR IGNORE` 執行且無交易包覆,每筆觸發一次 fsync,首次大量匯入時嚴重拉長掃描時間,進而延長持鎖時間。

`TokenAggregator` 目前以值持有 `storage: TokenStorage`,且 refresh 系列方法為 `&self`,因此指令端唯一的呼叫途徑就是持有外層 `Arc<Mutex<TokenAggregator>>`。`TokenStorage` 內部為 `Mutex<Connection>`,本身 Send + Sync。

## Goals / Non-Goals

**Goals:**

- 首次匯入期間主執行緒保持可回應(可切換分頁、頁面不凍結)。
- 大量首次匯入的耗時顯著下降。
- 使用者在匯入期間看到具體進度(階段 + 檔案/事件計數),而非無回應畫面。
- 僅在首次進入 /token 時觸發匯入(延遲匯入),第二次起即時從 DB 載入。

**Non-Goals:**

- 不更動 token 數字計算邏輯或來源選擇(`依模型` / `依專案` 一致性已由先前 parser 去重處理)。
- 不在 app 啟動時背景匯入。
- 不改寫 tokscale 匯入或 scanner 掃描演算法本身,只調整其並發、交易與進度回報。

## Decisions

### 重新整理期間不持有 aggregator 鎖

把 `TokenAggregator.storage` 改為 `Arc<TokenStorage>`、`dated_source_cache` 改為 `Arc<Mutex<Option<String>>>`(refresh 鏈僅觸及這兩者;pricing 不參與 refresh)。新增一個對 `Arc` 操作而非 `&self` 的 refresh 進入點(例如 `run_refresh(storage: Arc<TokenStorage>, dated_cache: Arc<Mutex<Option<String>>>, allow_parser_fallback: bool) -> Result<RefreshResult, String>`),並把 `refresh_with_options` / `refresh_from_ingestion_result` / `run_parser_scan` / `refresh_parser_fallback` 的本體改為對這些參數操作;保留薄薄的 `&self` 包裝以維持既有測試與呼叫端可編譯。

`refresh_token_data` 改為短暫上鎖只 clone 出 `Arc`,立即釋放 aggregator 鎖,再於 `spawn_blocking` 內對 clone 出的狀態執行掃描。如此掃描只在短生命週期的 `Mutex<Connection>` 層級(逐語句)與讀取競爭,絕不再卡 aggregator 鎖。

**替代方案:** 將所有讀取指令改為 async — 否決,牽動面太廣且不解決鎖競爭本質;真正關鍵是「掃描期間別持有 aggregator 鎖」。

### DB 寫入改為交易批次

重寫 `upsert_events_for_source`,比照既有正確範式 `replace_tokscale_records`:取得 `conn` 後開 `transaction()`,以 `prepare_cached` 準備一次 INSERT,於交易內逐筆執行,每約 5000 筆 commit 一次再開新交易以限制記憶體與持鎖時間。保持 `INSERT OR IGNORE` 語意與 `inserted` 計數行為完全一致。

**替代方案:** 開啟 WAL 模式 — 列為可選,非本變更必要,先以交易批次解決主要成本。

### 掃描進度事件機制

定義 `ScanProgress` 負載(`phase`: "tokscale" | "parser"、`files_scanned`、`files_total`、`events_ingested`)與事件名 `token-scan-progress`。新增 `ProgressSink` trait(`Send + Sync`,方法 `report(&self, ScanProgress)`),把 `Option<Arc<dyn ProgressSink>>` 串入 `TokenScanner::scan_all` / `scan_parser` 與 `run_refresh`,於每檔處理後與每次 chunk commit 後回報。後端實作包住 Tauri `AppHandle`,呼叫 `app_handle.emit("token-scan-progress", payload)`(`Emitter` trait);因此 `refresh_token_data` 簽章新增 `app: tauri::AppHandle` 參數。前端新增 `useScanProgress()` hook,以 `@tauri-apps/api/event` 的 `listen()` 訂閱。

### 首次匯入狀態查詢與延遲匯入 UX

新增指令 `token_import_status() -> { needs_import: bool }`,以 `token_ingestion_state` KV 旗標為準(避免在大 DB 上跑慢速 COUNT)。`needs_import` 的唯一判斷是匯入完成旗標 `token_import_completed_v1` 是否存在且值為 `"1"`:旗標不存在、值不是 `"1"`、全新 DB、或升級自舊版但尚未由本流程成功 refresh 的既有 DB,皆回報 `needs_import=true`。首次成功 refresh 後寫入此旗標,後續進入 `/tokens` 才回報 false。`TokensPage` 掛載時查詢此狀態:若 `needs_import` 則觸發一次 `refreshMutation.mutate()` 並以進度覆蓋層取代一般 skeleton。新增 `<TokenImportProgress>` 元件消費 `useScanProgress()`,顯示階段與檔案/事件計數;尚無進度事件時退回不確定態(indeterminate)。refresh mutation settle 後沿用既有 `invalidateQueries(tokenKeys.all)` 重新載入分析資料並渲染正常頁面。新指令需在 Tauri `invoke_handler` 註冊並於前端 API 層(token 指令繫結處)綁定。

`deleteAllTokenEvents()` 是清空 token analytics cache 的使用者動作;它清除 `token_events` 後也必須刪除 `token_ingestion_state.token_import_completed_v1`,使下一次進入 `/tokens` 時 `token_import_status` 回報 `needs_import=true` 並重新走延遲匯入。此動作不得清除 `active_source`,也不要求清 scan cursor;parser scan 已有「沒有 dated `felina_parser` events 時清 cursor」的補救邏輯。

## Implementation Contract

**Behavior:**
- 首次進入 /token 且 `token_import_completed_v1` 不存在或不是 `"1"`: `needs_import` 為 true,顯示進度覆蓋層,計數持續遞增;期間可切換其他分頁、頁面不凍結;成功 refresh 後寫入完成旗標並自動渲染分析資料。
- 第二次起進入 /token:已存在 `token_import_completed_v1 = "1"` 時 `needs_import` 為 false,無覆蓋層,直接由 DB 即時渲染。
- 呼叫 `deleteAllTokenEvents()` 後:token events 與 `token_import_completed_v1` 同步清除;下一次進入 `/tokens` 會重新回報 `needs_import=true`。
- refresh 進行中觸發讀取(切分頁/按重新整理鈕)不應在主執行緒造成多秒停頓。

**Interface / data shape:**
- `refresh_token_data(app: tauri::AppHandle, state: State<'_, TokenState>) -> Result<RefreshResult, String>`(新增 `app` 參數;`RefreshResult` 形狀不變)。
- 新指令 `token_import_status() -> TokenImportStatus { needs_import: bool }`,於 invoke_handler 註冊、前端 API 層綁定;`needs_import` 只讀取 `token_ingestion_state` 的 `token_import_completed_v1` 旗標,不得掃描或 COUNT `token_events`。
- 既有指令 `delete_all_token_events() -> Result<u64, String>` 回傳刪除的 `token_events` row 數不變,但成功刪除後需移除 `token_import_completed_v1`;不修改 `active_source`。
- Tauri event `token-scan-progress`,payload `ScanProgress { phase: string, files_scanned: number, files_total: number, events_ingested: number }`。
- `TokenAggregator.storage: Arc<TokenStorage>`、`dated_source_cache: Arc<Mutex<Option<String>>>`;新增 `run_refresh` 進入點對 `Arc` 操作。
- `upsert_events_for_source` 對外簽章與回傳 `inserted` 計數不變。

**Failure modes:**
- tokscale 失敗仍走既有 parser fallback 路徑,行為不變。
- 進度事件為盡力而為(best-effort):emit 失敗不可中斷或污染 refresh 結果。
- `token_import_status` 讀取失敗時前端應視為「不需匯入/或顯示既有錯誤」,不得卡死頁面。
- 既有資料庫若有 token rows 但沒有 `token_import_completed_v1 = "1"`,仍會觸發一次延遲匯入;這是旗標遷移語意,不是資料遺失或 row-count 判斷。
- `deleteAllTokenEvents()` 清除完成旗標失敗時,應回傳錯誤而非假裝清除成功;避免 UI 認為資料已清空但下一次仍不觸發 import。

**Acceptance criteria:**
- `cargo check` 通過;`pnpm tsc`(或等價型別檢查)通過。
- 清空 `~/.felina/tokens.db` 與掃描游標後首次開啟 /token:UI 可回應、覆蓋層計數遞增、完成後數字一致(`依模型` 與 `依專案`)。
- 對保留資料但刪除/缺少 `token_ingestion_state.token_import_completed_v1` 的測試 DB,`token_import_status` 回報 true;成功 refresh 後回報 false。
- 呼叫 `deleteAllTokenEvents()` 後,`token_import_status` 回報 true;`active_source` 仍保留原值。
- refresh 進行中切換分頁無多秒停頓。
- 第二次開啟 /token 無覆蓋層、即時渲染。
- `upsert_events_for_source` 的 inserted 計數在批次化前後一致。

**Scope boundaries:**
- In scope:aggregator 並發重構、parser 路徑交易批次寫入、進度事件機制、首次延遲匯入 UX 與狀態查詢、相關指令/事件註冊與前端綁定。
- Out of scope:token 計算/來源選擇邏輯、啟動時背景匯入、tokscale/scanner 演算法重寫、WAL 模式(可選、非必要)。

## Risks / Trade-offs

- [改動 aggregator 欄位型別(`Arc<...>`)可能波及讀取路徑] → 讀取以 `Arc` deref 取用 `storage.connection()`,行為不變;以 `cargo check` 與讀取路徑回歸確認。
- [交易批次化若改變 `inserted` 計數或 OR IGNORE 語意會影響下游統計] → 明確保持語意與計數一致,並列為驗收項目。
- [`refresh_token_data` 新增 `app` 參數屬簽章變更] → 對外 API 形狀(`RefreshResult`)不變,前端 invoke 不需改參數;僅後端註冊處調整。
- [進度事件頻率過高造成前端負擔] → 以每檔/每 chunk(約 5000 筆)為粒度回報,避免逐筆 emit。

## UI 影響

本變更新增 `<TokenImportProgress>` 元件並調整 `TokensPage` 首次載入呈現,屬 UI-related。tasks 階段必須包含 `/felina-ui-guidelines` review 步驟,驗證階段需把命中的 guideline、是否有 deviation 與理由寫進 archive notes。
