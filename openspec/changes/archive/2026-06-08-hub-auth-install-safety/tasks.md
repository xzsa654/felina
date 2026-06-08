## 1. Server DB migration + auth 模組

- [x] 1.1 建立 `market-server/migrations/002_auth.sql`：CREATE TABLE users（id UUID PK DEFAULT gen_random_uuid(), email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, entra_oid TEXT, created_at TIMESTAMPTZ DEFAULT now()）；ALTER TABLE skills ADD COLUMN author TEXT, updated_by TEXT, updated_ip INET, owner_id TEXT, created_by_id TEXT。驗證：`docker compose down -v && docker compose up --build` → `\d users` 和 `\d skills` 顯示完整欄位。
- [x] 1.2 在 `market-server/package.json` 新增 `bcryptjs` 和 `jsonwebtoken` 依賴。`npm install` 確認鎖檔更新。驗證：`node -e "require('bcryptjs');require('jsonwebtoken')"` 無錯。
- [x] [P] 1.3 新增 `market-server/src/auth.js`：export `hashPassword(password)`（bcrypt, 10 rounds）、`comparePassword(password, hash)`、`signToken({ sub, email })`（HS256, JWT_SECRET env, 7d expiry）、`verifyToken(token)`。export Fastify `onRequest` hook `requireAuth`：讀 Authorization: Bearer header → verifyToken → 掛 request.user = { sub, email }，失敗 401。驗證：`npm test` 新增的 auth 單元測試通過。
- [x] [P] 1.4 在 `market-server/src/db.js` 新增 `createUser({ email, passwordHash })`（INSERT INTO users RETURNING id, email）、`getUserByEmail(email)`（SELECT id, email, password_hash）。`mapListRow` 增加 `author` 欄位。`upsertSkill` 增加 `author`、`updatedBy`、`updatedIp` 參數，INSERT 時寫 author，UPDATE 時寫 updated_by + updated_ip（不覆蓋 author）。驗證：`npm test` db 測試通過。

## 2. Server auth endpoints + mutation 改動

- [x] 2.1 在 `market-server/src/app.js` 新增 `POST /auth/register`：validate email/password 非空（400）、hashPassword、createUser（409 if unique violation）、signToken、回 200 `{ token, email }`。新增 `POST /auth/login`：getUserByEmail（401 if not found）、comparePassword（401 if mismatch）、signToken、回 200 `{ token, email }`。驗證：curl 測試 register + login flow。
- [x] 2.2 在 `market-server/src/app.js` 為 PUT 和 DELETE endpoint 加上 `requireAuth` onRequest hook。PUT handler 從 `request.user.email` 取值傳入 upsertSkill 的 author/updatedBy/updatedIp 參數。DELETE handler 從 `request.user.email` 取值，查詢 skill 的 author，若 `author != null && author != email` → 403。驗證：無 token PUT → 401；非 author DELETE → 403。
- [x] 2.3 在 `market-server/docker-compose.yml` 的 api service 環境變數加 `JWT_SECRET`（從 `.env` 讀取）。`.env.example` 加 `JWT_SECRET=change-me-in-production`。驗證：`docker compose up --build` 正常啟動。
- [x] 2.4 擴展 `market-server/src/app.test.js`：新增 register（200/409/400）、login（200/401）、PUT 無 token → 401、PUT 有 token → 200 + author 寫入、DELETE 非 author → 403、DELETE author → 204、DELETE legacy NULL author → 204 測試。驗證：`npm test` 全部通過。

## 3. Felina backend auth commands

