# Market Server 部署指南

## 概述

Felina Market Server 是 Skill Hub 的後端服務，提供 skill 的發布、安裝、刪除 API。
架構：Fastify (Node.js) + PostgreSQL (metadata) + MinIO (tarball 物件儲存)。

---

## 前提條件

Server 端需要：
- Docker Engine 20+
- Docker Compose v2+
- 開放 port 3100（API）、可選開放 9001（MinIO Console）

---

## 部署步驟

### 1. 複製 market-server 到 server

```bash
scp -r market-server/ user@server:/opt/felina-market/
```

只需要 `market-server/` 資料夾，不需要整個 felina repo。

### 2. 啟動服務

```bash
cd /opt/felina-market
docker compose up -d --build
```

首次啟動時會自動：
- Build API image（`npm ci --production`）
- 啟動 PostgreSQL 並等待 healthcheck
- 啟動 MinIO 並等待 healthcheck
- 跑 database migration（`001_init.sql` → 建 `skills` table）
- 建立 MinIO bucket（`skills`）
- 開始監聽 `0.0.0.0:3100`

### 3. 驗證

```bash
curl http://localhost:3100/api/skills
# 預期回應：200 + JSON array（空或有資料）
```

### 4.（選用）Nginx 反向代理 + HTTPS

```nginx
server {
    listen 443 ssl;
    server_name market.corp.local;  # 改成實際內網域名或 IP

    ssl_certificate     /etc/nginx/ssl/market.crt;
    ssl_certificate_key /etc/nginx/ssl/market.key;

    client_max_body_size 50m;  # skill tarball 上傳限制

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name market.corp.local;
    return 301 https://$host$request_uri;
}
```

重點：
- `client_max_body_size 50m`：Skill tarball 上傳需要足夠大小
- 無 WebSocket，不需 upgrade 設定
- 若 docker compose 的 api port 改了，`proxy_pass` 對應調整

---

## Felina 客戶端設定

每位使用者在 Felina app → Settings → Market Server URL 填：
- 無 HTTPS：`http://<server-ip>:3100`
- 有 HTTPS：`https://market.corp.local`

---

## 注意事項

### 1. 密碼設定

密碼透過 `.env` 檔管理，不寫在 `docker-compose.yml` 裡。

部署時：
1. 複製 `.env.example` 為 `.env`
2. 修改 `.env` 裡的密碼
3. `.env` 不進 git（已加 `.gitignore`）

```bash
cp .env.example .env
vim .env  # 改 POSTGRES_PASSWORD 和 MINIO_ROOT_PASSWORD
```

| 變數 | 說明 |
|------|------|
| `POSTGRES_USER` | PostgreSQL 帳號 |
| `POSTGRES_PASSWORD` | PostgreSQL 密碼 |
| `POSTGRES_DB` | 資料庫名稱 |
| `MINIO_ROOT_USER` | MinIO 管理帳號 |
| `MINIO_ROOT_PASSWORD` | MinIO 管理密碼 |
| `MINIO_BUCKET` | 物件儲存 bucket 名稱 |

### 2. 資料持久化

Docker volumes（`postgres_data`、`minio_data`）預設存在 Docker engine 管理的路徑下。
- `docker compose down` 不會刪 volume（資料保留）
- `docker compose down -v` 會刪 volume（**資料全清**）
- 若要指定實體路徑，改 volumes 為 bind mount：

```yaml
volumes:
  - /data/market/postgres:/var/lib/postgresql/data
  - /data/market/minio:/data
```

### 3. 備份

- **PostgreSQL**：`docker compose exec postgres pg_dump -U market market_db > backup.sql`
- **MinIO**：volume 整個 rsync，或用 `mc mirror` 同步到另一個儲存
- 建議定期 cron 備份，尤其在公司多人使用後

### 4. HTTPS 與自簽憑證

| 憑證類型 | Felina 端行為 |
|---------|--------------|
| 公司 CA 簽發（機器已信任） | 直接連，無需額外設定 |
| Let's Encrypt（公網域名） | 直接連 |
| 自簽憑證 | **reqwest 會拒絕連線**（certificate verify failed） |

自簽憑證解法：
- (A) 將 CA cert 安裝到使用者機器的系統信任庫（Windows: `certmgr.msc` → 受信任的根目錄）
- (B) Felina 後端加 insecure flag（目前未實作，需另開 change）
- (C) 不用 HTTPS，改用 HTTP + VPN/Tailscale 加密通道（內網最簡單）

**建議**：內網部署用 (C) 最省事，`http://<tailscale-ip>:3100` 或 `http://<lan-ip>:3100`。

### 5. 防火牆

Docker 在 Linux 上會自動加 iptables 規則開放 published ports。但：
- 如果 server 有 UFW/firewalld，Docker 可能繞過它（已知行為）
- 如果想限制只有內網能連，用 docker-compose 的 ports 綁定 LAN IP：

```yaml
ports:
  - "192.168.1.50:3100:3100"  # 只綁 LAN 介面
```

### 6. 版本升級

Market server 更新時：

```bash
cd /opt/felina-market
git pull  # 或重新 scp
docker compose up -d --build
```

API container 重建時會自動跑新的 migration。舊 migration 不會重複執行（`pgmigrations` table 追蹤）。

### 7. MinIO Console（管理 UI）

若需要直接管理上傳的 tarball：
- 預設 port 9001
- 正式環境建議不對外暴露，或限制 IP 存取
- docker-compose 可移除 `9001:9001` 映射來關閉

### 8. 多人同時使用的容量

- PostgreSQL：skill metadata 極輕量，數萬筆無壓力
- MinIO：取決於磁碟空間。每個 skill tarball 通常 < 100KB（純 Markdown + 少量檔案）
- API：單 Node.js process，數十人併發足夠。若需 scale → 前面加 load balancer + 多 API container（stateless）

---

## 常用維運指令

```bash
# 查看服務狀態
docker compose ps

# 查看 API log
docker compose logs -f api

# 重啟單一服務
docker compose restart api

# 進 PostgreSQL CLI
docker compose exec postgres psql -U market market_db

# 清空所有 skill 資料（開發用）
docker compose exec postgres psql -U market market_db -c "TRUNCATE skills;"
docker compose exec minio mc rm --recursive --force local/skills/

# 完全重置（刪所有 volume）
docker compose down -v
docker compose up -d --build
```
