## 1. 專案基線

- [x] 1.1 執行 `npm run check` 與 `cd src-tauri && cargo build --quiet`，記錄現有 warnings／errors 作基線。同時 `cd market-server && npm install` 確認既有 deps 可安裝。

## 2. market-server 依賴與 docker-compose

- [x] 2.1 在 `market-server/package.json` 加入 dependencies：`pg`、`node-pg-migrate`、`minio`、`@fastify/multipart`，實作 Decision: Migration runner 用 node-pg-migrate 所需基礎依賴。執行 `npm install` 確認鎖檔更新。驗證：`node -e "require('pg');require('node-pg-migrate');require('minio');require('@fastify/multipart')"` 無錯。
- [x] 2.2 在 `market-server/Dockerfile` 確保 `RUN npm ci --production` 涵蓋新 deps；如有 migration 檔（`.sql`）需 COPY 進 image：`COPY migrations/ ./migrations/`。
- [x] 2.3 在 `market-server/docker-compose.yml` 為 api service 補上 `MINIO_BUCKET=skills` 環境變數（其餘 endpoint / credentials 已存在）。
- [x] 2.4 `docker compose up --build` 確認三個 service 都 healthy；docker logs api 不出現 missing module 錯誤。

## 3. Schema 與 Schema Migration Runner

- [x] 3.1 建立 `market-server/migrations/001_init.sql` 滿足 Requirement: Market Server Persistent Storage、實作 Decision: Postgres + MinIO 接線：metadata 與 blob 職責分離 與 Decision: Schema 一張表，無 channel / authz / audit log。第一行 `CREATE EXTENSION IF NOT EXISTS pgcrypto;`；建立 `skills` 表（name TEXT PRIMARY KEY、version TEXT、description TEXT、content_hash TEXT NOT NULL、tarball_hash TEXT NOT NULL、storage_key TEXT NOT NULL、previous_storage_key TEXT、updated_at TIMESTAMPTZ NOT NULL DEFAULT now()、deleted_at TIMESTAMPTZ）；建立 partial index `CREATE INDEX skills_live ON skills (name) WHERE deleted_at IS NULL;`。
- [x] 3.2 在 `market-server` 根目錄新增 `.pgmigraterc.json`（或在 package.json 內加 `node-pg-migrate` config）指定 `migrations-dir: migrations`、`migration-file-extension: sql`、`migrations-table: pgmigrations`。
- [x] 3.3 在 `market-server/src/server.js` boot 階段（`fastify.listen` 之前）呼叫 node-pg-migrate runner，實作 Requirement: Schema Migration Runner：失敗 throw 直接讓 process 退出非 0。
- [x] 3.4 `docker compose down -v && docker compose up --build` → docker logs api 顯示 migration `001_init` 套用；`docker exec postgres psql -U market -d market_db -c "\d skills"` 顯示完整欄位；`SELECT * FROM pgmigrations;` 有一筆紀錄。

## 4. Storage adapter（MinIO Bucket Provisioning）

- [x] 4.1 新增 `market-server/src/storage.js` 滿足 Requirement: MinIO Bucket Provisioning：export `ensureBucket()`、`putObject(key, buffer)`、`getObjectStream(key)`、`deleteObject(key)`（最後一個本 change 不使用，但 export 留接口）。使用 `minio` lib，從 env 讀取 endpoint / accessKey / secretKey / bucket。
- [x] 4.2 在 `server.js` boot 階段 await `ensureBucket()`，若 bucket 不存在 makeBucket。
- [x] 4.3 重啟 server 後 `docker exec minio mc ls myminio/skills`（或從 MinIO console http://localhost:9001 觀察）確認 bucket 存在。

## 5. DB adapter

- [x] 5.1 新增 `market-server/src/db.js`：export 共用 `pg.Pool`（從 `DATABASE_URL`）以及高階 query helper：`listSkills()`（filter deleted_at IS NULL，select 必要欄位）、`getSkill(name)`、`upsertSkill({...})`（原子 SQL，覆蓋時把舊 storage_key 搬到 previous_storage_key、清空 deleted_at — 實作 Decision: 覆蓋同 name 而非 UNIQUE(name, version) 強制 bump）、`softDeleteSkill(name)` 回傳 enum 結果（updated／already_deleted／not_found）— 實作 Decision: DELETE 完全開放 + soft delete。
- [x] 5.2 加入 `db.js` 的單元測試（或最小 smoke：寫一段 `node scripts/db-smoke.js` 直接呼叫 helper），覆蓋 upsert 新增、upsert 覆蓋、softDelete 三個 affected count 分支。

## 6. Fastify endpoints 重寫（Skill Registry API endpoints / Skill Package Upload / Skill Soft Delete）