- [x] [P] 3.1 新增 `src-tauri/src/commands/hub_auth.rs`：實作 `register_hub_account(email, password) -> Result<HubAuthResult, String>`（POST /auth/register，成功存 token 到 settings.json 的 hubToken + hubEmail）、`login_hub_account(email, password) -> Result<HubAuthResult, String>`（POST /auth/login，同上）、`get_hub_auth_status() -> Result<Option<HubAuthStatus>, String>`（讀 settings.json）、`logout_hub_account() -> Result<(), String>`（清除 hubToken/hubEmail）。HubAuthResult struct: `{ token: String, email: String }`。HubAuthStatus struct: `{ email: String }`。驗證：`cargo check` 通過。
- [x] [P] 3.2 修改 `market_publish.rs`：`publish_canonical_skill` 和 `delete_market_skill` 開頭讀 settings.json 的 hubToken，None → Err（「請先登入 Hub 帳號」）。PUT/DELETE request 加 `.header("Authorization", format!("Bearer {}", token))`。HTTP 401 回 Err（「登入已過期，請重新登入」）。HTTP 403 回 Err 含 server 錯誤訊息。驗證：`cargo check` 通過。
- [x] 3.3 在 `src-tauri/src/commands/mod.rs` 加 `pub mod hub_auth;`。在 `src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊 `register_hub_account`、`login_hub_account`、`get_hub_auth_status`、`logout_hub_account`。驗證：`cargo check` 通過。
- [x] 3.4 新增 `market_install.rs` 的 `uninstall_skill(name: String) -> Result<(), String>`：validate name、確認 `~/.felina/skills/<name>/` 存在、`std::fs::remove_dir_all`。在 mod.rs + lib.rs 註冊。驗證：`cargo check` 通過。
- [x] 3.5 在 `src/lib/tauri/commands.ts` 的 `api.market` 新增 `register`、`login`、`getAuthStatus`、`logout`、`uninstallSkill` wrapper。驗證：`npm run check` 通過。

## 4. Hub 登入 UI

- [x] 4.1 新增 `src/lib/components/hub/LoginDialog.tsx`：Modal 內含 Login / Register 兩個 tab（用 state 切換，不用 router）。每個 tab 有 email + password input + submit button。Submit 呼叫對應 Tauri command。成功 → 關 dialog + 回呼 onSuccess(email)。失敗 → inline error。驗證：`npm run check` 通過。
- [x] 4.2 修改 `HubPage.tsx`：頁面初始化時呼叫 `getAuthStatus()` 存到 state。Header actions 區域：未登入 → Login 按鈕 + Publish disabled（tooltip「請先登入」）；已登入 → email 顯示 + Logout 按鈕 + Publish enabled。LoginDialog open/close 由 state 控制。Logout 清除 state + 呼叫 logout command。驗證：`npm run check` 通過。
- [x] 4.3 新增 i18n keys 至 `en.ts` 和 `zh-TW.ts`：`hub.auth.login`、`hub.auth.register`、`hub.auth.logout`、`hub.auth.email`、`hub.auth.password`、`hub.auth.loginRequired`、`hub.auth.registerSuccess`、`hub.auth.loginSuccess`、`hub.auth.emailExists`、`hub.auth.invalidCredentials`、`hub.auth.sessionExpired`、`hub.auth.loggedInAs`。驗證：`npm run check` 通過。

## 5. Install 確認 dialog + Uninstall UI

- [x] [P] 5.1 修改 `HubPage.tsx` 的 `handleInstall`：先呼叫 `getSkillDirectoryHash(name)`，local hash 存在 + ≠ market contentHash → set `confirmInstall` state（skill name + author + updatedAt + version）→ 顯示 ConfirmDialog。Confirm → 執行 install；Cancel → 清 state。Local hash 不存在 → 直接 install。驗證：`npm run check` 通過。
- [x] [P] 5.2 修改 `MarketSkillPreview.tsx`：新增 `installed: boolean` 和 `onUninstall` prop。已安裝時顯示 Uninstall 按鈕（danger style）。點擊 → ConfirmDialog（「確定要移除 {name}？」）→ 確認 → onUninstall()。HubPage 傳入 handler：呼叫 `uninstallSkill(name)` → 刷新 upToDateNames。驗證：`npm run check` 通過。
- [x] 5.3 新增 i18n keys：`hub.confirm.title`、`hub.confirm.overwriteWarning`、`hub.confirm.author`、`hub.confirm.updatedAt`、`hub.confirm.version`、`hub.uninstall.button`、`hub.uninstall.confirm`、`hub.uninstall.success`。驗證：`npm run check` 通過。

## 6. Toast 通知

- [x] 6.1 在 `HubPage.tsx` 的 install / uninstall / publish 成功 callback 加 `sendNotification({ title: "Felina Hub", body: ... })`（from `@tauri-apps/plugin-notification`）。失敗維持 inline error banner。驗證：`npm run check` 通過。

## 7. 整合驗證

- [x] 7.1 `npm test`（market-server）全部通過。驗證：CI 等級 test pass。
- [x] 7.2 `cargo test --lib -p felina hub_auth market_publish market_install` 通過。驗證：相關模組測試 pass。
- [x] 7.3 `npm run check` 通過。驗證：TypeScript 靜態檢查 pass。
- [x] 7.4 手動 e2e：`docker compose up --build` 起 server → `npm run tauri dev` 起 app → Hub 頁 Register → Login → Publish → list 顯示 author → 另一帳號 Delete → 403 → Install 已裝 skill → 確認 dialog → Uninstall → 目錄移除 → toast 顯示。驗證：手動 e2e。
- [x] 7.5 /felina-ui-guidelines review：檢查 LoginDialog、ConfirmDialog、Uninstall 按鈕是否符合 Felina UI 設計語彙（無邊框、語意色、glass morphism）。驗證：guideline 評估結論記錄。
- [x] 7.6 /spectra-audit：審查 auth 相關程式碼（password handling、JWT、token storage、input validation）的安全性。驗證：audit 結果無 critical。