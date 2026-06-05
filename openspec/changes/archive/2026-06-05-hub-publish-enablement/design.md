## Context

market-server 目前是 hardcoded mock：`market-server/src/server.js` 把 `SKILLS` 寫死成 3 個 entry，`contentHash` 是 `mock-hash-<name>-<version>` 假字串，`GET /api/skills/:id/download` 即時用 `tar-stream` 拼一份只含 SKILL.md 的 tar.gz 回傳，**沒有任何持久化儲存**。`docker-compose.yml` 雖然已聲明 Postgres 16 + MinIO 兩個 service 並注入 `DATABASE_URL`、`MINIO_ENDPOINT` 環境變數，但 server.js 沒 import `pg` 或 minio client。

Client 端：`local-skill-market-prototype` archive 後已建立 `directory_hash` 演算法（`src-tauri/src/commands/fan_out/mod.rs:483`）作為 Felina 核心 invariant，用於 fan-out drift detection；market install 路徑借用此 hash 寫進 installed skill 的 `.felina-sync-meta.json`。`market-server-url-settings` archive 後已提供 `get_market_server_url` Tauri command 讓 client 從 Settings 讀 server base URL。

Stakeholders：Felina 桌面 app 使用者（內網同公司同事，幾十人規模），他們既是 publisher 也是 installer。

## Goals / Non-Goals

**Goals:**

- market-server 從 mock 演進為真實 storage：Postgres 存 metadata、MinIO 存 tar.gz blob。
- Schema 與 migration runner 從 day 1 就到位，未來欄位演進不會卡在 init.sql 改不動。
- 開出 `PUT /api/skills/:name`（覆蓋上傳）與 `DELETE /api/skills/:name`（soft delete）endpoint。
- Felina app 新增 `publish_canonical_skill` Tauri command，能把 canonical skill 打包並上架。
- 已 archive 的 Installed State Display UI 邏輯在本 change 完工後自動正確（contentHash 從假字串變真實值）。

**Non-Goals:**

- 不做身分驗證、authz、`X-Author` header、owner check、admin allowlist、SSO。Anonymous publish/delete 完全開放（內網信任模型）。
- 不做 install 前的 update 確認 dialog、uninstall 按鈕、toast 通知。
- 不做 channel / draft / stable、yank / restore endpoint、audit log table、semver 驗證、`UNIQUE(name, version)` 強制 bump。
- 不在 schema 留 `hash_algo` / `hash_version` 欄位（預設 SHA-256 寫死）。
- 不做 publish UI 最終位置定案、不做 search、不做詳細頁、不做 SKILL.md 預覽。
- 不主動清理 MinIO 孤兒物件（`previous_storage_key` 累積，未來 lifecycle policy 處理）。
- 不做 admin restore endpoint（誤刪用 psql 直接 UPDATE skills SET deleted_at = NULL）。

## Decisions

### Postgres + MinIO 接線：metadata 與 blob 職責分離

`skills` 表存 metadata（name PK、version、description、hash、storage key、timestamps、soft-delete flag）；MinIO bucket `skills` 存實際 tar.gz binary，object key 為 `<name>/<uuid>.tar.gz`。理由：Postgres 不該存 blob（查詢慢、備份大、stream 困難），MinIO 不該存可查詢 metadata（沒 index、沒 transaction）。

**Alternative considered**：純 filesystem mount（不用 MinIO）。否決理由：docker-compose 已備 MinIO，重新走 filesystem 反而是回退；MinIO 給未來 multi-region replicate 留路。

### Schema 一張表，無 channel / authz / audit log

`skills` 表只有 9 個欄位：`name TEXT PK, version TEXT, description TEXT, content_hash TEXT, tarball_hash TEXT, storage_key TEXT, previous_storage_key TEXT, updated_at TIMESTAMPTZ, deleted_at TIMESTAMPTZ`。理由：公司內網信任場景，幾十人規模，不需要 npm/cargo 級別的供應鏈防護；audit/authz/channel 留給後續 change 在需要時加（schema migration 加欄位代價極小）。

**Alternative considered**：直接放 `author`、`updated_by`、`updated_ip` 欄位。否決理由：與 `hub-install-safety-and-author-attribution` change 拆分後，這些欄位該跟 X-Author header + Settings override + git config flow 一起做才有 UI 出口；本 change 不做。Schema 用 `ALTER TABLE ADD COLUMN nullable` 補上即可，無 backfill 成本。

### Hash 機制：content_hash opaque 由 client 算，tarball_hash 由 server 自算

`content_hash` 是 Felina 核心 invariant（語義 hash，定義「兩個 skill dir 在語義上是否相同」），由 Rust `directory_hash()` 在 client 端算，PUT 時用 `X-Content-Hash` header 帶上來，server 當 opaque 字串存。`tarball_hash` 是 server 收到 tar.gz bytes 後自算的 SHA-256，存進 DB 給 MinIO 完整性 / 去重 / 審計參考。

