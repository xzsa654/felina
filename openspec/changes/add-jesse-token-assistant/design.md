## Context

`/tokens` 目前是 Felina 主要的 token analytics 工作面，已經集中呈現 KPI、cache composition、top sessions、model breakdown、quota 與 scheduler 控制。使用者想把看不懂的 `/tokens` 區塊拖給一個固定吉祥物助理，由 Jesse 產生摘要、解釋與 `/plan`，而不是先跳到全域 overlay 或任意螢幕截圖流程。

可重用的現有元件與模組：

- `src/lib/components/tokens/TokensPage.tsx`：`/tokens` 的 tab、query 與頁面組合點。
- `src/lib/components/tokens/components/TopSessionsCard.tsx`：可提供 session row payload。
- `src/lib/components/tokens/components/ModelBreakdownTable.tsx`：可提供 model breakdown payload。
- `src/lib/components/tokens/components/AgentQuotaPanel.tsx`：可提供 quota snapshot payload。
- `src/lib/tauri/commands.ts`：frontend typed invoke wrapper 的集中入口。
- `src-tauri/src/tokens/agent_message.rs`：現有 quota scheduler 已證明可讀取使用者本機 Codex/Claude 憑證並送出 agent 訊息。
- `src-tauri/src/commands/quota_scheduler.rs` 與 `src-tauri/src/commands/felina_settings.rs`：保存設定、回報 provider 結果、以及不阻斷 `/tokens` 的模式可作為行為參考。

本 change 是 UI-related，且涉及讀取使用者本機 agent auth 檔與對外 HTTP 請求，tasks 需要包含 `/felina-ui-guidelines` review 與 `/spectra-audit` 安全審查。

## Goals / Non-Goals

**Goals:**

- 在 `/tokens` 內新增固定 Jesse assistant panel，不新增 navigation page。
- Jesse 的視覺形象固定為 Felina 吉祥物：名稱 Jesse，暱稱 pinkman，胖胖、愛吃、粉紅色塊頭。
- 讓 `/tokens` 內指定卡片或 row 提供結構化 draggable context payload。
- 讓 Jesse 對 dropped context 先產生摘要，並在同一個 panel 內支援 bounded chat follow-up。
- 使用使用者本機已存在的 Codex 或 Claude 憑證，不要求 Felina 新增 API key 管理。
- provider credential 不存在、網路失敗或模型回傳失敗時，只影響 Jesse panel，不阻斷 `/tokens` dashboard。

**Non-Goals:**

- 不做全域 overlay，不掛到 `src/router.tsx` 的 `AppLayout`。
- 不做任意螢幕截圖、OCR、DOM 任意區塊分析或跨 app 拖曳。
- 不新增 Gemini provider。
- 不新增長期 assistant conversation storage、記憶、thread history 或聊天頁；Jesse chat thread 只存在於目前 `/tokens` panel state。
- 不變更既有 token analytics API、quota scheduler API 或 `/history` 行為。
- 不新增 npm 或 Cargo third-party dependency。

## Decisions

### Jesse assistant remains scoped to TokensPage

Jesse 第一版直接由 `TokensPage` render，與 `/tokens` 的資料生命週期一起存在。這保留 user request 的漸進導入策略：先在 `/tokens` 成熟，再考慮全域。

替代方案是掛到 `AppLayout` 做全域 overlay。該方案會立刻需要處理所有頁面的 payload contract、定位、z-index、command palette 交互與持久狀態，超出第一版需求。

### Drag payload is structured token context

每個支援拖曳的 `/tokens` 元件提供明確 JSON payload，而不是把 DOM text、截圖或任意 HTML 丟給 backend。payload 至少包含 `kind`、`title`、`source`、`summary` 與 `metrics` 或 `rows`，並在 `src/lib/types/assistant.ts` 形成 typed union。

替代方案是讀取使用者選取文字或畫面截圖。該方案會降低資料可靠度，且引入 OCR/image model/截圖權限問題。

### Assistant command returns model output instead of fire-and-forget

新增 `assistant_generate` 與 `assistant_chat` Tauri command，與 quota scheduler 的 trigger command 分離。quota scheduler 只需要請求成功以控制用量視窗；Jesse 必須讀取 provider 回應並回傳 markdown，因此需要新的 backend contract。聊天室路徑使用 `assistant_chat(provider, context, messages, locale)`，messages 只保留目前 panel 內 bounded thread，不寫入 settings。

替代方案是直接重用 `send_codex_message` 或 `send_claude_message`。這會吞掉 response body，無法滿足摘要與 `/plan` 顯示。

### Provider credentials reuse local agent login state

Codex provider 讀取 `~/.codex/auth.json` 與 `~/.codex/config.toml` 的 model；Claude provider 讀取既有 Claude Code OAuth token。Felina 不新增 API key 輸入、不把 access token 回傳 frontend、不把 request/response 寫入 `~/.felina/settings.json`。

替代方案是在 Felina settings 內保存 API key。該方案增加 secret 管理與洩漏風險，也不符合「用戶本身的」帳號來源。

### Jesse UI uses fixed mascot identity and chat panel states

