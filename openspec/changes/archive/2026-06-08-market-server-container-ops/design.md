## Context

market-server 在單機開發環境運作正常，但缺少生產必要的運維特性：無 graceful shutdown、DB 連線池預設值、migration 在 API 啟動時同步跑。

## Goals / Non-Goals

**Goals:**

- 容器停止時正確完成 in-flight 請求
- DB 連線池可依環境調整
- Migration 與 API 啟動解耦，支援多副本部署

**Non-Goals:**

- K8s / Helm chart
- DB 備份排程（運維層面）
- 監控 / metrics（另外處理）

## Decisions

### D1: Graceful shutdown

`server.js` 監聽 `SIGTERM` 和 `SIGINT`，呼叫 `fastify.close()`。Fastify close 會等待 in-flight 請求完成（預設 timeout 依 Fastify connectionTimeout），然後關閉 DB pool。加 `SHUTDOWN_TIMEOUT_MS` 環境變數（預設 10000），超時則 `process.exit(1)` 強制退出。

### D2: DB 連線池配置

`new Pool()` 改為讀環境變數：
- `DB_POOL_MAX`（預設 20）
- `DB_POOL_IDLE_TIMEOUT`（預設 30000ms）
- `DB_POOL_CONNECTION_TIMEOUT`（預設 5000ms）

### D3: Migration 拆離

新增 `market-server/src/migrate.js`，獨立腳本執行 migration（讀 `migrations/` 目錄下所有 `.sql` 檔按名稱排序執行，用 `schema_migrations` table 記錄已執行的 migration）。`server.js` 不再執行 migration。docker-compose 的 api service 加 `entrypoint` 先跑 `node src/migrate.js` 再啟動 `node src/server.js`，或用 depends_on + init service。

目前 server.js 的 migration 邏輯是直接用 `pool.query` 跑 SQL 檔。migrate.js 抽取這段邏輯，加 idempotent guard（schema_migrations table tracking）。

### Scope Boundaries

**In scope:** `market-server/` 的 server.js、db.js、migrate.js、docker-compose.yml、.env.example
**Out of scope:** Felina client 端不需改動

## Implementation Contract

### Task 群組 1: Graceful shutdown
- server.js 加 SIGTERM/SIGINT handler
- 驗證目標：`docker stop` 時 log 顯示 graceful close

### Task 群組 2: DB 連線池
- db.js Pool 改讀環境變數
- .env.example 加新變數
- 驗證目標：設定 DB_POOL_MAX=5 啟動正常

### Task 群組 3: Migration 拆離
- 新增 migrate.js + schema_migrations table
- server.js 移除 migration 呼叫
- docker-compose entrypoint 改動
- 驗證目標：`docker compose down -v && docker compose up --build` migration 正常跑、API 正常啟動
