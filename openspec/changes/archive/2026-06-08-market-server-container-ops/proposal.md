## Summary

Market server 容器與應用運維加固：graceful shutdown、DB 連線池設定、migration 拆離 API 啟動。

## Motivation

目前 API 啟動時同步跑 migration（多副本競態風險）、容器停止未做 graceful shutdown（連線強斷）、DB 連線池用預設值（max 10）。這些在單機開發沒問題，但多副本部署時會出事。

## Proposed Solution

1. **Graceful shutdown**：`server.js` 監聽 `SIGTERM`/`SIGINT`，呼叫 `fastify.close()` 等待 in-flight 請求完成後再退出
2. **DB 連線池**：`DB_POOL_MAX`（預設 20）、`DB_POOL_IDLE_TIMEOUT`（預設 30000ms）環境變數控制
3. **Migration 拆離**：新增 `migrate.js` 獨立腳本，docker-compose 用 init container 或 entrypoint 先跑 migration 再啟動 API

## Non-Goals

- DB 備份策略（運維層面，不在程式碼 change 範圍）
- K8s / Helm chart（部署基礎設施層）

## Impact

- Affected code:
  - Modified: `market-server/src/server.js`、`market-server/src/db.js`、`market-server/docker-compose.yml`、`market-server/.env.example`
  - New: `market-server/src/migrate.js`
  - Removed: (none)
