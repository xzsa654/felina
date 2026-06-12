## Why

全新建置/安裝 app 後,使用者第一次開啟 /token 並觸發資料匯入時,歷史資料量大會導致整個 UI 死當、無回應,直到掃描結束才恢復。根因是並發模型錯誤:重新整理(refresh)期間長時間持有 aggregator 鎖,而所有讀取指令是同步、跑在主執行緒上且都要搶同一把鎖,因此主執行緒被阻塞;一筆一筆無交易包覆的 DB 寫入又拉長了掃描時間,放大了卡死時間。

## What Changes

- 重新整理(`refresh_token_data`)期間不再持有 aggregator 鎖:改為短暫上鎖取出共享狀態後立即釋放,掃描全程只在短生命週期的 DB connection 鎖層級與讀取指令競爭,主執行緒保持可回應。
- `TokenAggregator` 的 `storage` 改為 `Arc<TokenStorage>`、`dated_source_cache` 改為 `Arc<Mutex<Option<String>>>`,使重的掃描工作可在不持有 aggregator 鎖的情況下對共享狀態執行。
- DB 寫入(`upsert_events_for_source`)改為交易批次寫入(每約 5000 筆 commit 一次),消除每筆 INSERT 觸發 fsync 的成本,大幅縮短首次匯入時間。
- 新增掃描進度事件機制:後端透過 `ProgressSink` trait 在掃描過程回報進度,以 Tauri event(`token-scan-progress`)發送;前端以 `listen()` 訂閱並顯示。
- 新增首次匯入 UX(延遲匯入):僅在使用者第一次進入 /token 頁時觸發匯入,並以進度覆蓋層取代一般 skeleton;完成後自動重新載入分析資料。新增 `token_import_status` 指令以判斷是否需要匯入。
- `deleteAllTokenEvents()` 清空 token analytics cache 時同步移除首次匯入完成旗標,讓下一次進入 `/tokens` 可重新觸發延遲匯入;不清除 `active_source` 或 scan cursor。

## Non-Goals (optional)

- 不改動 token 數字的計算邏輯或來源選擇(`依模型` / `依專案` 一致性已由先前 claude_code.rs 去重修正處理)。
- 不在 app 啟動時就背景匯入(明確採延遲匯入,僅在進入 /token 時觸發)。
- 不重寫 tokscale 匯入或 scanner 的掃描演算法本身,只調整其並發/交易與進度回報。

## Capabilities

### New Capabilities

- `token-import-progress`: 首次進入 /token 時的延遲匯入流程,含掃描進度事件與進度覆蓋層 UI,以及判斷是否需要匯入的狀態查詢。

### Modified Capabilities

- `tokscale-backed-token-ingestion`: 重新整理改為非阻塞並發模型(掃描期間不持有 aggregator 鎖),且 parser 路徑的 DB 寫入改為交易批次。

## Impact

- Affected specs: `token-import-progress`(新增)、`tokscale-backed-token-ingestion`(修改)
- Affected code:
  - New:
    - src/lib/components/tokens/components/TokenImportProgress.tsx
  - Modified:
    - src-tauri/src/tokens/aggregator.rs
    - src-tauri/src/commands/tokens.rs
    - src-tauri/src/tokens/storage.rs
    - src-tauri/src/tokens/scanner.rs
    - src/lib/tauri/commands.ts
    - src/lib/components/tokens/hooks/useTokenQueries.ts
    - src/lib/components/tokens/TokensPage.tsx
  - Removed: (none)
- 依賴變動:無新增 npm / Cargo 依賴。
- 風險評估:
  - 並發行為改變屬內部重構,對外 API 形狀不變(`refresh_token_data` 簽章新增 `app: AppHandle` 參數);讀取指令行為不變。
  - 交易批次寫入需保持 `INSERT OR IGNORE` 語意與 inserted 計數不變,屬 backward compatible。
  - 新增 Tauri event 與指令需在 invoke_handler 註冊,並於前端 API 層綁定。
