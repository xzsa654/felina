## Why

Claude Code 的 5 小時用量視窗是在「當期第一則訊息」送出時才開始計時,Codex 同理。使用者若想讓視窗的開始與到期時間落在自己希望的時段(例如每天上班前先觸發,讓重置時間對齊作息),目前只能手動去終端機敲一句話。Felina 已握有 Claude(Keychain OAuth)與 Codex(`~/.codex/auth.json`)的憑證並會呼叫各家 usage API,因此最適合由 Felina 在排定時間自動送出一句簡短訊息(如「早安」)來觸發並控制配額視窗。

## What Changes

- 在 `/tokens` 頁面 Overview 分頁新增「流量到期日控制」面板,讓使用者為 Claude / Codex 各自設定:是否啟用、每日觸發時間(HH:MM)、要送出的訊息內容(預設「早安」)。
- 設定持久化到 `~/.felina/settings.json` 新欄位 `quotaWindowSchedules`,沿用既有 `felina_settings` 的讀寫模式。
- 後端新增一個 app 執行期的背景排程器(tokio 週期性 tick),每分鐘檢查是否有到點且當日尚未送出的排程,到點即觸發發送。
- 後端新增 provider 訊息發送路徑:Claude 走 `https://api.anthropic.com/v1/messages`(沿用 `read_claude_oauth_token` 取得的 OAuth bearer + OAuth beta 標頭),Codex 走 ChatGPT backend responses 端點(沿用 `auth.json` 的 access_token + account_id)。訊息為單則極短 prompt,僅為觸發視窗,不處理多輪對話。
- 新增 Tauri 指令讓前端讀寫排程設定、查詢各排程最近一次觸發的結果(成功/失敗時間與錯誤訊息),並可手動立即觸發一次。
- 發送結果(最近觸發時間、狀態、錯誤)記錄在記憶體中並透過指令回傳給前端顯示;不新增持久化的歷史記錄表。

## Non-Goals (optional)

- 不支援 Gemini(其配額模型與訊息 API 與前兩者差異大,本次排除)。
- 不做系統層級(cron / launchd)排程;排程僅在 Felina app 執行時運作,app 關閉期間不會觸發。本限制會在 UI 明示。
- 不支援多則訊息、多輪對話、或自訂發送頻率(僅「每日單一時間點」);不做隨機時間抖動。
- 不在本次新增發送歷史的持久化儲存或圖表。

## Capabilities

### New Capabilities

- `quota-window-scheduler`: 在 app 執行期依使用者設定的每日時間,自動對 Claude / Codex 送出一句簡短訊息以觸發配額視窗,並回報觸發結果。
- `quota-window-scheduler-ui`: `/tokens` Overview 的「流量到期日控制」面板,提供啟用開關、每日時間、訊息內容設定與最近觸發狀態顯示。

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `quota-window-scheduler`、`quota-window-scheduler-ui`
- Affected code:
  - New:
    - `src-tauri/src/commands/quota_scheduler.rs`
    - `src-tauri/src/tokens/agent_message.rs`
    - `src/lib/components/tokens/components/QuotaWindowSchedulerPanel.tsx`
  - Modified:
    - `src-tauri/src/lib.rs`
    - `src-tauri/src/commands/mod.rs`
    - `src-tauri/src/commands/felina_settings.rs`
    - `src-tauri/src/tokens/ccusage.rs`
    - `src/lib/tauri/commands.ts`
    - `src/lib/types/token-analytics.ts`
    - `src/lib/components/tokens/TokensPage.tsx`
    - `src/lib/components/tokens/hooks/useTokenQueries.ts`
    - `src/lib/i18n` 語系字串檔
  - Removed: (none)
- 依賴:沿用既有 `reqwest`(blocking)、`tokio`、`serde_json`;新增 Cargo 依賴 `chrono`(取得 app 執行期的本地時間/日期供排程到點判定;專案先前無時間處理 crate)。無新增 npm 套件。
- 風險:此功能會主動消耗使用者的 Claude / Codex 配額(每次觸發約一則最小訊息),屬非破壞性新增,但需在 UI 明確告知;OAuth 發送路徑若 provider 端標頭要求變動可能失敗,需有清楚錯誤回報。無跨 change 依賴。
