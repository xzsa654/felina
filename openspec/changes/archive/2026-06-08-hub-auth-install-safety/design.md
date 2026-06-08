## Context

Felina Hub 目前已完成基礎 CRUD：Publish（PUT + multipart tar.gz）、Install（GET download + import）、Delete（soft delete）、Preview（split view + SKILL.md render）。所有 API 完全開放，無身份驗證。公司內部 N 人各自跑 Felina app 連同一台 market server。

現有 server stack：Fastify + PostgreSQL（metadata）+ MinIO（tarball 物件儲存），部署為 Docker Compose。現有 skills table 有 `name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, deleted_at`。

現有 Felina client 端：`market_publish.rs`（publish + delete command）、`market_install.rs`（install + directory hash）、`market_server.rs`（server URL 設定），HubPage.tsx 有 publish dialog + install + preview。

## Goals / Non-Goals

**Goals:**

- 建立最簡帳號系統：email + password 註冊/登入，JWT 認證
- Publish / Delete 綁定身份，追蹤 author
- Delete 加所有權檢查（只有原 author 可刪）
- Install 本地已裝 + hash 不同時顯示確認 dialog
- Hub 預覽頁加 Uninstall 按鈕
- DB schema 預留未來 Entra ID 欄位

**Non-Goals:**

- 不做 OAuth2 / OIDC authorization server / consent screen / redirect flow
- 不做 Microsoft Entra ID 整合（預留欄位，不實作）
- 不做 email 驗證、密碼重設、密碼強度驗證
- 不做 admin 角色、audit log
- 不做 Hub 搜尋 / 排序 / 詳細頁（屬 `hub-discoverability`）
- 不清 fan-out targets（Uninstall 只刪 canonical storage）

## Decisions

### Server auth：email + password + JWT

Server 自建最簡 auth。新增 `users` table（`id UUID PK, email TEXT UNIQUE, password_hash TEXT, created_at TIMESTAMPTZ`）。註冊：bcrypt hash password，INSERT users，回 JWT。登入：SELECT by email，bcrypt.compare，回 JWT。JWT payload：`{ sub: id, email }`，HS256 簽章，secret 從環境變數 `JWT_SECRET` 讀取。

不用 OAuth2 因為：(a) 沒有第三方 client 需要 consent 授權；(b) 純內部桌面 app，不需 redirect flow；(c) 未來接 Entra ID 時只需加一條 OIDC code exchange endpoint，發同格式 JWT，下游 middleware 不動。

Token 過期時間：7 天。不做 refresh token rotation——過期後重新登入即可，內部使用場景可接受。

替代方案考慮：(a) API key（server 產，user 貼到 Settings）——體驗差，每人要手動配；(b) X-Author header 自報——無法驗證，不滿足所有權需求。

