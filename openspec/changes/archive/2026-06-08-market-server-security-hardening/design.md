## Context

market-server 已有 JWT auth（hub-auth-install-safety），但應用層安全配置仍為開發環境預設值。本次加固針對 CORS、速率限制、密碼政策、content hash 驗證、container 安全、日誌等級、上傳限制。

## Goals / Non-Goals

**Goals:**

- 所有安全加固項目可透過環境變數配置，開發環境無需額外設定即可運作
- 不影響現有 API 行為（除密碼長度新增限制外）

**Non-Goals:**

- Token 撤銷 / refresh token（`market-server-auth-lifecycle`）
- MinIO 權限 / 物件清除（`market-server-storage-ops`）
- TLS 終止（部署基礎設施層）

## Decisions

### D1: CORS 白名單配置

CORS origin 由 `CORS_ORIGIN` 環境變數控制（逗號分隔）。未設定時 fallback 為 `*`（開發環境相容）。`.env.example` 加範例值 `http://localhost:1420`。

### D2: 速率限制策略

使用 `@fastify/rate-limit`。全域預設 100 req/min/IP。`/auth/register` 和 `/auth/login` 覆寫為 5 req/15min/IP。超限回 429。`RATE_LIMIT_MAX` 和 `RATE_LIMIT_AUTH_MAX` 環境變數可覆寫。

### D3: 密碼最小長度

`POST /auth/register` 驗證 `password.length >= 8`，不足回 400 `"password must be at least 8 characters"`。login 不加限制（相容既有短密碼帳號，鼓勵但不強制更新）。

### D4: Content hash server 驗證

PUT `/api/skills/:name` 上傳後，server 對 tarball buffer 以 SHA-256 計算 content hash（與 Felina client `get_skill_directory_hash` 相同演算法），與 `x-content-hash` header 比對。不一致回 400 `"content hash mismatch"`。

驗證對象：`x-content-hash` 是 client 傳來的 directory-level semantic hash，`tarballHash` 是 server 對 tarball binary 的 SHA-256。兩者用途不同。此處驗證的是 `x-content-hash` 是否與 server 從 tarball 重新計算的 directory hash 一致。

實作方式：從 tarball 解壓所有檔案，以相同的排序與 hash 邏輯計算 directory hash，比對 header 值。若演算法對齊成本過高，降級為僅檢查 `x-content-hash` 非空且格式正確（64 hex chars）。

### D5: Dockerfile non-root user

在 Dockerfile 最終 stage 加 `USER node`，確保容器不以 root 執行。`node:22-alpine` image 已內建 `node` user。

### D6: Log level 可配

`Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })`。`.env.example` 加 `LOG_LEVEL=info`。

### D7: Multipart 上傳限制

`fileSize` 從 50MB 降至 10MB。`UPLOAD_MAX_SIZE_MB` 環境變數可覆寫。

## Implementation Contract

### Task 群組 1: 依賴安裝與基礎配置
- 安裝 `@fastify/rate-limit`
- `.env.example` 新增所有環境變數
- 驗證目標：`npm install` 成功，`.env.example` 包含所有新變數

### Task 群組 2: CORS + Rate Limit + Log Level
- `app.js` 的 cors 註冊改為讀 `CORS_ORIGIN` 環境變數
- 註冊 `@fastify/rate-limit` 全域 + auth 端點覆寫
- Fastify logger 改為讀 `LOG_LEVEL`
- 驗證目標：`npm test` 新增的 CORS / rate limit / log 測試通過

### Task 群組 3: 密碼驗證 + Content Hash 驗證 + Upload 限制
- register 加 `password.length >= 8` 檢查
- PUT handler 加 content hash 格式驗證（64 hex chars）
- multipart `fileSize` 改為讀 `UPLOAD_MAX_SIZE_MB` 或預設 10MB
- 驗證目標：`npm test` 新增的密碼/hash/upload 測試通過

### Task 群組 4: Dockerfile + 測試
- Dockerfile 加 `USER node`
- `docker compose up --build` 確認正常啟動
- 驗證目標：container 以 node user 執行

### Scope Boundaries

**In scope:** `market-server/` 目錄內的所有改動
**Out of scope:** Felina client 端不需要任何改動（client 已正確傳送 content hash 與 auth header）