- [x] 6.1 在 `market-server/src/server.js` 移除 hardcoded `SKILLS` array 與 `tar-stream` 即時拼包邏輯。註冊 `@fastify/multipart` plugin（limits 設 50 MB）。本 task 啟動 Requirement: Skill Registry API endpoints 的重寫。
- [x] 6.2 改寫 `GET /api/skills` 呼叫 `db.listSkills()`，回傳 `{ name, version, description, contentHash, updatedAt }` array。
- [x] 6.3 改寫 `GET /api/skills/:name/download`：查 `db.getSkill(name)`，soft-deleted → 410、not found → 404，否則 `storage.getObjectStream(storage_key)` pipe 回 reply，設 `content-type: application/gzip`、`content-disposition: attachment; filename="<name>.tar.gz"`。
- [x] 6.4 新增 `PUT /api/skills/:name` 滿足 Requirement: Skill Package Upload，並實作 Decision: Hash 機制：content_hash opaque 由 client 算，tarball_hash 由 server 自算、Decision: 伺服器解 tar 取 frontmatter、Decision: 名稱驗證與 URL encoding：先驗 `:name` 是否符合 ASCII alphanumeric + `-_.`（非空，無 `..`），否則 400；從 `request.file()` 讀 `package` field，buffer；從 `request.headers['x-content-hash']` 取 hash，空或缺回 400；算 `tarball_hash = SHA-256(buffer)`；解 tar.gz（用 `tar-stream` 或 `tar`）取出 `<name>/SKILL.md`（缺則 400），parse YAML frontmatter（用 `js-yaml`），讀 `version`、`description`（缺欄位／空字串存 NULL）；產生 `storageKey = ${name}/${randomUUID()}.tar.gz`；`storage.putObject(storageKey, buffer)`；`db.upsertSkill({...})`；回 200 JSON。
- [x] 6.5 新增 `DELETE /api/skills/:name` 滿足 Requirement: Skill Soft Delete：同樣驗 name；呼叫 `db.softDeleteSkill(name)`，按返回 enum 回 204 或 404。
- [x] 6.7 在 `market-server/package.json` 加 `js-yaml`、`tar-stream`（如未存在）作為 frontmatter 解析依賴。
- [x] 6.6 `docker compose up` 後完整端對端 curl 驗證：

## 7. Felina Rust 端 publish command

- [x] 7.1 新增 `src-tauri/src/commands/market_publish.rs` 滿足 Requirement: Publish Canonical Skill Command 與 Decision: Publish 排除 `.felina-sync-meta.json`、Decision: 名稱驗證與 URL encoding：實作 `publish_canonical_skill(name: String) -> Result<(), String>`。先呼叫 name 驗證（共用 helper，從現有 `market_install::validate_skill_id` 抽出至 `commands/skill_name.rs` 之類的共用 module），非法立刻 Err；讀 `paths::felina_global_skills_dir().join(&name)`，檢查目錄存在且含 SKILL.md；呼叫 `crate::commands::fan_out::directory_hash(&dir)` 取 content_hash（None → Err）；用 `tar::Builder` + `flate2::write::GzEncoder` 打包整個 dir 成 `Vec<u8>`（保持相對路徑，root 為 `<name>/`），**walk 過程中 skip 任何 entry name 為 `.felina-sync-meta.json` 的檔案**；呼叫 `super::market_server::get_market_server_url()?` 取 base，對 name segment 做 `percent_encoding` URL encode；使用 `reqwest::multipart::Form` PUT，附 `X-Content-Hash` header。2xx → Ok；其他帶 status + body 回 Err。
- [x] 7.2 在同檔新增 `delete_market_skill(name: String) -> Result<(), String>` 滿足 Requirement: Delete Market Skill Command 與 Decision: 名稱驗證與 URL encoding：先驗證 name；URL encode name segment；reqwest DELETE，2xx／404 → Ok，其他 → Err。
- [x] 7.7 修改既有 `src-tauri/src/commands/market_install.rs` 滿足 Decision: Skill identifier 統一為 name，不留 id 欄位：函式 signature 從 `install_market_skill(id: String)` 改為 `install_market_skill(name: String)`，函式內所有 `id` 引用改為 `name`；URL 從 `format!("{base}/api/skills/{id}/download")` 改為 `format!("{base}/api/skills/{encoded_name}/download", encoded_name = percent_encode(&name))`；`validate_skill_id` rename 為 `validate_skill_name` 並抽到共用 module 供 publish/delete 復用。註冊不變（command name 與 invoke name 維持 `install_market_skill`）。
- [x] 7.3 確認 `src-tauri/Cargo.toml` 的 `reqwest` features 包含 `multipart`、`stream`（若缺則加；既有應有 `json`）。
- [x] 7.4 在 `src-tauri/src/commands/mod.rs` 加 `pub mod market_publish;`；`src-tauri/src/lib.rs` 的 `invoke_handler!` 註冊 `commands::market_publish::publish_canonical_skill` 與 `commands::market_publish::delete_market_skill`。
- [x] 7.5 `cd src-tauri && cargo build --quiet` 通過。
- [x] 7.6 撰寫 Rust 單元測試（在 `market_publish.rs` 下 `#[cfg(test)] mod tests`）：用 `set_felina_home_override_for_test` 建臨時 canonical skill；mock server 用 `wiremock` 或最小 `tokio` HTTP listener 驗證 PUT 真的帶了正確 body／header；測試覆蓋「skill 不存在」與「server 回 5xx」兩條 Err 分支。

