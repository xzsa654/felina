## Why

Felina 的長期願景包含建立公司內部的 Skill Market，以促進內部社群化與知識共享。在正式推進 Phase 3 之前，我們需要一個「Local Docker 伺服器」加上「前端 Hub 介面」的最小可行性產品 (MVP) 原型，來驗證端到端的發布 (Publish) 與安裝 (Install) 體驗。此 MVP 可降低未來實作完整後端時的技術風險。

## What Changes

本變更將引入一個基於本地 Docker Compose 的最小化後端伺服器 (包含 Node.js Fastify API、PostgreSQL、MinIO)，並在 Felina 桌面端側邊欄新增一個「Hub」分頁，提供沉浸式的卡片化列表讓使用者能夠預覽與「一鍵安裝」 Mock Skills。Hub 頁面以 skill name + directory hash（整個 skill 目錄的內容指紋）判定本地是否已有相同內容，顯示「已是最新」或「安裝」。Hub 與 local 之間不建立持續關聯——安裝即複製，之後各自獨立。這是一個純粹的 Prototype，以強制覆蓋的形式寫入本地，不處理複雜的 Drift 或 Conflict。

## Non-Goals (optional)

- **不**實作完整的身份驗證 (SSO/Entra ID)。
- **不**處理版本衝突、Drift 偵測或覆蓋警告。
- **不**直接操作或寫入 `.claude` 或 `.agents` 目錄，仍遵循先寫入 Canonical storage 觸發 Fan-out 的原則。
- **不**作為正式對外釋出的預設功能。

## Capabilities

### New Capabilities

- `local-market-infrastructure`: 建立包含 Node.js API、Postgres、MinIO 的本地 Docker Compose 環境。
- `hub-ui-navigation`: 在側邊欄新增 Hub 分頁，並提供符合 UI 規範的無邊框與毛玻璃列表。
- `mock-install-flow`: 前端呼叫 Tauri command，從本地 Docker API 下載 Skill package 並強制解壓縮至 Canonical storage。

### Modified Capabilities

(none)

## Impact

- Affected specs: `local-market-infrastructure`, `hub-ui-navigation`, `mock-install-flow`
- Affected code:
  - New: 
    - `src/lib/components/hub/HubPage.tsx`
    - `market-server/docker-compose.yml`
    - `market-server/package.json`
    - `market-server/src/server.js`
    - `src-tauri/src/commands/market_install.rs`
  - Modified: 
    - `src/router.tsx`
    - `src/lib/components/layout/Sidebar.tsx`
    - `src/lib/tauri/commands.ts`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
    - `src-tauri/src/commands/mod.rs`
    - `src-tauri/src/lib.rs`
    - `src-tauri/Cargo.toml`
    - `src-tauri/tauri.conf.json` (CSP connect-src)
  - Removed: (none)
