## 1. 依賴安裝與環境變數

- [x] 1.1 在 `market-server/package.json` 新增 `@fastify/rate-limit` 依賴。`npm install` 確認鎖檔更新。驗證：`node -e "require('@fastify/rate-limit')"` 無錯。
- [x] 1.2 在 `market-server/.env.example` 新增 `CORS_ORIGIN=http://localhost:1420`、`RATE_LIMIT_MAX=100`、`RATE_LIMIT_AUTH_MAX=5`、`RATE_LIMIT_AUTH_WINDOW=15`、`UPLOAD_MAX_SIZE_MB=10`、`LOG_LEVEL=info`。驗證：`.env.example` 包含所有新變數。

## 2. CORS + Rate Limit + Log Level

- [x] [P] 2.1 修改 `market-server/src/app.js`：`fastify.register(cors)` 改為讀 `CORS_ORIGIN` 環境變數，有值時 `origin` 設為逗號分隔陣列，無值時 `origin: true`（開發相容）。驗證：`npm test` 新增的 CORS 測試通過。
- [x] [P] 2.2 在 `market-server/src/app.js` 註冊 `@fastify/rate-limit`：全域 `max` 讀 `RATE_LIMIT_MAX`（預設 100），`timeWindow: '1 minute'`。`/auth/register` 和 `/auth/login` route config 覆寫 `max` 讀 `RATE_LIMIT_AUTH_MAX`（預設 5），`timeWindow` 為 `RATE_LIMIT_AUTH_WINDOW` 分鐘（預設 15）。超限回 429。驗證：`npm test` 新增的 rate limit 測試通過。
- [x] [P] 2.3 修改 `market-server/src/app.js`：`Fastify({ logger: true })` 改為 `Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })`。驗證：設 `LOG_LEVEL=warn` 啟動時 info log 不輸出。

## 3. 密碼驗證 + Content Hash 驗證 + Upload 限制

- [x] [P] 3.1 修改 `market-server/src/app.js` 的 `POST /auth/register`：在現有 email/password 非空檢查後，加 `password.length < 8` → 400 `"password must be at least 8 characters"`。驗證：`npm test` 新增的密碼長度測試通過。
- [x] [P] 3.2 修改 `market-server/src/app.js` 的 `PUT /api/skills/:name`：content hash 驗證從 `typeof contentHash !== 'string' || contentHash.trim() === ''` 改為額外檢查 `/^[0-9a-f]{64}$/i.test(contentHash.trim())`，不符回 400 `"invalid content hash format"`。驗證：`npm test` 新增的 hash 格式測試通過。
- [x] [P] 3.3 修改 `market-server/src/app.js`：multipart `fileSize` 從 `50 * 1024 * 1024` 改為 `(parseInt(process.env.UPLOAD_MAX_SIZE_MB, 10) || 10) * 1024 * 1024`。驗證：`npm test` 確認預設 10MB 限制。

## 4. Dockerfile + 整合測試

- [x] 4.1 修改 `market-server/Dockerfile`：最終 stage 加 `USER node`。驗證：`docker compose up --build` 正常啟動，`docker exec market-server-api-1 whoami` 回 `node`。
- [x] 4.2 `npm test`（market-server）全部通過。驗證：CI 等級 test pass。
- [x] 4.3 `npm run check` 通過（若有前端改動）。驗證：TypeScript 靜態檢查 pass。
