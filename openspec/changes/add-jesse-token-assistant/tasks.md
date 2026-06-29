## 1. Baseline 與 Contract Foundation

- [x] 1.1 跑 baseline `npm run check` 並記錄目前 TypeScript 狀態，完成條件是後續驗證可明確區分 pre-existing 問題與 `add-jesse-token-assistant` 新增問題。
- [x] [P] 1.2 建立 `src/lib/types/assistant.ts` 與 `src/lib/types/index.ts` export，交付 `JesseAssistantAction`、`JesseAssistantProvider`、`JesseContextPayload`、`JesseAssistantResponse` typed contract；驗證方式是 `npm run check` 能檢查 union 使用與 export。
- [x] [P] 1.3 建立 bounded context payload 純函式與 node:test，交付 `token-overview`、`top-session`、`model-breakdown`、`quota-snapshot` payload 建構與 invalid drop 判定；驗證方式是新增 `tests/jesse-assistant-context.test.mjs` 並用專案既有 test loader 或 node:test 指令跑過。

## 2. Backend Assistant Flow

- [x] [P] 2.1 實作 `Assistant command returns model output instead of fire-and-forget`：新增 `src-tauri/src/commands/assistant.rs` 的 `assistant_generate(provider, action, context)`，回傳 markdown、provider、model、generated_at，並在 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs` 註冊；驗證方式是 `cargo test --lib` 編譯 command module 並覆蓋 request validation。
- [x] [P] 2.2 實作 `Provider credentials reuse local agent login state` 與 `Jesse reuses local agent credentials without storing secrets`：抽出或擴充 `src-tauri/src/tokens/agent_message.rs`，讓 Codex/Claude provider 讀本機既有登入憑證並擷取 response text，不把 token/account id 暴露給 frontend；驗證方式是 Rust 單元測試覆蓋 missing credential、response text extraction、error truncation。
- [x] [P] 2.3 實作 `Jesse validates assistant requests safely`：在 backend 拒絕 unsupported provider/action、empty context、oversized serialized context，且拒絕時不送 provider HTTP request；驗證方式是 `cargo test --lib` 覆蓋每種 validation error 與 no-request path。
- [x] [P] 2.4 實作 Jesse prompt rendering，交付 summary、explain、plan 三種 action 的 deterministic prompt，並固定 Jesse/pinkman persona 但保持資料解讀優先；驗證方式是 Rust 單元測試檢查 plan prompt 包含 `/plan` 意圖、context title/source、且不包含 credential fields。

## 3. Tokens Page Jesse UI

- [x] 3.1 實作 `Jesse assistant remains scoped to TokensPage` 與 `Tokens page shows Jesse assistant mascot`：在 `src/lib/components/tokens/TokensPage.tsx` 只於 `/tokens` render `JesseTokenAssistant`，不新增 route、navigation item 或 global overlay；驗證方式是 `npm run check` 通過且人工檢查 `src/router.tsx` 與 `src/lib/stores/navigation.ts` 未新增 Jesse page。
- [ ] 3.2 實作 `Jesse UI uses fixed mascot identity and chat panel states`：`src/lib/components/tokens/components/JesseTokenAssistant.tsx` 提供 collapsed pink chunky mascot、expanded drop target、context preview、chat thread、provider selector、composer、send、loading、assistant markdown、error、clear context states；驗證方式是 `/tokens` manual check 能展開/收合 Jesse、拖入 context 後自動摘要、追問後文字不溢出 compact panel。
- [ ] 3.3 實作 `Drag payload is structured token context` 與 `Tokens page provides structured draggable context`：在 `TokenStatCards`、`TopSessionsCard`、`ModelBreakdownTable`、`AgentQuotaPanel` 為支援區塊加 draggable affordance 並傳遞 typed JSON payload，不改變 card/table 尺寸；驗證方式是 node:test 驗證 payload shape，manual `/tokens` drop 驗證 preview 顯示 title/source。
- [ ] 3.4 實作 `Jesse supports context-bound chat` frontend/backend flow：新增/更新 `src/lib/components/tokens/hooks/useJesseAssistant.ts`、`src/lib/tauri/commands.ts`、`src-tauri/src/commands/assistant.rs`，讓 drop context 後自動呼叫 `assistant_chat` 產生摘要，composer follow-up 會帶入 active context 與 bounded chat messages；驗證方式是 `npm run check` 與 targeted Rust tests 通過，manual `/tokens` 用 invalid provider 或 missing credential 時 dashboard 仍可使用且 context/thread 不被清空。
- [x] 3.5 補齊 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 Jesse 文案，交付一致的 `tokens.jesse.*` 字典結構且不翻譯 agent id、provider id、路徑或 backend error；驗證方式是 `npm run check` 通過 TranslationDict 型別檢查。

## 4. Verification 與 Reviews

- [x] 4.1 跑 `npm run check`，完成條件是無本 change 新增 TypeScript/i18n/type errors；若仍有 pre-existing 問題，tasks 更新或實作紀錄需列出與 Jesse 無關的既有錯誤。
- [ ] 4.2 跑 `cargo test --lib` 與 `cargo build` in `src-tauri/`，完成條件是 assistant validation、prompt rendering、provider response extraction tests 通過且 Rust command build 成功。
- [x] 4.3 跑 `/spectra-audit` 審查 Jesse assistant 的 local credential、HTTP provider、error handling 與 persistence 邊界，完成條件是確認 token/account id 不回傳 frontend、不寫入 settings、不使用 shell subprocess 發送 provider request，並修正或記錄所有 blocking finding。
- [x] 4.4 跑 `/felina-ui-guidelines` 評估 Jesse UI-related 變更，完成條件是 archive notes 記錄命中的 guideline、Jesse mascot/panel 的 deviation 與理由，且未完成前不可進入 `/spectra-archive`。
- [ ] 4.5 跑 `npm run tauri dev` manual `/tokens` 驗證，完成條件是能開啟 `/tokens`、拖曳至少一個 supported context 到 collapsed 或 expanded Jesse、看到自動摘要、送出 follow-up、看到 loading/chat markdown/error state，且既有 token dashboard、quota panel、tab 切換仍正常。
