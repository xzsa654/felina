## Context

market-server 使用 MinIO 存 skill tarball、PostgreSQL 存 metadata。目前 MinIO 以 root 帳號操作、upsert 時舊物件不刪除持續累積、bucket 無明確 policy、console port 對外暴露、skills 表缺索引。

## Goals / Non-Goals

**Goals:**

- MinIO 操作改用最小權限 service account
- Upsert 和 soft delete 時清除舊 MinIO 物件
- Bucket 明確設為私有
- Console port 限 localhost
- 加 updated_at 索引提升列表查詢效能

**Non-Goals:**

- 遷移到 S3（保持 MinIO）
- Object versioning
- 資料庫備份排程（運維層面）

## Decisions

### D1: MinIO service account

docker-compose 新增 init service（`minio-init`），啟動後用 `mc` CLI 建立 service account 並設定 policy 僅允許 skills bucket 的 `s3:GetObject`、`s3:PutObject`、`s3:DeleteObject`、`s3:ListBucket`。api service 改用 service account credentials。

`.env.example` 新增 `MINIO_SERVICE_USER` 和 `MINIO_SERVICE_PASSWORD`。

### D2: 舊物件清除

`app.js` 的 PUT handler：upsert 成功後，若回傳的 `previous_storage_key` 非 null，呼叫 `storage.deleteObject(previousStorageKey)`。失敗時 log warning 但不影響回應。

`app.js` 的 DELETE handler（soft delete）：softDelete 成功後，讀取 skill 的 `storage_key`，呼叫 `storage.deleteObject(storageKey)`。同上失敗不影響回應。

`storage.js` 新增 `deleteObject(key)` 函式。

### D3: Bucket policy

`storage.js` 的 `ensureBucket`：建 bucket 後設定 policy 為 private（拒絕匿名讀取）。MinIO 預設是 private，但明確設定 policy JSON 以防意外。

### D4: Console port 限 localhost

`docker-compose.yml` 的 minio service 的 9001 port mapping 改為 `127.0.0.1:9001:9001`。

### D5: DB 索引

新增 `migrations/003_skills_indexes.sql`（或下一個可用編號）：
- `CREATE INDEX CONCURRENTLY idx_skills_updated_at ON skills (updated_at DESC) WHERE deleted_at IS NULL`

Partial index 配合列表查詢的 `WHERE deleted_at IS NULL ORDER BY updated_at DESC`。

### Scope Boundaries

**In scope:** market-server/ 的 storage.js、app.js、db.js、docker-compose.yml、.env.example、migrations
**Out of scope:** Felina client 端不需改動

## Implementation Contract

### Task 群組 1: MinIO service account
- docker-compose 加 minio-init service
- .env.example 加 service account credentials
- api service 改用 service account
- 驗證目標：`docker compose up --build` api 用 service account 能正常上傳/下載

### Task 群組 2: 舊物件清除
- storage.js 加 deleteObject
- app.js PUT/DELETE handler 加清除邏輯
- 驗證目標：upsert 後舊物件被刪、soft delete 後物件被刪

### Task 群組 3: Bucket policy + Console port + DB 索引
- storage.js ensureBucket 後設 policy
- docker-compose 9001 限 localhost
- migration 加索引
- 驗證目標：bucket policy 為 private、console 只有 localhost 能存取、索引存在
