## Context

為了在推進 Phase 3 之前驗證 Skill Market 的「前端呈現」與「本地安裝」體驗，我們需要一個最小可行性原型 (MVP)。此原型將在本地以 Docker Compose 運行一個極簡的 Node.js Fastify Server、PostgreSQL (Metadata) 與 MinIO (Artifact Storage)。前端則在側邊欄加入「Hub」分頁，讓開發者測試發布與一鍵下載安裝。

**UI-related**: 本變更包含 UI 變更，Tasks 中須包含 `/felina-ui-guidelines` review 步驟。
**Security**: 涉及寫入使用者本機 `~/.felina/skills/` 目錄與發起 HTTP 下載請求，Tasks 中須包含 `/spectra-audit` 審查步驟。

## Goals / Non-Goals

**Goals:**
- 建立 `market-server/docker-compose.yml` 與 Node.js API 伺服器作為 Local Registry 原型。
- 實作前端 Hub 分頁，遵循文件中心化與毛玻璃卡片設計，可列出 API 返回的假資料或真實資料。
- 實作前端呼叫 Tauri Command (`install_market_skill`) 下載並解壓縮 package 到 `~/.felina/skills/` 的流程。

**Non-Goals:**
- 不實作 SSO/Entra ID 身份驗證，Prototype API 全開不受保護。
- 不處理 Skill 安裝時與本地既有修改的 Drift 或 Conflict，遇到同名則強制覆蓋。
- 不處理目標 (Target) fan-out，僅下載到 Canonical 目錄。

## Decisions

### Local Market Server Architecture
選擇 Node.js + Fastify + PostgreSQL + MinIO 作為 Local Server。
*Rationale*: Node.js 提供極快的原型開發速度，搭配 PostgreSQL 儲存 JSONB 格式的 Manifest，並用 MinIO 儲存封裝的 `.tar.gz` Skill 包。這是標準且易於以 Docker 組成的架構。

### Frontend Hub UI
採用無邊框、毛玻璃卡片 (`bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm`)，以符合 `felina-ui-guidelines` 的沉浸式與透視感要求。不使用 HTML 表格。
*Rationale*: 符合 UI 規範中對「清單項目 (List Items)」在底層背景動畫之上透視的嚴格要求。

### Tauri Install Command (Mock Install)
在 Rust 端實作 `install_market_skill`，接受 package id，從 `http://localhost:<port>/api/skills/:id/download` 獲取壓縮檔。使用 async `reqwest`（非 `reqwest::blocking`），因 `reqwest::blocking` 內部建立獨立 tokio runtime，在 Tauri async command 的 tokio runtime 中會造成 deadlock。
*Rationale*: 原本可以只做前端 Toast，但因引入了 Local Docker，這給予我們測試 Rust 下載解壓縮至 `~/.felina/skills/` 寫入路徑的機會，更能驗證端到端流程。

### Directory Hash Comparison（已安裝判定）
Hub 與 local skill 之間不存在持續關聯——安裝 = 複製一份到 local，之後各自獨立。Hub 頁面需要在載入時判定「已是最新」或「可安裝」，以 name + directory hash 雙重比對：

- `directory_hash` = SHA-256( `semantic_hash(SKILL.md)` + sorted sibling hashes )，代表整個 skill 目錄的內容指紋。
- Server 端：上傳時算 `directory_hash`，`GET /api/skills` 回傳 `contentHash` 欄位。
- Client 端：安裝完成時寫 `directory_hash` 到 `.felina-sync-meta.json`。使用者在 Felina 中 save skill 時也更新此 hash。
- Hub 頁面載入時同時取 hub skill list（含 `contentHash`）和 local canonical skill list（含 sync-meta hash），以 name 找到候選後比對 hash：
  - 同名 + hash 相同 → 「已是最新」
  - 同名 + hash 不同 → 「安裝」
  - 不存在 → 「安裝」

*Rationale*: 不使用 origin marker（如 `x_felina_hub_id`），因為 Hub 定位為一次性 skill 來源而非持續同步關係。用 directory hash 判定更精確：涵蓋 SKILL.md + sibling 的完整內容，本地修改後 hash 自動失配，不會誤顯示「已是最新」。既有的 `semantic_hash` 和 `compute_sibling_hashes` 可直接複用。

### Tauri CSP 與 Market Server CORS
Tauri webview 受 CSP `connect-src` 限制，需在 `tauri.conf.json` 的 CSP 中加入 `http://localhost:3100`。Market Server 端需註冊 `@fastify/cors` plugin 以回傳 CORS headers。
*Rationale*: Tauri webview 本質為 Chromium WebView2，即使非瀏覽器環境也會執行 CSP 規則。

## Implementation Contract

- **Behavior**: 使用者可在側邊欄看見 "Hub" 分頁。點擊後顯示由 Local Server 提供的 Skill 列表。點擊 "Install" 後，Tauri 會將壓縮包下載至本機 Canonical 目錄。
- **Interface / Data Shape**:
  - `GET /api/skills` 返回 `{ id, name, description, author, version, contentHash }` 清單。`contentHash` 為 `directory_hash`。
  - Tauri Command `install_market_skill(id: String)`，返回安裝後的 skill name。安裝完成時同步寫入 `directory_hash` 至 `.felina-sync-meta.json`。
- **Failure modes**: 如果無法連線 localhost API，前端顯示連線錯誤狀態（而非 Crash）。解壓失敗則在前端顯示 Toast error。
- **Acceptance criteria**: 啟動 Docker 後，開啟 Felina 進入 Hub，能成功點擊安裝按鈕，在 `~/.felina/skills/` 下看到下載解壓的檔案，`.felina-sync-meta.json` 包含 `directoryHash`。Hub 頁面以 name + hash 比對正確顯示「已是最新」或「安裝」，切換頁面後狀態持續正確。
- **Scope boundaries**: 僅限於本機目錄解壓縮寫入與 sync-meta hash 記錄。不涵蓋 fan-out 寫入。不建立 Hub 與 local 之間的持續關聯。

## Risks / Trade-offs

- [Risk] Rust 端強制覆蓋 `~/.felina/skills/` 會導致資料遺失。 → Mitigation: 目前作為 Prototype，我們接受覆蓋風險，並在 UI 上加上「Overwrite」字眼提醒使用者。
- [Risk] Tauri 端執行 HTTP 請求。 → Mitigation: 使用 `reqwest` crate 來執行，避免跨平台相容性問題。