### DB schema migration 002_auth

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  entra_oid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE skills ADD COLUMN author TEXT;
ALTER TABLE skills ADD COLUMN updated_by TEXT;
ALTER TABLE skills ADD COLUMN updated_ip INET;
ALTER TABLE skills ADD COLUMN owner_id TEXT;
ALTER TABLE skills ADD COLUMN created_by_id TEXT;
```

`owner_id` / `created_by_id` 本 change 不寫入。`users.id` 用 UUID 不用 email 當 PK，未來同一人從 email+password 遷移到 Entra 時可用 `entra_oid` 關聯回同一筆 record。

### Server JWT middleware

新增 `market-server/src/auth.js`，export `verifyToken(request)` helper 與 Fastify `onRequest` hook。GET endpoint 不驗（list / download / skill-md 保持公開）。PUT / DELETE 驗 JWT，解出 `{ sub, email }` 掛到 `request.user`。驗失敗回 401。

### Server mutation endpoint 改動

PUT `/api/skills/:name`：從 `request.user.email` 取值，INSERT 時寫 `author = email`，UPSERT 時寫 `updated_by = email`，`updated_ip = request.ip`。

DELETE `/api/skills/:name`：從 `request.user.email` 取值，查詢 skill 的 `author`，若 `author IS NOT NULL AND author != email` → 403（「此 skill 由 {author} 發布，僅原作者可刪除」）。`author IS NULL`（legacy row）→ 允許刪除（避免 migration 後既有 skill 被鎖死）。

List response 擴展：`GET /api/skills` 回傳增加 `author` 欄位。

### Felina backend auth commands

新增 `src-tauri/src/commands/hub_auth.rs`，四個 command：

- `register_hub_account(email, password) -> Result<HubAuthResult, String>`：POST `/auth/register`，成功回 `{ token, email }`，存到 `~/.felina/settings.json` 的 `hubToken` 和 `hubEmail` 欄位
- `login_hub_account(email, password) -> Result<HubAuthResult, String>`：POST `/auth/login`，同上
- `get_hub_auth_status() -> Result<Option<HubAuthStatus>, String>`：讀 `~/.felina/settings.json`，有 `hubToken` 回 `Some({ email })`，無回 `None`
- `logout_hub_account() -> Result<(), String>`：清除 `hubToken` 和 `hubEmail`

Token 存 `~/.felina/settings.json` 而非 OS keychain。理由：(a) hub token 不是高敏感 credential（內網 market 的 session token）；(b) 省去 keychain 跨平台複雜度。

### Publish / Delete 帶 Bearer token

修改 `market_publish.rs`：`publish_canonical_skill` 和 `delete_market_skill` 先讀 `~/.felina/settings.json` 取 `hubToken`，None → Err（「請先登入 Hub 帳號」）。Request 加 `.header("Authorization", format!("Bearer {}", token))`。

### Hub 登入 UI

HubPage 右上 header actions 區域（目前有 Refresh + Publish），新增 auth 區域：

- 未登入：顯示「Login」按鈕。點擊開 LoginDialog（Modal），內有 Login / Register 兩個 tab。Email + Password input，Submit 呼叫對應 command。成功後關 dialog，header 顯示 email。
- 已登入：顯示 email 文字 + Logout 按鈕（secondary）。
- 未登入時：Publish 按鈕 disabled + tooltip「請先登入」。Install 不受影響。

LoginDialog 是 Hub 專屬元件（`src/lib/components/hub/LoginDialog.tsx`），不是全域元件。

UI-related：需 /felina-ui-guidelines review。

### Install 確認 dialog

修改 HubPage `handleInstall`：

1. 呼叫 `getSkillDirectoryHash(name)` 取 local hash
2. Local hash 不存在（全新安裝）→ 直接安裝
3. Local hash 存在 + hash 等於 market contentHash → 已是最新，不動作
4. Local hash 存在 + hash 不同 → 彈 ConfirmDialog，顯示 skill name、author、updated at、version 差異、「安裝將覆蓋本地版本」警告
5. 使用者確認 → 執行 install；取消 → 不動作

ConfirmDialog 復用 `src/lib/components/shared/ConfirmDialog.tsx`（已存在）。

### Uninstall command + UI

Backend：`market_install.rs` 新增 `uninstall_skill(name) -> Result<(), String>`。刪除 `~/.felina/skills/<name>/` 整個目錄。不清 fan-out targets——fan-out 有自己的 drift detection 機制。

Frontend：MarketSkillPreview 的 action 區域，當 local 已安裝時顯示 Uninstall 按鈕（danger style）。點擊 → ConfirmDialog → 確認 → 呼叫 uninstall → 刷新 upToDateNames。

### Toast 通知

Install / Uninstall / Publish 完成後用 Tauri notification plugin（`@tauri-apps/plugin-notification`，已在 lib.rs 註冊）發 OS 原生通知。失敗仍用 inline error banner。

### 第三方依賴

- market-server 新增：`bcryptjs`（MIT，password hash）、`jsonwebtoken`（MIT，JWT sign/verify）
- Cargo：無新 crate
- Bundle size 影響：只影響 server docker image

## Implementation Contract

**Behavior：**
- 未登入使用者可瀏覽 Hub 列表、查看 preview、安裝 skill，不可 publish / delete
- 使用者可在 Hub 頁自助 register + login，登入後可 publish / delete 自己的 skill
- Delete 他人 skill → 403 錯誤訊息顯示原作者
- Install 本地已裝且 hash 不同的 skill → 確認 dialog 顯示 author/version 差異
- Uninstall 從 canonical storage 刪除 skill 目錄

**Interface / data shape：**
- `POST /auth/register` body: `{ email, password }` → 200 `{ token, email }` / 400 / 409
- `POST /auth/login` body: `{ email, password }` → 200 `{ token, email }` / 401
- JWT payload: `{ sub: uuid, email: string, iat, exp }`
- PUT / DELETE：`Authorization: Bearer <token>` header，無 token → 401
- `GET /api/skills` response 增加 `author: string | null` 欄位
- Tauri commands：`register_hub_account`、`login_hub_account`、`get_hub_auth_status`、`logout_hub_account`、`uninstall_skill`
- Token 存 `~/.felina/settings.json` 的 `hubToken` + `hubEmail` key

**Failure modes：**
- JWT 過期 / 無效 → 401，前端清除本地 token 並提示重新登入
- Register email 重複 → 409，前端顯示「此 email 已註冊」
- Delete 非 author → 403，前端顯示原作者資訊
- Uninstall 目錄不存在 → Err 提示

**Acceptance criteria：**
- `npm test`（market-server）涵蓋 register / login / JWT middleware / author write / delete 所有權
- `cargo test --lib hub_auth market_publish market_install` 通過
- `npm run check` 通過
- 手動 e2e：register → login → publish → list 顯示 author → 另一帳號 delete → 403 → install 已裝 skill → 確認 dialog → uninstall → 目錄移除

**Scope boundaries：**
- In scope：server auth、author 三欄、delete 所有權、client auth command、Hub login UI、install 確認 dialog、uninstall、toast
- Out of scope：OAuth2/OIDC、Entra ID、email 驗證、密碼重設、admin、搜尋/排序、fan-out 清理

## Risks / Trade-offs

- **JWT_SECRET 管理**：環境變數，`.env` 不進 git。洩漏則所有 token 可偽造。緩解：內網部署
- **Token 過期體驗**：7 天過期無 refresh。使用者需重新登入。內部可接受
- **Legacy NULL author row**：migration 後既有 skill 的 author 為 NULL，delete 時允許任何人刪。建議管理員 re-publish 重要 skill
- **升級順序**：server 先升，舊 client publish 會被 401。須通知使用者更新
- **Password 明文傳輸**：HTTP 環境下 password 以明文傳輸。緩解：部署指南建議 HTTPS 或 VPN
- **安全敏感**：涉及 password 處理與 JWT，tasks 應包含 audit 審查