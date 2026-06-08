## Context

hub-auth-install-safety 建立了基本的 JWT auth（7 天 access token、無 refresh、logout 只清 client 端）。本次補完 token 生命週期：短期 access token + 長期 refresh token + server-side 撤銷。同時處理 skill 列表 author email 遮蔽。

## Goals / Non-Goals

**Goals:**

- Access token 過期後 client 可無感刷新，不需重新登入
- Logout 後 server 端即時失效（refresh token 從 DB 刪除）
- 公開列表不暴露完整 email

**Non-Goals:**

- Password reset / email verification
- OAuth2 / Entra ID
- Multi-device session 管理
- Token blacklist for access tokens（短期 token 過期即失效，不需額外 blacklist）

## Decisions

### D1: Token 雙層架構

- Access token：JWT，15 分鐘過期，不存 DB，stateless 驗證
- Refresh token：UUID v4，30 天過期，存 `refresh_tokens` table（user_id, token_hash, expires_at, created_at）
- Login/Register 回傳 `{ accessToken, refreshToken, email }`
- `signToken` 的 `expiresIn` 改為 `ACCESS_TOKEN_EXPIRY` 環境變數（預設 `15m`）

### D2: Refresh 端點

新增 `POST /auth/refresh`，body `{ refreshToken }`。Server hash refresh token 後查 DB，有效 → 發新 access token + 新 refresh token（rotation），舊 refresh token 刪除。無效/過期 → 401。

Refresh token rotation：每次 refresh 都換新 token，舊的立即失效。防止 token 被截取後持續使用。

### D3: Logout 端點改動

`POST /auth/logout` 新增（或改現有 client-only logout）：body `{ refreshToken }`。Server 刪除該 refresh token row。不帶 refreshToken 時清除該 user 所有 refresh tokens（全裝置登出）。

### D4: DB migration

`003_refresh_tokens.sql`：
- CREATE TABLE `refresh_tokens`（id UUID PK, user_id UUID REFERENCES users, token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT now()）
- CREATE INDEX on refresh_tokens(token_hash)
- CREATE INDEX on refresh_tokens(user_id)

### D5: Skill 列表 author 遮蔽

`/api/skills` 回傳的 `author` 欄位改為只顯示 `@` 前面的 username。完整 email 只在需要 auth 的端點回傳（如 skill detail with auth）。`mapListRow` 中處理遮蔽邏輯。

### D6: Felina client 端改動

- `hub_auth.rs`：login/register 回傳改存 accessToken + refreshToken 到 settings.json
- `market_publish.rs`：PUT/DELETE 發送前檢查 access token 是否過期（decode JWT 看 exp），過期則先呼叫 refresh 端點取新 token
- `commands.ts`：wrapper 型別更新
- `HubPage.tsx`：無 UI 改動，token refresh 在 backend 層透明處理

### Scope Boundaries

**In scope:** market-server auth 端點 + DB migration + Felina backend token 管理 + 列表遮蔽
**Out of scope:** 前端 UI 改動（token refresh 在 Rust backend 透明處理）、password reset、OAuth2

## Implementation Contract

### Task 群組 1: DB migration + refresh token 基礎
- 建立 refresh_tokens table + indexes
- auth.js 新增 refresh token 生成/驗證 functions
- 驗證目標：migration 成功、unit test 通過

### Task 群組 2: Server 端點改動
- login/register 回傳 accessToken + refreshToken
- 新增 POST /auth/refresh
- 改動 POST /auth/logout 接受 refreshToken
- Access token 過期時間改為 15 分鐘
- 驗證目標：`npm test` 全通過

### Task 群組 3: Author 遮蔽
- mapListRow 的 author 改為 username only
- 驗證目標：`/api/skills` 回傳的 author 不含 @domain

### Task 群組 4: Felina client 端
- hub_auth.rs 存 refreshToken
- market_publish.rs 加 auto-refresh 邏輯
- commands.ts 型別更新
- 驗證目標：`cargo check` + `npm run check` 通過

### Task 群組 5: 整合測試
- npm test + cargo check + 手動 e2e
- 驗證目標：全通過
