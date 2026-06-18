## Context

Felina(Tauri v2 + React)目前在 `/tokens` 顯示各 agent 的配額用量。後端 `src-tauri/src/tokens/ccusage.rs` 已能用 Claude 的 Keychain OAuth token 與 Codex 的 `~/.codex/auth.json`(access_token + account_id)呼叫各家 usage API。`felina_settings.rs` 已有一套把設定原子寫入 `~/.felina/settings.json` 並保留其他欄位的讀寫模式(`quotaTtlSeconds`)。前端透過 `src/lib/tauri/commands.ts` 的 `api` 物件呼叫 Tauri 指令,並以 TanStack Query 包裝。

Claude / Codex 的「5 小時用量視窗」在當期第一則訊息送出時開始計時。使用者想讓視窗的開始/到期時間落在自己希望的時段,本變更讓 Felina 在 app 執行期的排定時間自動送出一句極短訊息來觸發視窗。

## Goals / Non-Goals

**Goals:**

- 讓使用者為 Claude / Codex 各自設定:啟用開關、每日觸發時間(本地 HH:MM)、要送的訊息(預設「早安」)。
- 設定持久化於 `~/.felina/settings.json`,沿用既有原子寫入模式。
- App 執行期由背景排程器在到點時自動送出訊息,並回報最近一次觸發結果。
- 提供手動「立即觸發一次」能力。

**Non-Goals:**

- 不支援 Gemini。
- 不做系統層級(cron/launchd)排程,app 關閉期間不觸發。
- 不支援多則訊息、多輪對話、每日多時段或隨機抖動。
- 不持久化發送歷史(僅記憶體中保留最近一次結果)。

## Decisions

### 訊息發送沿用 provider API 而非呼叫本機 CLI

新增 `src-tauri/src/tokens/agent_message.rs`,提供 `send_claude_message(text: &str)` 與 `send_codex_message(text: &str)`,各回傳 `Result<(), String>`。Claude 沿用 `ccusage::read_claude_oauth_token()` 取得 OAuth bearer,POST `https://api.anthropic.com/v1/messages`,帶 `anthropic-version: 2023-06-01`、`anthropic-beta: oauth-2025-04-20`、`authorization: Bearer <token>`,body 為最小 messages 請求(單一 user 訊息、`max_tokens` 設小值如 16、model 用穩定的 haiku 類小模型)。Codex 沿用 `auth.json` 的 access_token + account_id,POST ChatGPT backend responses 端點,帶 `ChatGPT-Account-Id` 標頭。選擇 API 路徑是因為它沿用既有憑證讀取邏輯、不依賴使用者本機是否安裝 CLI、行為可預測。替代方案(shell out `claude -p`)被否決:依賴外部安裝、輸出與退出碼較難預測。

### 背景排程器使用 app 執行期的 tokio 週期 tick

在 `src-tauri/src/lib.rs` 的 `setup` 期間 spawn 一個 tokio 背景任務,每 60 秒 tick 一次。每次 tick 讀取目前排程設定,對每個「已啟用、當前本地時間已達設定 HH:MM、且當日尚未送出」的排程呼叫對應的 `agent_message` 發送函式,並把結果寫入記憶體狀態。以「當日已送出」旗標(記錄最後成功送出的日期)避免同一天重複觸發。選擇每分鐘 tick 而非精準計時器,是因為每日單點、分鐘級精度已足夠且實作簡單、可重入。

### 設定與執行期狀態的資料形狀

設定持久化於 `~/.felina/settings.json` 的新 key `quotaWindowSchedules`,形狀為以 agent 為 key 的物件:`{ "claude": { "enabled": bool, "time": "HH:MM", "message": string }, "codex": { ... } }`。執行期最近觸發結果存在背景排程器持有的 `Mutex` 狀態,不落地。前端以一個 `QuotaScheduleConfig` 物件(含每個 agent 的設定與 `lastResult`)讀回。

### Tauri 指令介面

新增 `src-tauri/src/commands/quota_scheduler.rs`,匯出三個指令並註冊到 `lib.rs` 的 `invoke_handler` 與 `commands/mod.rs`:
- `get_quota_window_schedules() -> QuotaScheduleState`(含設定 + 各 agent 最近觸發結果)
- `set_quota_window_schedule(agent: String, enabled: bool, time: String, message: String) -> Result<(), String>`(驗證 agent ∈ {claude, codex}、time 符合 HH:MM、message 非空)
- `trigger_quota_window_now(agent: String) -> QuotaTriggerResult`(立即同步觸發一次並回傳結果)