## 8. Frontend wrapper

- [x] 8.1 在 `src/lib/tauri/commands.ts` 的 `api.market` 物件加 `publishSkill: (name: string) => invoke<void>("publish_canonical_skill", { name })` 與 `deleteSkill: (name: string) => invoke<void>("delete_market_skill", { name })`。
- [x] 8.2 修改 `api.market.installSkill` 的 signature 從 `(id: string)` 改為 `(name: string)`，invoke payload 從 `{ id }` 改為 `{ name }`，滿足 Decision: Skill identifier 統一為 name，不留 id 欄位。
- [x] 8.3 `npm run check` 通過。

## 9. Hub publish 最小 UI 入口（Hub Publish Entry Point）

- [x] 9.0 重構 `src/lib/components/hub/HubPage.tsx` 滿足 Requirement: Hub UI Presentation 與 Installed State Display（MODIFIED）：`interface MarketSkill` 移除 `id` 欄位；所有 React `key={...}` 從 `skill.id` 改為 `skill.name`；`installStatus` 與 `installing` state map 改以 name 為 key（rename 為易讀但鍵改即可）；`upToDateIds` set 內容從 id 改為 name；`handleInstall(skill)` 改傳 `skill.name` 給 `api.market.installSkill`。確認 `localNames` 與 `upToDateIds` 比對邏輯仍正確。
- [x] 9.1 在 `src/lib/components/hub/HubPage.tsx` 加 PublishButton 元件滿足 Requirement: Hub Publish Entry Point：右上 floating button（位置最終由 hub-discoverability change 收）；點擊跳簡單 dialog（`createPortal` 渲染到 body），dialog 內列出 `api.canonicalSkills.list()` 結果讓使用者選一個 skill，按 Publish 呼叫 `api.market.publishSkill(name)`，成功 toast / banner、失敗顯示錯誤訊息。
- [x] 9.2 publish 完成後 refetch `api.market` list（沿用既有 `fetchSkills`）讓新 skill 立即顯示。
- [x] 9.3 為 PublishButton／Publish dialog 新增 i18n keys 至 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts`（namespace `hub.publish.*`），涵蓋 button label、dialog title、empty state、success、failure。涵蓋「Publishing when no canonical skills exist」scenario 的 empty state。
- [x] 9.4 `npm run check` 通過。

## 10. 端對端驗證

- [x] 10.1 `docker compose up --build` 起 server。
- [x] 10.2 `npm run tauri dev` 起 Felina app。確認本機已有至少一個 canonical skill。
- [x] 10.3 在 Hub 頁面點 Publish → 選 test-pub → Publish。觀察 success 訊息。
- [x] 10.4 重新整理 Hub。test-pub 出現在列表，狀態為「Up to date」（content_hash 等於 local directoryHash）。
- [x] 10.5 編輯 `~/.felina/skills/test-pub/SKILL.md`，重新整理 Hub → 狀態變回 Install。
- [x] 10.6 從 server side 確認：`docker exec postgres psql -U market -d market_db -c "SELECT name, content_hash, previous_storage_key FROM skills"` 顯示一筆紀錄；再 publish 一次後 previous_storage_key 非 NULL。
- [x] 10.7 從 MinIO console 觀察 bucket `skills/test-pub/<uuid>.tar.gz` 物件存在。
- [x] 10.8 重啟 server (`docker compose restart api`) 後資料保留：Hub 列表與內容不變。

## 11. 文件與 i18n

- [x] 11.1 確認所有新增 UI 字串使用 `t(locale, key, params?)`，無 hardcoded 顯示字串。
- [x] 11.2 `market-server/README.md`（若無則新增）記錄：env vars、docker-compose 用法、migration 怎麼新增（下一支 `002_*.sql`）、MinIO bucket 命名約定。