**Alternative considered**：server 也算 content_hash（在 Node 重寫 directory_hash 演算法）。否決理由：把 Rust-only invariant 拉成跨語言契約，未來 Rust 改正規化規則 Node 漏同步會分裂；server 永遠不需要懂 SKILL.md / YAML / sibling 排序。

**Alternative considered**：只算一種 hash。否決理由：`content_hash` 是語義 hash（不同 tar.gz packaging 同 skill 內容應一樣），`tarball_hash` 是 bytes hash（同 packaging 同內容 bytes-for-bytes 才一樣）。兩者職責不同。

### Migration runner 用 node-pg-migrate

market-server boot 時跑 `node-pg-migrate up`，schema 變更寫成編號 migration 檔（如 `001_init.sql`）。理由：schema 一定會演進（至少下個 change 就要加 author 三欄），mount 進 docker-entrypoint-initdb.d 只在 postgres data dir 第一次 init 時跑，第二次改 schema 要砍 volume 重來——對小團隊內網部署不可接受。

**Alternative considered**：Prisma / Drizzle。否決理由：對「HTTP + 檔案搬運 + 簡單 query」過頭；server.js 不需要 ORM type-safety 帶來的整體重寫成本。

### 覆蓋同 name 而非 UNIQUE(name, version) 強制 bump

`PUT /api/skills/:name` 直接覆蓋同 name 紀錄；舊 `storage_key` 搬到 `previous_storage_key`、MinIO 物件**不**刪。理由：使用者 = 同公司同事，「我改了忘記 bump version」是日常，強制 bump 是 prototype 噪音；保留 `previous_storage_key` 讓誤覆蓋有救火空間（dba 手動 UPDATE 回去即可）。

**Alternative considered**：`UNIQUE(name, version)` 鎖死。否決理由：對「公開 registry」場景合理，但這不是 npm。

### Publish 排除 `.felina-sync-meta.json`

Tar.gz 打包時主動過濾任何深度的 `.felina-sync-meta.json`。理由：sync-meta 內含 publisher 本機的 target list、project 路徑、sync timestamp 等 publisher-local metadata，若隨 tar.gz 流到 server 再下載到 installer，會洩漏發佈者的本機環境、且讓 installer 安裝後的 sync-meta 處於不一致狀態。`directory_hash` 已將 sync-meta 排除在語意 hash 之外，packaging 也必須對齊。

### 伺服器解 tar 取 frontmatter

PUT 端 server 必須解 tar 取 `<name>/SKILL.md` 的 YAML frontmatter，從中讀 `version`、`description` 寫入 DB；缺欄位存 NULL，非 reject。理由：(a) `version` 與 `description` 是 Hub UI 渲染必要欄位；(b) 從 frontmatter 取得意味著只有「canonical skill 本身改了 frontmatter」才會反映，避免 client 隨意覆寫 metadata；(c) NULL fallback 容忍真實情況下作者尚未填欄位的 skill。

**Alternative considered**：要 client 額外送 multipart 欄位帶 metadata。否決理由：兩個來源（tar.gz 內 vs 額外 field）會分歧，frontmatter 才是 source of truth。

### Skill identifier 統一為 name，不留 id 欄位

`GET /api/skills` 不回 `id` 欄位；Hub 前端 `MarketSkill` 介面、React keys、`installStatus` map、install 命令參數一律用 `name`。`install_market_skill(id: String)` 重新命名為 `install_market_skill(name: String)`。理由：DB schema 用 `name` 為 PK，已是唯一識別；保留 `id` 只是源自 mock 時代的 hardcoded 數字 id，現在沒有必要再造第二把識別子。

**Alternative considered**：server 同時回 `id` (= name) 與 `name` 維持 Hub 不改。否決理由：兩欄位重複 + 假鍵會誤導未來 client，遲早要清掉，現在做。

### 名稱驗證與 URL encoding

所有 name 參數（publish_canonical_skill、delete_market_skill、install_market_skill、server `:name` segment）在進入 fs / DB / URL 前必須通過 canonical skill identifier ruleset 驗證（ASCII alphanumeric + `-_.`，非空）。client 端組 URL 時對 name 做 percent-encoding。Server 端 path param 解析後同樣驗證。理由：name 同時作為 MinIO object key、檔系 path 段、URL path segment，三處都怕 traversal 與特殊字元；單一 ruleset 全域守住。

**Alternative considered**：只在 server 端驗。否決理由：client 端不驗就會把惡意 name 變成 reqwest URL 組裝錯誤或 fs 路徑錯誤，錯誤訊息會更難 trace。

### DELETE 完全開放 + soft delete

