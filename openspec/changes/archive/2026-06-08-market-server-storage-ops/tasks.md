## 1. MinIO service account

- [x] 1.1 在 `market-server/docker-compose.yml` 新增 `minio-init` service：使用 `minio/mc` image，depends_on minio healthy，執行 `mc alias set local http://minio:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD && mc admin user svcacct add local $MINIO_ROOT_USER --access-key $MINIO_SERVICE_USER --secret-key $MINIO_SERVICE_PASSWORD && mc admin policy attach local readwrite --user $MINIO_SERVICE_USER`。驗證：`docker compose up minio-init` 成功建立 service account。
- [x] 1.2 修改 `market-server/docker-compose.yml` 的 api service：`MINIO_ACCESS_KEY` 改為 `${MINIO_SERVICE_USER}`、`MINIO_SECRET_KEY` 改為 `${MINIO_SERVICE_PASSWORD}`。驗證：api 用 service account 能正常上傳/下載。
- [x] 1.3 在 `market-server/.env.example` 新增 `MINIO_SERVICE_USER=felina-api` 和 `MINIO_SERVICE_PASSWORD=felina-api-secret`。驗證：`.env.example` 包含新變數。

## 2. 舊物件清除

- [x] 2.1 在 `market-server/src/storage.js` 新增 `deleteObject(key)` 函式：呼叫 MinIO client `removeObject(bucket, key)`。驗證：`npm test` 新增的 storage 測試通過。
- [x] 2.2 修改 `market-server/src/db.js` 的 `upsertSkill`：RETURNING 子句加入 `previous_storage_key`。驗證：upsert 回傳包含 previous_storage_key。
- [x] 2.3 修改 `market-server/src/app.js` 的 PUT handler：upsert 成功後，若 `saved.previous_storage_key` 非 null，呼叫 `storage.deleteObject(saved.previous_storage_key)`，catch error 時 `request.log.warn()`。驗證：`npm test` 新增的清除測試通過。
- [x] 2.4 修改 `market-server/src/app.js` 的 DELETE handler：softDelete 成功後，讀取 skill 的 storage_key（需先 getSkill 或改 softDelete 回傳 storage_key），呼叫 `storage.deleteObject(storageKey)`，catch error 時 `request.log.warn()`。驗證：`npm test` 新增的清除測試通過。

## 3. Bucket policy + Console port + DB 索引

- [x] [P] 3.1 修改 `market-server/src/storage.js` 的 `ensureBucket`：建 bucket 後呼叫 `minioClient.setBucketPolicy(bucket, JSON.stringify(privatePolicyJson))`，policy 拒絕所有匿名 `s3:GetObject`。驗證：`mc anonymous get local/skills/any-key` 被拒絕。
- [x] [P] 3.2 修改 `market-server/docker-compose.yml`：minio service 的 `9001:9001` 改為 `127.0.0.1:9001:9001`。驗證：外部 IP 無法存取 console。
- [x] [P] 3.3 新增 `market-server/migrations/003_skills_indexes.sql`：`CREATE INDEX IF NOT EXISTS idx_skills_updated_at ON skills (updated_at DESC) WHERE deleted_at IS NULL`。驗證：`docker compose up --build` → `\di idx_skills_updated_at` 顯示索引。

## 4. 整合驗證

- [x] 4.1 `npm test`（market-server）全部通過。驗證：CI 等級 test pass。
- [x] 4.2 `docker compose up --build` 正常啟動，minio-init 建立 service account，api 能上傳/下載/刪除。驗證：手動 e2e。
