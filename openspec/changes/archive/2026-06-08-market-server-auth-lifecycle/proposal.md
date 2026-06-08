## Summary

Token 生命週期管理：實作 refresh token 或 server-side token 撤銷機制，以及 skill 列表端點的存取控制選項。

## Motivation

目前 JWT token 有效期 7 天且無撤銷機制。使用者登出後 token 仍有效，帳號遭盜後無法即時失效。此外 `/api/skills` 列表端點完全公開，暴露所有 skill 名稱與作者 email。

## Proposed Solution

1. **Refresh token 機制**：login/register 回傳短期 access token（15min）+ 長期 refresh token（30d，存 DB）。新增 `POST /auth/refresh` 端點。logout 時從 DB 刪除 refresh token，實現 server-side 撤銷。
2. **Skill 列表存取控制**：`/api/skills` 預設公開但 author email 遮蔽為 username（不含 @domain）。設 `REQUIRE_AUTH_FOR_LIST=true` 環境變數時，列表端點也需 Bearer token。
3. **Felina client 端配合**：login 後存 access token + refresh token，access token 過期時自動 refresh，refresh 失敗則導向重新登入。

## Non-Goals

- Password reset / email verification（未來再做）
- OAuth2 / Entra ID 整合（DB 已預留 entra_oid 欄位，但此次不實作）
- Multi-device session 管理

## Capabilities

### Modified Capabilities

- `hub-auth`: 加 refresh token、token 撤銷、access token 短期化
- `market-server-publish`: skill 列表 author 遮蔽

## Impact

- Affected specs: `hub-auth`（modified）、`market-server-publish`（modified）
- Affected code:
  - Modified: `market-server/src/auth.js`、`market-server/src/app.js`、`market-server/src/db.js`、`market-server/src/app.test.js`、`market-server/migrations/`（新 migration）、`src-tauri/src/commands/hub_auth.rs`、`src/lib/tauri/commands.ts`、`src/lib/components/hub/HubPage.tsx`
  - New: `market-server/migrations/003_refresh_tokens.sql`
  - Removed: (none)