Jesse 的視覺 identity 固定，不做自訂 pet marketplace。UI 需要至少有 collapsed mascot button、expanded drop target、context preview、action buttons、loading、result、error states。圖像可先用 CSS/Tailwind shape 實作粉紅色塊頭，不新增圖片生成或 asset pipeline。

替代方案是引入可配置寵物系統。該方案會混入 asset management、pet install、customization 等非核心需求。

## Implementation Contract

**Behavior:**

- `/tokens` 載入後，頁面右下角顯示 Jesse collapsed mascot button；展開後顯示 drop target 與 action controls。
- 使用者可從支援的 `/tokens` 區塊拖曳 context 到 Jesse collapsed mascot 或 expanded drop target。Jesse 接收 payload 後顯示該 context 的標題、來源與摘要，並自動產生第一則 assistant 摘要訊息。
- 使用者可在 Jesse chat composer 內輸入 follow-up。Jesse 顯示 user bubble、assistant markdown response、loading state、provider selector、clear context 與 send control。
- 如果 provider credential 缺失、HTTP 失敗、payload 無效或 provider 回應無可用文字，Jesse 顯示可讀錯誤，不清空目前 context，也不影響 `/tokens` 其他資料載入。

**Interface / data shape:**

Frontend typed payload：

- `JesseAssistantAction = "summary" | "explain" | "plan"` 保留給單次 generate compatibility；chat UI 使用 `JesseChatMessage[]`。
- `JesseAssistantProvider = "codex" | "claude"`
- `JesseContextPayload` union 包含 `kind`、`title`、`source`、`capturedAt`，並依 kind 帶入 metrics 或 rows。
- MVP 支援 kind：`token-overview`、`top-session`、`model-breakdown`、`quota-snapshot`。

Backend command：

- `assistant_generate(provider, action, context)` 回傳 `{ markdown, provider, model, generated_at }`。
- `assistant_chat(provider, context, messages, locale)` 回傳 `{ markdown, provider, model, generated_at }`。
- command 必須 validate action、provider 與 context size；拒絕空 context 與超過 backend 上限的 serialized context。
- chat command 必須 validate provider、context size、message role、message count 與 message length；拒絕空 messages。
- provider-specific token 或 account id 只在 Rust backend 使用，不出現在 frontend response 或 error body。

Prompt contract：

- Jesse system prompt 固定 Jesse/pinkman persona，但輸出仍以資料解讀為主。
- chat prompt 先根據 dropped context 回答，並把 user follow-up 視為「使用者不懂這個 token 指標」的延伸問題。
- 若 context 包含 dateRange 或 Time range，回答必須明確提到該時間範圍。

**Failure modes:**

- Missing credential: 回傳 typed error message，提示使用者需先登入對應 agent。
- Unsupported provider/action: 回傳 validation error，不送出 HTTP request。
- Network/provider error: 回傳 status 與截斷後的非敏感錯誤內容。
- Oversized context: 回傳 context size error，frontend 顯示需要縮小拖曳範圍。

**Acceptance criteria:**

- `npm run check` 通過，證明 frontend types、i18n 字典與 invoke wrapper 一致。
- `cargo test --lib` 至少涵蓋 assistant command 的 validation、prompt rendering、missing credential path，以及 provider response text extraction 的純函式測試。
- Manual `/tokens` verification：拖曳至少一種支援 payload 到 collapsed Jesse 或 expanded drop target、觀察自動摘要、輸入 follow-up、看到 loading/chat markdown/error state 不破壞 dashboard。
- `/felina-ui-guidelines` review archive note 必須記錄 Jesse panel 命中的 UI guideline 與任何 deviation。
- `/spectra-audit` review 必須確認 token 不回傳 frontend、不持久化 assistant request/response、不使用 shell subprocess 發送 provider request。

**Scope boundaries:**

In scope：`/tokens` Jesse panel、typed drag payload、assistant generate command、Codex/Claude provider response extraction、Jesse i18n、targeted tests與 review notes。

Out of scope：global overlay、history page integration、screenshot/OCR、pet customization、assistant conversation persistence、new dependencies、new navigation entry。

## Risks / Trade-offs

- [Risk] 使用 ChatGPT/Codex backend endpoint 屬於使用者本機登入狀態，response streaming shape 可能變動 → Mitigation: provider parsing 做成小而可測的函式，HTTP error body 截斷並避免洩漏 token。
- [Risk] 拖曳互動容易造成 `/tokens` 既有 layout shift → Mitigation: Jesse panel 使用 fixed positioning，draggable affordance 不改變 card 尺寸，drop highlight 使用 overlay/border state。
- [Risk] provider 呼叫可能較慢或失敗 → Mitigation: mutation 層提供 loading、cancel-safe state 與錯誤保留 context，不阻塞 dashboard query。
- [Risk] payload 過大造成 prompt 成本與延遲上升 → Mitigation: payload 建構時只傳摘要與 bounded rows，backend 再做 serialized size validation。
- [Risk] Jesse persona 太可愛導致摘要不夠實用 → Mitigation: prompt 明定先資料重點、再不確定處、最後 action plan，persona 只影響語氣與 UI identity。
