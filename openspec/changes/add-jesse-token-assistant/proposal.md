## Why

`/tokens` 已經能呈現 token、quota、session、model breakdown 等資料，但使用者仍需要自己判讀「這段數據代表什麼」以及下一步要查哪裡。新增 Jesse 讓使用者能把 `/tokens` 內看不懂的區塊拖給 Felina 吉祥物助理，由使用者既有 agent 帳號先產生摘要，再在同一個 panel 內用聊天室追問，把資料判讀留在工作脈絡內完成。

## What Changes

- 在 `/tokens` 頁面新增固定的 Jesse assistant panel，形象為 Felina 吉祥物 Jesse，又名 pinkman：胖胖、愛吃、粉紅色塊頭。
- 支援 `/tokens` 內指定資料區塊以結構化 payload 拖曳到 Jesse，包括 token insight、top session、model breakdown、quota snapshot 相關 context。
- 新增 assistant Tauri command，接受 provider、context payload 與 bounded chat messages，回傳 markdown 回覆；drop context 後先自動摘要，使用者可繼續追問。
- assistant provider 沿用使用者本機既有 agent 憑證來源，優先支援 Codex 與 Claude，不在 Felina 內新增 API key 輸入或保存。
- 新增前端 invoke wrapper、types、React Query hooks 或 mutation layer，讓 `/tokens` 只透過 typed contract 呼叫 backend。
- 新增 Jesse 相關 i18n 文案，維持 zh-TW 與 en 字典結構一致。

## Capabilities

### New Capabilities

- `jesse-token-assistant`: `/tokens` 內的 Jesse 吉祥物助理，可接收結構化 token context 並用使用者既有 agent 憑證產生摘要與多輪追問回覆。

### Modified Capabilities

(none)

## Impact

- Affected specs: jesse-token-assistant
- Affected code:
  - New: src/lib/components/tokens/components/JesseTokenAssistant.tsx
  - New: src/lib/components/tokens/hooks/useJesseAssistant.ts
  - New: src/lib/types/assistant.ts
  - New: src-tauri/src/commands/assistant.rs
  - Modified: src/lib/components/tokens/TokensPage.tsx
  - Modified: src/lib/components/tokens/components/TokenStatCards.tsx
  - Modified: src/lib/components/tokens/components/TopSessionsCard.tsx
  - Modified: src/lib/components/tokens/components/ModelBreakdownTable.tsx
  - Modified: src/lib/components/tokens/components/AgentQuotaPanel.tsx
  - Modified: src/lib/tauri/commands.ts
  - Modified: src/lib/types/index.ts
  - Modified: src/lib/i18n/locales/en.ts
  - Modified: src/lib/i18n/locales/zh-TW.ts
  - Modified: src-tauri/src/commands/mod.rs
  - Modified: src-tauri/src/lib.rs
  - Modified: src-tauri/src/tokens/agent_message.rs
  - Removed: none
- APIs: 新增 typed Tauri invoke command，不變更既有 token analytics command 的 request 或 response shape。
- Dependencies: 不新增 npm 或 Cargo dependency；HTTP 呼叫沿用既有 Rust reqwest stack。
- Compatibility: `/tokens` 現有圖表與 quota 功能保持可用；Jesse provider credential 不存在或請求失敗時只顯示 assistant 錯誤狀態，不阻斷 dashboard 載入。
