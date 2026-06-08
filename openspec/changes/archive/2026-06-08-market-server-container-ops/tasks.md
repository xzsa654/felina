## 1. Graceful shutdown

- [x] 1.1 修改 `market-server/src/server.js`：新增 `SIGTERM` 和 `SIGINT` handler，呼叫 `fastify.close()`。加 `SHUTDOWN_TIMEOUT_MS` 環境變數（預設 10000），超時 `process.exit(1)`。驗證：`docker stop market-server-api-1` 時 container log 顯示 "shutting down gracefully"，exit code 0。
- [x] 1.2 在 `market-server/.env.example` 新增 `SHUTDOWN_TIMEOUT_MS=10000`。驗證：`.env.example` 包含新變數。

## 2. DB 連線池配置

- [x] 2.1 修改 `market-server/src/db.js`：`new Pool()` 改為 `new Pool({ max: parseInt(process.env.DB_POOL_MAX, 10) || 20, idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000, connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT, 10) || 5000 })`。驗證：設 `DB_POOL_MAX=5` 啟動正常，`npm test` 通過。
- [x] 2.2 在 `market-server/.env.example` 新增 `DB_POOL_MAX=20`、`DB_POOL_IDLE_TIMEOUT=30000`、`DB_POOL_CONNECTION_TIMEOUT=5000`。驗證：`.env.example` 包含新變數。

## 3. Migration 拆離

- [x] 3.1 新增 `market-server/src/migrate.js`：讀 `DATABASE_URL` 環境變數建立 Pool，建立 `schema_migrations` table（IF NOT EXISTS，欄位 name TEXT PK, applied_at TIMESTAMPTZ DEFAULT now()），讀 `migrations/` 目錄下所有 `.sql` 檔按名稱排序，跳過已在 `schema_migrations` 記錄的，執行未跑的 migration 並 INSERT 記錄，完成後關閉 pool。驗證：`node src/migrate.js` 首次跑完建立 schema_migrations + 執行所有 migration，再跑一次不重複執行。
- [x] 3.2 修改 `market-server/src/server.js`：移除啟動時的 migration 呼叫（目前的 `runMigrations` 或類似函式）。驗證：`node src/server.js` 啟動時不跑 migration。
- [x] 3.3 修改 `market-server/docker-compose.yml`：api service 的 command 改為 `sh -c "node src/migrate.js && node src/server.js"`，或用 entrypoint script。驗證：`docker compose down -v && docker compose up --build` migration 正常跑、API 正常啟動。

## 4. 整合驗證

- [x] 4.1 `npm test`（market-server）全部通過。驗證：CI 等級 test pass。
- [x] 4.2 `docker compose up --build` 確認正常啟動，migration 在 API 前跑完。驗證：手動確認。
