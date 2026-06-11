## 1. 後端並發與寫入基礎

- [x] 1.1 依設計「重新整理期間不持有 aggregator 鎖」實作 **Non-blocking token refresh**:將 `TokenAggregator.storage` 改為 `Arc<TokenStorage>`、`dated_source_cache` 改為 `Arc<Mutex<Option<String>>>`,新增對 `Arc` 操作的 `run_refresh` 進入點,並保留 `&self` 薄包裝(`aggregator.rs`)。驗證:`cargo check` 通過,且既有讀取路徑經 `Arc` deref 取用 `storage.connection()` 行為不變。
- [x] 1.2 [P] 依設計「DB 寫入改為交易批次」實作 **Transactional batch writes for parser ingestion**:重寫 `upsert_events_for_source` 以交易包覆、`prepare_cached`、每約 5000 筆 commit,保持 `INSERT OR IGNORE` 語意與 `inserted` 計數一致(`storage.rs`)。驗證:既有/新增單元測試確認相同輸入下 inserted 計數與去重行為與逐筆寫入一致。

## 2. 掃描進度事件機制

- [x] 2.1 依設計「掃描進度事件機制」定義 `ScanProgress` 負載(`phase`、`files_scanned`、`files_total`、`events_ingested`)與 `ProgressSink` trait(`Send + Sync`)。驗證:`cargo check` 通過,型別可被 scanner 與 refresh 匯入使用。
- [x] 2.2 將 `Option<Arc<dyn ProgressSink>>` 串入 `TokenScanner::scan_all` / `scan_parser`,於每檔處理後與每次 chunk commit 後回報進度(`scanner.rs`)。驗證:單元測試以假 sink 斷言掃描過程會收到遞增的 files/events 計數。
- [x] 2.3 依設計「掃描進度事件機制」完成 **Emit scan progress events during token import** 的後端:實作包住 `AppHandle` 的 sink 以 `emit("token-scan-progress", payload)` 發送(best-effort,emit 失敗不影響結果),並改寫 `refresh_token_data` 新增 `app: tauri::AppHandle` 參數、短暫上鎖 clone `Arc` 後釋放再於 `spawn_blocking` 掃描(`commands/tokens.rs`)。驗證:手動執行 refresh 期間可觀察到事件發送且 `RefreshResult` 形狀不變,`cargo check` 通過。

## 3. 首次匯入狀態查詢

- [x] 3.1 依設計「首次匯入狀態查詢與延遲匯入 UX」實作 **Lazy first-run token import on /tokens entry** 的後端:新增 `token_import_status() -> { needs_import: bool }` 指令,以 `token_ingestion_state` KV 旗標為準,首次成功 refresh 後設為已匯入,並於 `invoke_handler` 註冊(`commands/tokens.rs`、`storage.rs`)。驗證:單元/手動測試確認首次回報 needs_import=true、成功 refresh 後回報 false。
- [x] 3.2 依設計「首次匯入狀態查詢與延遲匯入 UX」補齊 `deleteAllTokenEvents` 重置語意:成功清空 `token_events` 時同步刪除 `token_ingestion_state.token_import_completed_v1`,但保留 `active_source` 與 scan cursor,讓下一次 `token_import_status` 回報 `needs_import=true`(`storage.rs`、`commands/tokens.rs`)。驗證:新增/更新單元測試確認先標記 completed、設定 active source、呼叫 delete 後 events 為 0、completed flag 缺失且 active source 不變。

## 4. 前端進度與首次匯入 UX

- [x] 4.1 [P] 新增 `useScanProgress()` hook 以 `@tauri-apps/api/event` 的 `listen("token-scan-progress")` 訂閱並暴露最新進度,並新增查詢 `token_import_status` 的 hook(`hooks/useTokenQueries.ts`)。驗證:`pnpm tsc` 通過,hook 在收到事件時更新狀態。
- [x] 4.2 [P] 新增 `<TokenImportProgress>` 元件消費 `useScanProgress()`,顯示階段與檔案/事件計數,無事件時顯示不確定態(`components/TokenImportProgress.tsx`)。驗證:元件在有/無進度資料兩種情況下皆正確渲染(手動檢視 + `pnpm tsc`)。
- [x] 4.3 於 `TokensPage` 掛載時查詢匯入狀態:`token_ingestion_state.token_import_completed_v1` 不存在或不是 `"1"` 時 `needs_import=true`,觸發一次 refresh 並以 `<TokenImportProgress>` 取代 skeleton;refresh 成功後寫入完成旗標、沿用 `invalidateQueries(tokenKeys.all)` 渲染正常頁面;狀態查詢失敗不卡死頁面(`TokensPage.tsx`)。驗證:清空 `~/.felina/tokens.db` 後首次進入顯示進度、完成後渲染分析;保留資料但移除/缺少完成旗標時仍觸發一次 import;第二次進入因完成旗標存在而無覆蓋層。
- [x] 4.4 於前端 API 層綁定 `token_import_status` 指令(`src/lib/tauri/commands.ts`)。驗證:`pnpm tsc` 通過且 `TokensPage` 可呼叫該指令。

## 5. UI 規範審查與端對端驗證

- [x] 5.1 對新增的 `<TokenImportProgress>` 與 `TokensPage` 首次載入呈現執行 `/felina-ui-guidelines` review,記錄命中的 guideline、是否有 deviation 與理由(供 archive notes 使用)。驗證:review 結論已記錄,無未說明的 deviation。
- [x] 5.2 端對端驗證:`cargo check` 與 `pnpm tsc` 通過;清空 DB 與掃描游標後首次開啟 /token 期間切換分頁不凍結、覆蓋層計數遞增、完成後 `依模型` 與 `依專案` 數字一致;refresh 進行中切換分頁無多秒停頓;第二次開啟即時渲染;呼叫 `deleteAllTokenEvents` 後再次進入 `/tokens` 會因 completed flag 被清除而重新顯示 import 進度。驗證:依上述各項手動逐條確認通過。
