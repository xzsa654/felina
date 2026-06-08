## Why

Hub 目前的 Publish / Delete 完全開放——任何連上 market server 的 Felina app 都能發布或刪除任何 skill，author 欄位不存在。公司內部多人使用時：(1) 無法追蹤誰發布了什麼；(2) 任何人可誤刪他人的 skill；(3) Install 覆蓋本地修改過的 skill 時沒有任何警告。需要一套最簡帳號系統（email + password + JWT）綁定 publish 所有權，同時完善 Install 確認 dialog 和 Uninstall 功能。

## What Changes

- Market server 新增 `users` table 與 `POST /auth/register`、`POST /auth/login` endpoint，發 JWT
- Market server 所有 mutation endpoint（PUT / DELETE）改為驗 JWT，從 token 取 email 寫入 author 相關欄位
- Market server `skills` table 加 `author`、`updated_by`、`updated_ip` 三欄 + 預留 `owner_id`、`created_by_id`（NULL，給未來 Entra ID）
- Market server DELETE 加所有權檢查：JWT email ≠ skill.author → 403
- Market server list / detail response 擴展回傳 `author`、`updatedAt`
- Felina backend 新增 `register_hub_account` / `login_hub_account` Tauri command，token 存 `~/.felina/settings.json`
- Felina backend publish / delete 改帶 `Authorization: Bearer <token>`，未登入時回 Err
- Felina frontend Hub 頁右上加 Register / Login UI（dialog），已登入顯示 email + Logout
- Felina frontend 未登入時 Publish / Delete 按鈕 disabled
- Felina frontend Install 確認 dialog：本地已裝 + hash 不同 → 彈 dialog 顯示 author / updated_at / version 差異
- Felina frontend Hub 預覽頁加 Uninstall 按鈕（已安裝時顯示）
- Felina frontend Install / Uninstall / Publish 操作加 toast 通知

## Non-Goals

- 不做 OAuth2 authorization server / consent screen / redirect flow / refresh token rotation
- 不做 Microsoft Entra ID / SSO 整合（本 change 預留 DB 欄位，實際整合留給未來 change）
- 不做 email 驗證、密碼重設、密碼強度檢查
- 不做 admin 角色、admin allowlist、audit log table
- 不做 Hub 搜尋 / 排序 / 詳細頁（屬於 `hub-discoverability` change）
- 不改 Tauri command 簽名或前端呼叫方式（除新增的 auth command）

## Capabilities

### New Capabilities

- `hub-auth`: Market server 帳號系統（users table、register/login endpoint、JWT 驗證 middleware）與 Felina client 端的 register/login command + Hub 登入 UI
- `hub-install-safety`: Hub Install 安全確認 dialog（本地已裝 + hash 不同時顯示 author/version/updated_at 差異）與 Uninstall 功能

### Modified Capabilities

- `market-server-publish`: PUT endpoint 改為需要 JWT 認證，從 token 取 email 寫入 author/updated_by/updated_ip 欄位
- `market-server-storage`: skills table 新增 author/updated_by/updated_ip/owner_id/created_by_id 欄位
- `canonical-skill-publish`: publish_canonical_skill command 改為帶 Bearer token，未登入時 Err

## Impact

- Affected specs: `hub-auth`（新）、`hub-install-safety`（新）、`market-server-publish`（修改）、`market-server-storage`（修改）、`canonical-skill-publish`（修改）
- Affected code:
  - New: `market-server/migrations/002_auth.sql`、`market-server/src/auth.js`、`src-tauri/src/commands/hub_auth.rs`
  - Modified: `market-server/src/app.js`、`market-server/src/db.js`、`market-server/src/app.test.js`、`market-server/src/db.test.js`、`src-tauri/src/commands/market_publish.rs`、`src-tauri/src/commands/mod.rs`、`src-tauri/src/lib.rs`、`src/lib/tauri/commands.ts`、`src/lib/components/hub/HubPage.tsx`、`src/lib/components/hub/MarketSkillPreview.tsx`、`src/lib/i18n/locales/en.ts`、`src/lib/i18n/locales/zh-TW.ts`
  - Removed: （無）
- 新增依賴:
  - market-server: `bcryptjs`（password hash）、`jsonwebtoken`（JWT sign/verify）
  - Cargo: （無新 crate，reqwest 已有 blocking + json）
- 風險：market server 升級後既有 Felina client（未更新版本）的 publish 會被 401 拒絕。升級順序應為 server → client。已發布的 skill 的 author 欄位為 NULL，不影響安裝，但 delete 所有權檢查需處理 NULL author 的 row（允許任何人刪除 NULL author 的 skill，或鎖定不可刪除）