### 前端面板放在 Overview 既有 AgentQuotaPanel 上方

新增 `QuotaWindowSchedulerPanel.tsx`,在 `TokensPage.tsx` 的 Overview 區塊 render(置於 `AgentQuotaPanel` 之前)。透過 `useTokenQueries.ts` 新增的 query/mutation hooks 與 `commands.ts` 新增的 `api.quotaScheduler.*` 呼叫後端。面板含 app 關閉不觸發的明示說明,並顯示各 agent 最近觸發時間/狀態/錯誤。語系字串加入 i18n 檔(含「流量到期日控制」標題)。

## Implementation Contract

**Behavior:**

- 使用者在 `/tokens` Overview 的「流量到期日控制」面板可分別為 Claude、Codex 開關排程、設定每日 HH:MM 與訊息內容,設定立即持久化。
- App 執行期間,當本地時間到達某啟用排程的設定時間且當日尚未送出,系統自動對該 agent 送出設定的訊息一次;當日不再重複。
- 面板顯示每個 agent 最近一次觸發的時間與狀態(成功/失敗 + 錯誤訊息)。
- 「立即觸發」按鈕會同步送出一次並更新最近結果。

**Interface / data shape:**

- 持久化:`~/.felina/settings.json` 的 `quotaWindowSchedules` = `{ claude: { enabled: bool, time: "HH:MM", message: string }, codex: { ... } }`。缺欄位時 fallback 為 `{ enabled: false, time: "09:00", message: "早安" }`。
- Tauri 指令:`get_quota_window_schedules`、`set_quota_window_schedule(agent, enabled, time, message)`、`trigger_quota_window_now(agent)`,如上述簽章。
- 後端發送函式:`agent_message::send_claude_message(&str) -> Result<(), String>`、`send_codex_message(&str) -> Result<(), String>`。
- 前端型別:`src/lib/types/token-analytics.ts` 新增 `QuotaScheduleConfig`、`QuotaScheduleState`、`QuotaTriggerResult`;`commands.ts` 新增 `api.quotaScheduler` 群組;`useTokenQueries.ts` 新增對應 hooks 與 query key。

**Failure modes:**

- 憑證缺失/過期、provider 回非 2xx、網路錯誤 → 發送函式回 `Err(String)`,排程器把錯誤字串寫入該 agent 最近結果並由面板顯示;當日「已嘗試」仍記為已處理以避免每分鐘重試風暴(失敗不阻擋隔日重試)。
- `set_quota_window_schedule` 對非法 agent / time 格式 / 空訊息回 `Err`,前端顯示錯誤、不寫檔。
- App 關閉期間完全不觸發,屬已知限制,UI 明示。

**Acceptance criteria:**

- `felina_settings` 針對 `quotaWindowSchedules` 的讀寫具備 round-trip 單元測試,並驗證寫入時保留既有 `quotaTtlSeconds` 欄位。
- `set_quota_window_schedule` 的驗證邏輯(非法 agent、錯誤 time 格式、空訊息)具備單元測試。
- 排程器的「到點判定 + 當日去重」純函式(給定 now、設定、last-sent 日期 → 是否該送)具備單元測試,涵蓋:未到點、剛到點、當日已送、隔日重置。
- 手動以 app 執行驗證:設定一個一兩分鐘後的時間,面板於到點後顯示成功觸發結果(或在憑證缺失時顯示對應錯誤);「立即觸發」按鈕即時更新結果。

**Scope boundaries:**

- In scope:Claude + Codex 的每日單點觸發、設定持久化、執行期排程器、最近結果回報、手動立即觸發、Overview 面板與 i18n。
- Out of scope:Gemini、系統層排程、多時段/多訊息/抖動、發送歷史持久化、配額視窗對齊的自動建議。

## Risks / Trade-offs

- [主動消耗使用者配額] → 預設 `enabled: false`,UI 明示每次觸發會送一則訊息並消耗少量配額。
- [OAuth 發送標頭需求可能與 usage API 不同或日後變動] → 發送函式回傳明確錯誤字串,面板顯示;以最小 `max_tokens` 與小模型降低成本與失敗面。
- [App 未開啟即不觸發,可能讓使用者誤以為已排程] → 面板明示「僅 app 執行時生效」。
- [每分鐘 tick 的時間精度為分鐘級] → 對「每日單點觸發」需求已足夠,屬可接受取捨。

## Open Questions

- Codex responses 端點送出極短訊息是否足以開啟其計費視窗,需在實作期以實際帳號驗證;若端點/標頭與既有 wham/usage 不同,於 `agent_message.rs` 調整並更新錯誤訊息。
