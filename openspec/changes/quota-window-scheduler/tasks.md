## 1. 設定持久化(backend)

> 對應 spec Requirement: Scheduled quota-window trigger settings;design 決策:設定與執行期狀態的資料形狀

- [x] 1.1 在 `felina_settings.rs` 新增 `quotaWindowSchedules` 的讀寫:提供讀取(缺值 fallback 為 `{ enabled:false, time:"09:00", message:"早安" }`)與原子寫入(保留既有 `quotaTtlSeconds`)。驗證:新增 round-trip 單元測試,涵蓋「缺 key 回 fallback」「寫入後保留 quotaTtlSeconds」。(spec: Scheduled quota-window trigger settings)
- [x] 1.2 在 `set` 寫入路徑加入輸入驗證:agent ∈ {claude, codex}、time 符合 `HH:MM`(24 小時)、message 非空,違反則回 `Err` 且不寫檔。驗證:單元測試涵蓋 spec 的驗證表(gemini/壞 time/空訊息被拒、合法被接受)。

## 2. Provider 訊息發送(backend)

> 對應 spec Requirement: Provider message-send paths reuse existing credentials;design 決策:訊息發送沿用 provider API 而非呼叫本機 CLI

- [x] 2.1 [P] 新增 `src-tauri/src/tokens/agent_message.rs`,實作 `send_claude_message(&str) -> Result<(),String>`:沿用 `ccusage::read_claude_oauth_token`,POST `https://api.anthropic.com/v1/messages`(帶 `anthropic-version`、`anthropic-beta: oauth-2025-04-20`、Bearer),body 為單則 user 訊息、最小 `max_tokens`、小模型;2xx 回 Ok,其餘回含 HTTP 狀態的 Err。驗證:憑證缺失時回明確錯誤的單元測試;app 手動驗證實際送出成功。(spec: Provider message-send paths reuse existing credentials)
- [x] 2.2 [P] 在 `agent_message.rs` 實作 `send_codex_message(&str) -> Result<(),String>`:沿用 `~/.codex/auth.json` 的 access_token + account_id,POST ChatGPT backend responses 端點並帶 `ChatGPT-Account-Id`;2xx 回 Ok,其餘回 Err。驗證:auth.json 缺失時回明確錯誤的單元測試;app 手動驗證實際送出。

## 3. 排程器核心邏輯(backend)

> 對應 spec Requirement: App-runtime daily trigger execution;design 決策:背景排程器使用 app 執行期的 tokio 週期 tick

- [x] 3.1 [P] 在 `quota_scheduler.rs` 實作純函式「到點+當日去重判定」:給定 now(本地)、schedule、last-attempt 日期,回傳是否該送。驗證:單元測試涵蓋 spec 的決策表(未到點/剛到點/當日已送/隔日重置)。
- [x] 3.2 在 `lib.rs` 的 `setup` spawn 每 60 秒 tick 的 tokio 背景任務:每次讀設定,對每個啟用且判定該送的 agent 呼叫對應 `agent_message` 發送函式,結果(時間+成功/錯誤字串)寫入排程器持有的 `Mutex` 記憶體狀態,並把該 agent 標記為當日已嘗試(失敗亦標記,不於當日重試)。驗證:app 手動驗證設定一兩分鐘後的時間會自動觸發一次。(spec: App-runtime daily trigger execution)

## 4. Tauri 指令與註冊(backend)

> 對應 spec Requirement: Manual immediate trigger;design 決策:Tauri 指令介面

- [x] 4.1 在 `quota_scheduler.rs` 匯出三個指令:`get_quota_window_schedules`(回設定+各 agent 最近結果)、`set_quota_window_schedule(agent,enabled,time,message)`(套用 1.2 驗證)、`trigger_quota_window_now(agent)`(同步送一次並回結果)。驗證:指令簽章與 design Implementation Contract 一致,可被前端呼叫。(spec: Manual immediate trigger)
- [x] 4.2 在 `commands/mod.rs` 宣告 `quota_scheduler` 模組,並在 `lib.rs` 的 `invoke_handler` 註冊三個指令。驗證:`cargo build` 通過、前端 invoke 不報 unknown command。

## 5. 前端串接與面板(frontend)

> 對應 spec Requirement: Quota-window scheduler panel on Tokens Overview、Manual trigger control in the panel;design 決策:前端面板放在 Overview 既有 AgentQuotaPanel 上方

- [x] 5.1 [P] 在 `src/lib/types/token-analytics.ts` 新增型別 `QuotaScheduleConfig`、`QuotaScheduleState`、`QuotaTriggerResult`,形狀與後端回傳一致。驗證:`tsc` 型別檢查通過。
- [x] 5.2 在 `src/lib/tauri/commands.ts` 新增 `api.quotaScheduler` 群組(get/set/triggerNow),並在 `useTokenQueries.ts` 新增對應 query/mutation hooks 與 query key。驗證:hooks 可呼叫且 set/triggerNow 後 invalidate 重抓。
- [x] 5.3 新增 `QuotaWindowSchedulerPanel.tsx`:為 Claude/Codex 各提供啟用開關、HH:MM 時間輸入、訊息輸入(預設「早安」)、最近觸發狀態顯示、「立即觸發」按鈕,並明示「僅 app 執行時生效」。在 `TokensPage.tsx` Overview 區塊置於 `AgentQuotaPanel` 之前 render。驗證:app 手動驗證面板可編輯持久化、立即觸發即時更新結果。(spec: Quota-window scheduler panel on Tokens Overview、Manual trigger control in the panel)
- [x] 5.4 [P] 在 i18n 語系字串檔新增本面板所需字串(含標題「流量到期日控制」、各標籤、app 執行限制說明、狀態文案)。驗證:面板在現有語系切換下無缺字串、無 raw key 顯示。
