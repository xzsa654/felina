## Summary

MinIO 與 PostgreSQL 運維加固：最小權限 service account、孤兒物件清除、bucket policy、console port 限制、DB 索引。

## Motivation

MinIO 目前以 root 帳號操作且無 bucket policy，孤兒物件持續累積（upsert 時舊 storage_key 存入 previous_storage_key 但從不刪除舊物件），console port 9001 對外暴露，skills 表 `updated_at` 缺索引影響列表查詢效能。

## Proposed Solution

1. **MinIO 最小權限**：建立 service account，只有 skills bucket 的 read/write/delete 權限。docker-compose 改用 service account credentials
2. **孤兒物件清除**：upsert 成功後，若 `previous_storage_key` 非 null 則刪除舊 MinIO 物件。soft delete 時也清除對應物件
3. **Bucket policy**：確保 bucket 為私有，明確拒絕匿名讀取
4. **Console port**：docker-compose 的 9001 port mapping 改為 `127.0.0.1:9001:9001`
5. **DB 索引**：`skills` 表加 `updated_at DESC` 索引（配合 `deleted_at IS NULL` partial index）
6. **MinIO lifecycle**：設定 lifecycle rule，7 天後自動清除 incomplete multipart uploads

## Non-Goals

- 資料庫備份（運維排程，不在程式碼 change）
- S3 相容儲存遷移（保持 MinIO）
- Object versioning（不需要）

## Capabilities

### Modified Capabilities

- `market-server-storage`: 加物件清除、bucket policy
- `market-server-publish`: upsert 後清除舊物件

## Impact

- Affected specs: `market-server-storage`（modified）、`market-server-publish`（modified）
- Affected code:
  - Modified: `market-server/src/db.js`、`market-server/src/storage.js`、`market-server/src/app.js`、`market-server/docker-compose.yml`、`market-server/.env.example`
  - New: `market-server/migrations/003_skills_indexes.sql`（若 auth-lifecycle 不先建 003 的話）
  - Removed: (none)
