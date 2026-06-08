## Summary

Market server 應用層安全加固：CORS 白名單、速率限制、密碼最小長度驗證、server-side content hash 驗證。

## Motivation

hub-auth-install-safety 上線後 security audit 發現多項應用層安全缺口：CORS 完全開放（任何 origin 可呼叫）、auth 端點無速率限制（暴力破解風險）、密碼只檢查非空（trivially guessable）、content-hash 由 client 自填未驗證（可偽造）。這些在公司內網環境或許可接受，但部署到正式環境前必須修正。

## Proposed Solution

1. **CORS 白名單**：`@fastify/cors` 設定 `origin` 為環境變數 `CORS_ORIGIN`（逗號分隔多個 origin），開發環境預設 `http://localhost:1420`
2. **速率限制**：加入 `@fastify/rate-limit`，`/auth/register` 和 `/auth/login` 設 5 req/15min/IP，其他端點可寬鬆（100 req/min）
3. **密碼最小長度**：register 端點驗證 `password.length >= 8`，不足回 400
4. **Content hash server 驗證**：PUT `/api/skills/:name` 上傳後 server 計算 tarball 的 content hash，與 client 傳來的 `x-content-hash` 比對，不一致回 400
5. **Dockerfile non-root**：加 `USER node`
6. **Log level 可配**：`LOG_LEVEL` 環境變數控制 Fastify logger level，預設 `info`
7. **Multipart 降限**：`fileSize` 從 50MB 降至 10MB

## Non-Goals

- Token 撤銷/refresh token（另開 `market-server-auth-lifecycle`）
- MinIO 權限/物件清除（另開 `market-server-storage-ops`）
- TLS/nginx 層（部署時處理）
- skill 列表端點加 auth（歸 auth-lifecycle）

## Capabilities

### Modified Capabilities

- `market-server-publish`: 加 content hash 驗證、multipart 限制調整
- `hub-auth`: 加密碼最小長度驗證、速率限制

## Impact

- Affected specs: `market-server-publish`（modified）、`hub-auth`（modified）
- Affected code:
  - Modified: `market-server/src/app.js`、`market-server/package.json`、`market-server/package-lock.json`、`market-server/docker-compose.yml`、`market-server/.env.example`、`market-server/Dockerfile`、`market-server/src/app.test.js`
  - New: (none)
  - Removed: (none)
