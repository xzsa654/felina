## Why

Hub 雖然能列出與安裝 skill，但 market-server 仍是 hardcoded mock：`SKILLS` array、`contentHash` 假字串、download 即時拼一份只含 SKILL.md 的 tar.gz。Postgres + MinIO 雖已在 docker-compose 備好，server.js 完全沒接。因此 Hub 目前無人能上架、`Up to date` 比對永遠失敗、`local-skill-market-prototype` 寫好的 UI 分支等於擺設。本 change 把 server 接成真實儲存並開出 publish 路徑，讓內網同事可從 Felina app 上架 skill 給其他人安裝。

## What Changes

- 後端：market-server `src/server.js` 移除 hardcoded `SKILLS` array；boot 時跑 `node-pg-migrate up` 建 schema；list/download 改成查 Postgres + 從 MinIO stream。
- 後端：新增 `PUT /api/skills/:name` 接 multipart tar.gz → 解壓讀 frontmatter → 算 `tarball_hash = SHA-256(bytes)` → MinIO `putObject` → Postgres upsert（覆蓋同 name，舊 storage_key 移到 `previous_storage_key`，MinIO 物件不刪）。
- 後端：新增 `DELETE /api/skills/:name`，soft delete（標 `deleted_at`，MinIO 物件不刪）。
- 後端：新增 Postgres schema（一張 `skills` 表：name PK、version、description、content_hash、tarball_hash、storage_key、previous_storage_key、updated_at、deleted_at）；使用 `node-pg-migrate` 管理 migration。
- 後端：MinIO bucket `skills` 啟動時 ensure 存在。
- Frontend / Rust：新增 `publish_canonical_skill(name)` Tauri command，打包 `~/.felina/skills/<name>/` 為 tar.gz、算 `directory_hash`（用既有 `fan_out::directory_hash`）、PUT 到 `${marketServerUrl}/api/skills/<name>`，body 含 tar.gz、`X-Content-Hash` header 帶 client 算的語義 hash。
- Frontend：暫時把 publish 入口放在 Skill editor action menu 或 Hub 頁面 floating button（**入口位置最終位置由 hub-discoverability change 決定，這個 change 只給一個可動的入口**）。
- 已歸檔的 `Installed State Display` UI 邏輯不動：本 change 完工後該 UI 自動開始正確比對。

## Non-Goals (optional)

- 不做身分驗證 / authz / `X-Author` header（→ `hub-install-safety-and-author-attribution` change）。
- 不做 install 前的 update 確認 dialog 或 uninstall 按鈕（→ 同上下個 change）。
- 不做 channel / draft / stable 分層、不做 yank / restore endpoint、不做 audit log table、不驗 semver、不強制 `UNIQUE(name, version)` bump（公司內網信任場景，過度設計）。
- 不做 publish UI 最終樣式 / 入口位置定案（→ `hub-discoverability` change）。
- 不做 SSO / token 認證、不做 owner check、不做 admin allowlist。
- 不做 search / 詳細頁 / SKILL.md 預覽（→ `hub-discoverability` change）。
- 不做 `hash_algo` / `hash_version` schema 欄位（預設 SHA-256 寫死；未來升演算法再 ALTER TABLE）。

## Capabilities

### New Capabilities

- `market-server-storage`: 真實 Postgres + MinIO 後端取代 hardcoded mock，含 schema、migration runner、storage adapter。
- `market-server-publish`: `PUT /api/skills/:name` 接收 tar.gz、解析 frontmatter、寫 MinIO + Postgres；`DELETE /api/skills/:name` soft delete。
- `canonical-skill-publish`: Felina app 端 `publish_canonical_skill` Tauri command，打包 canonical skill 並 PUT 到 market server。

### Modified Capabilities

- `local-market-infrastructure`: API server 從 hardcoded mock 演進為真實 storage（Postgres metadata + MinIO blob）；新增 publish / delete endpoint。
- `hub-ui-navigation`: `Installed State Display` 的 contentHash 從假字串變真實值（行為不變、僅生效）；新增 publish 入口（暫定位置，下個 change 收）。

## Impact

- Affected specs: `market-server-storage`（新）、`market-server-publish`（新）、`canonical-skill-publish`（新）、`local-market-infrastructure`（MODIFIED）、`hub-ui-navigation`（MODIFIED）
- Affected code:
  - New:
    - market-server/migrations/001_init.sql
    - market-server/src/db.js
    - market-server/src/storage.js
    - src-tauri/src/commands/market_publish.rs
  - Modified:
    - market-server/src/server.js
    - market-server/package.json
    - market-server/docker-compose.yml
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/lib/tauri/commands.ts
    - src/lib/components/hub/HubPage.tsx
    - src/lib/i18n/locales/en.ts
    - src/lib/i18n/locales/zh-TW.ts
  - Removed: (none)
- 新增依賴:
  - market-server: `node-pg-migrate`, `pg`, `minio` (or `@aws-sdk/client-s3`), `@fastify/multipart`
  - src-tauri Cargo: `tar` 已有；新增 `flate2` 已有；可能需要 `multipart` HTTP client (`reqwest` 已支援 multipart feature)
- 跨 change 依賴:
  - 已 archive 的 `local-skill-market-prototype` 提供 `directory_hash` 演算法（Rust），本 change 直接呼叫 `fan_out::directory_hash`
  - 已 archive 的 `market-server-url-settings` 提供 client 端 base URL（`get_market_server_url`），本 change 沿用
- Backward compatibility:
  - Hub UI 程式碼不需改動即可正確顯示「Up to date」；舊安裝（裝過 mock skill）會在 server 切真實後一律顯示 Install/Update，需使用者重新安裝才會「Up to date」（可接受）
- 風險:
  - Migration runner 跟 server boot 綁定，DB 不健康時 server 起不來（已有 `depends_on: postgres healthy` 緩解）
  - MinIO object 從不主動刪除 → 長期會累積孤兒物件，本 change 不解決（lifecycle policy 留給未來）