`DELETE /api/skills/:name` 不檢查身分，標 `deleted_at = now()`，MinIO 物件保留。`GET /api/skills` filter `WHERE deleted_at IS NULL`。理由：內網沒有惡作劇 delete 的威脅模型；誤刪救火 = UPDATE skills SET deleted_at = NULL WHERE name = ...。

## Implementation Contract

**對 Felina app（client）端的觀察行為**

1. **新增 Tauri command `publish_canonical_skill(name: String) -> Result<(), String>`**
   - 先用既有 `validate_skill_id`（或抽出至共用 helper）驗證 `name` 為 ASCII alphanumeric + `-_.`，空字串／非法字元立刻 Err，**不碰 fs/network**。
   - 讀 `~/.felina/skills/<name>/` 目錄。如目錄不存在或無 SKILL.md，回傳 Err 字串。
   - 用既有 `fan_out::directory_hash(skill_dir)` 算 content_hash。
   - 用 `tar` + `flate2` 將整個 skill dir 打包成記憶體中的 tar.gz bytes，**過濾掉任何 `.felina-sync-meta.json`**（任何深度）以避免 publisher-local target metadata 外洩。
   - 從 `get_market_server_url()` 取 base URL，對 `name` segment 做 URL encoding。
   - 發 `PUT {baseUrl}/api/skills/{encodedName}` multipart request：body 含 tar.gz binary（field name `package`）、`X-Content-Hash: <directory_hash>` header。
   - 2xx 視為成功，回傳 Ok(())；其他 status 回傳 Err 含 status code 與 server 回的 error message。
2. **新增 Tauri command `delete_market_skill(name: String) -> Result<(), String>`**
   - 同樣先 validate name + URL encode。發 `DELETE {baseUrl}/api/skills/{encodedName}`。2xx 或 404 視為成功。
3. **改寫既有 `install_market_skill`：參數語意從 `id` 改為 `name`**
   - Rust 函式 signature 從 `install_market_skill(id: String)` 改為 `install_market_skill(name: String)`；驗證、URL 組裝、解 tar 後 sync-meta 寫入皆改用 name。前端 `api.market.installSkill` 從 `(id: string)` 改為 `(name: string)`，呼叫端帶 `{ name }`。
   - URL `${base}/api/skills/{encodedName}/download`，name 經 URL encoding。
4. **Frontend Hub 頁面 MarketSkill 介面與 install 鏈結改為 name-keyed**
   - `interface MarketSkill` 移除 `id` 欄位（伺服器不再回傳）。React keys、`installStatus` map、`upToDateIds` set 改以 `name` 為 key。`handleInstall(skill)` 改傳 `skill.name`。
   - Publish 入口（位置最終由下個 change 決定，本 change 用最小可動 UI）：一個 button，點擊跳出選 canonical skill 的 dropdown（從 `api.canonicalSkills.list()` 取），選定後呼叫 `api.market.publishSkill(name)`，顯示成功/失敗訊息。
5. **行為自動正確**：本 change 完工後，Installed State Display 的「Up to date」狀態會在 server 真實 hash 與 local hash 相符時正確顯示（hash 比對邏輯既存，鍵改為 name）。

**對 market-server 的觀察行為**

1. **`GET /api/skills` 回應 shape**：JSON array of `{ name, version, description, contentHash, updatedAt }`。filter `deleted_at IS NULL`。當 DB 空時回 `[]`。
2. **`GET /api/skills/:name/download` 回應**：stream tar.gz binary，`content-type: application/gzip`，`content-disposition: attachment; filename="<name>.tar.gz"`。已 soft-delete 的紀錄回 410 Gone。不存在回 404。
3. **`PUT /api/skills/:name` 行為**：
   - 先驗證 `:name` 是否為 ASCII alphanumeric + `-_.` 且非空，否則回 400。
   - 接收 multipart body，欄位 `package` 為 tar.gz。
   - 從 header 取 `X-Content-Hash`，存進 content_hash。空字串或 missing 回 400。
   - 算 `tarball_hash = SHA-256(整個 tar.gz bytes)`。
   - **解 tar 並讀取 `<name>/SKILL.md` 的 YAML frontmatter，擷取 `version` 與 `description` 字串欄位**；缺欄位或空字串時對應欄位存 NULL（不 reject）。tar 中無 `<name>/SKILL.md` 回 400。
   - MinIO `putObject('<name>/<uuid>.tar.gz', bytes)`。
   - Postgres upsert：以 name 為衝突鍵，更新 version、description、content_hash、tarball_hash，把舊 storage_key 搬到 previous_storage_key、storage_key 設為新值、updated_at 更新、deleted_at 清空。
   - 回 200，body 含 `{ name, contentHash, tarballHash, storageKey, updatedAt }`。
