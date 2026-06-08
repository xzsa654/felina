## 1. DB migration + refresh token 基礎

- [x] 1.1 建立 `market-server/migrations/003_refresh_tokens.sql`：CREATE TABLE refresh_tokens（id UUID PK DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT now()）；CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash)；CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)。驗證：`docker compose up --build` → `\d refresh_tokens` 顯示完整欄位與索引。
- [x] 1.2 在 `market-server/src/auth.js` 新增 `generateRefreshToken()`（回傳 UUID v4）、`hashRefreshToken(token)`（SHA-256 hex）。修改 `signToken` 讀 `ACCESS_TOKEN_EXPIRY` 環境變數（預設 `15m`）取代硬編碼 `7d`。驗證：`npm test` 新增的 auth 單元測試通過。
- [x] 1.3 在 `market-server/src/db.js` 新增 `createRefreshToken({ userId, tokenHash, expiresAt })`（INSERT RETURNING）、`findRefreshToken(tokenHash)`（SELECT）、`deleteRefreshToken(tokenHash)`（DELETE）、`deleteAllRefreshTokens(userId)`（DELETE WHERE user_id）。驗證：`npm test` db 測試通過。

## 2. Server 端點改動

- [x] [P] 2.1 修改 `market-server/src/app.js` 的 `POST /auth/register`：成功後除了 signToken 外，同時 generateRefreshToken → hashRefreshToken → createRefreshToken（30 天過期），回傳 `{ accessToken, refreshToken, email }`。驗證：`npm test` register 測試更新通過。
- [x] [P] 2.2 修改 `market-server/src/app.js` 的 `POST /auth/login`：同 register，成功後回傳 `{ accessToken, refreshToken, email }`。驗證：`npm test` login 測試更新通過。
- [x] 2.3 在 `market-server/src/app.js` 新增 `POST /auth/refresh`：body `{ refreshToken }` → hashRefreshToken → findRefreshToken → 檢查 expires_at > now() → 刪舊 → 新 accessToken + 新 refreshToken → 存 DB → 回 200 `{ accessToken, refreshToken, email }`。無效/過期 → 401。驗證：`npm test` refresh 測試通過。
- [x] 2.4 在 `market-server/src/app.js` 新增或修改 `POST /auth/logout`：有 body.refreshToken → deleteRefreshToken。無 refreshToken 但有 Bearer token → deleteAllRefreshTokens(user.sub)。回 200。驗證：`npm test` logout 測試通過。
- [x] 2.5 更新 `market-server/.env.example` 加 `ACCESS_TOKEN_EXPIRY=15m`。驗證：`.env.example` 包含新變數。

## 3. Author 遮蔽

- [x] 3.1 修改 `market-server/src/db.js` 的 `mapListRow`：`author` 欄位若非 null，取 `@` 前的 username 部分。驗證：`npm test` 列表測試確認 author 只回傳 username。

## 4. Felina client 端

- [x] [P] 4.1 修改 `src-tauri/src/commands/hub_auth.rs`：`HubAuthResult` struct 改為 `{ access_token, refresh_token, email }`。register/login 成功後存 `hubAccessToken`、`hubRefreshToken`、`hubEmail` 到 settings.json（取代原 `hubToken`）。logout 清除三個欄位。驗證：`cargo check` 通過。
- [x] [P] 4.2 修改 `src-tauri/src/commands/market_publish.rs`：publish/delete 開頭讀 `hubAccessToken`，decode JWT 檢查 `exp`。若過期，讀 `hubRefreshToken` 呼叫 `POST /auth/refresh` 取新 token pair，更新 settings.json，再用新 access token 繼續。Refresh 失敗 → Err（「登入已過期，請重新登入」）。驗證：`cargo check` 通過。
- [x] 4.3 修改 `src/lib/tauri/commands.ts`：`api.market.register` 和 `login` 回傳型別改為 `{ accessToken: string, refreshToken: string, email: string }`。驗證：`npm run check` 通過。

## 5. 整合測試

- [x] 5.1 `npm test`（market-server）全部通過。驗證：CI 等級 test pass。
- [x] 5.2 `cargo check` 通過。驗證：Rust 編譯 pass。
- [x] 5.3 `npm run check` 通過。驗證：TypeScript 靜態檢查 pass。
- [x] 5.4 手動 e2e：register → publish → 等 access token 過期（或手動改短過期時間）→ 再次 publish → 自動 refresh 成功 → logout → refresh 失敗。驗證：手動 e2e。