4. **`DELETE /api/skills/:name`**：將該 name 的 deleted_at 設為 now()。原本未刪 → 204；原本已 soft-deleted → 204；不存在 → 404。
5. **Migration runner**：server boot 時跑 `node-pg-migrate up`，跑完才 `fastify.listen`。失敗則 exit non-zero。
6. **MinIO bucket ensure**：boot 時若 bucket `skills` 不存在則 `makeBucket`。
7. **Hardcoded `SKILLS` array 移除**：server.js 不再包含任何 fixture skill。

**Acceptance criteria**

- `docker compose up` 後 Postgres 內可看到 `skills` table 與 `pgmigrations` 一筆 `001_init` 紀錄。
- `curl http://localhost:3100/api/skills` 回 `[]`（空 DB）。
- 從 Felina app `publish_canonical_skill("some-existing-skill")` 後，list 回該 skill 一筆，contentHash = local `.felina-sync-meta.json` 的 directoryHash。
- 再 publish 一次（改了 SKILL.md 內容），DB previous_storage_key 不為 NULL、storage_key 變新值、content_hash 變新值、updated_at 更新。
- `delete_market_skill("some-existing-skill")` 後 list 不再回該 skill；SELECT 仍有紀錄但 deleted_at 非 NULL。
- 重啟 server，DB 與 MinIO 內容保留。

**Scope boundaries**

- In scope：server 接線、schema/migration、PUT/DELETE endpoint、client publish command、移除 mock SKILLS。
- Out of scope：authz / `X-Author` / git config 流程、install 確認 dialog、uninstall 按鈕、search、詳細頁、SKILL.md 預覽、publish UI 最終位置、MinIO lifecycle、admin restore endpoint、SSO、channel、yank、audit log table、semver 驗證。

## Risks / Trade-offs

- **Migration runner 跟 server boot 綁定** → server 啟動慢一點點（migrate 跑完才 listen）；Postgres 不健康 server 起不來。Mitigation：保留既有 `depends_on: postgres.condition: service_healthy`，並讓 migrate 失敗時 exit non-zero（fail loud）。
- **MinIO object 從不主動刪除** → 長期累積孤兒 previous_storage_key。Mitigation：本 change 不處理；未來 lifecycle policy 在獨立 change 上。
- **無 authz** → 任何能連 server 的 client 都可 publish/delete。Mitigation：本 change 接受此風險（Non-Goal）；下個 change 加 X-Author 後仍是 attribution-only，正式 authz 是 SSO 階段才上。
- **`gen_random_uuid()` 需要 pgcrypto extension** → migration 第一行未啟用會炸。Mitigation：001_init.sql 第一行啟用 pgcrypto extension。
- **舊安裝（mock 時代）的 directoryHash 對不上新 server 的真實 hash** → 使用者重啟 Felina 後 Hub 一律顯示 Install 直到該 skill 在新 server 上重新 publish。Mitigation：可接受（prototype → 正式的自然斷層）。
- **`X-Content-Hash` header 可偽造** → 內網信任場景接受；威脅模型升級時改用 OAuth / SSO 驗證 client 身分（後續 change）。
- **同 name 覆蓋無提示** → 使用者若不小心 PUT 蓋掉同事的 skill，當下沒人發現。Mitigation：本 change 接受（previous_storage_key 給救火空間）；下個 change 的 install confirm dialog 與 attribution 會緩解。

## Migration Plan

1. 部署順序：先 build 新 market-server image，再重啟 api container；Postgres + MinIO container 不重啟（保留資料 volume）。
2. Postgres 第一次 init 時 docker entrypoint 已建 market_db；node-pg-migrate 在 server boot 時建 skills 與 pgmigrations 表。
3. MinIO bucket skills 在 server boot 時 ensure。
4. 既有「mock 時代」的 docker volume 可保留（資料庫本來就空）。
5. Felina app 端：本 change 只新增 command，不改既有 Hub install/list 行為，使用者升級無感。
6. Rollback strategy：本 change 無破壞性 schema 變更（第一次建表），rollback = revert market-server commit 並重啟 api container；DB schema 可保留（下次部署再用）。Client 端 rollback = revert Felina 版本，publish 相關 command 消失，其他行為不變。

## Open Questions

- MinIO client library 選 `minio` (社群 SDK) 還 `@aws-sdk/client-s3`？兩者皆可用 MinIO 的 S3 兼容介面，前者 API 較簡單、後者較通用。傾向 `minio`，但留給 apply 階段最終定。
- Migration 檔副檔名 `.sql` vs `.js`？傾向 `.sql`（schema 簡單，無需條件邏輯），但 `node-pg-migrate` 預設是 `.js`，要在 config 指定 migrationFileExtension。留給 apply 階段。
- Felina app 端 publish UI 最小入口放哪？傾向 Hub 頁面右上 floating button「Publish Skill」+ dropdown 選 canonical，避免動 Skill editor。最終位置由 `hub-discoverability` change 收。
