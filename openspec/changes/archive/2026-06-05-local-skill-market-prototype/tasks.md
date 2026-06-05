## 1. 專案基線建立 (Baseline)

- [x] 1.1 執行 `npm run check` 記錄現有的 TypeScript 錯誤與警告，將結果輸出以區分未來新增的型別問題。

## 2. 後端伺服器建立 (Market Server)

- [x] [P] 2.1 在 `market-server/` 目錄建立 `docker-compose.yml`，包含 PostgreSQL 與 MinIO 服務，實踐 Local Market Server Architecture 設計決策。驗證方式：`docker compose -f market-server/docker-compose.yml up -d` 成功啟動且 `docker compose ps` 顯示三個服務 healthy。
- [x] [P] 2.2 在 `market-server/` 目錄建立 Node.js Fastify API 專案，實作 Local Market Server Architecture 決策中的 Skill Registry API endpoints 需求，提供 `/api/skills` 與 `/api/skills/:id/download` 介面。驗證方式：容器啟動後，`curl http://localhost:<port>/api/skills` 回傳 JSON 陣列，`curl -o /dev/null -w '%{http_code}' http://localhost:<port>/api/skills/1/download` 回傳 200。

## 3. 桌面端後端整合 (Tauri Backend)

- [x] 3.1 在 `src-tauri/Cargo.toml` 新增 `reqwest`（含 `blocking` feature）、`flate2`、`tar` 依賴，並在 `src-tauri/src/commands/market_install.rs` 實作 `install_market_skill` command，滿足 Tauri Install Command (Mock Install) 設計決策與 Local Package Extraction 需求：從 `http://localhost:<port>/api/skills/:id/download` 下載 `.tar.gz` 並解壓縮至 `~/.felina/skills/<skill-name>/`。驗證方式：`cargo check` 與 `cargo build` 在 `src-tauri/` 通過無錯誤。
- [x] 3.2 在 `src-tauri/src/commands/mod.rs` 與 `lib.rs` 的 `invoke_handler!` 註冊 `install_market_skill` command，並在 `src/lib/tauri/commands.ts` 新增對應的 typed invoke wrapper（含 TypeScript 型別定義）。驗證方式：`npm run check` 通過，`cargo build` 通過，前端可透過 wrapper 呼叫 command。

## 4. 桌面端前端實作 (Frontend UI)

- [x] 4.1 修改 `src/router.tsx` 與 `src/lib/components/layout/Sidebar.tsx`，滿足 Sidebar Hub Navigation 需求，側邊欄出現 Hub 入口並路由至 `/hub`。驗證方式：`npm run check` 通過。
- [x] [P] 4.2 實作 `src/lib/components/hub/HubPage.tsx`，使用毛玻璃卡片風格（`bg-bg-secondary/40 backdrop-blur-md border border-white/5 shadow-sm`）展示 skill 清單，滿足 Frontend Hub UI 決策與 Hub UI Presentation 需求。頁面載入時呼叫 Local Market API 取得資料；API 連線失敗時顯示連線錯誤狀態（非空白或 crash），安裝失敗時顯示 Toast error。驗證方式：`npm run check` 通過。
- [x] [P] 4.3 實作 Hub 卡片上的「Install」按鈕事件，透過 `commands.ts` 的 typed wrapper 呼叫 `install_market_skill`，完成 Install Skill Action 需求。驗證方式：`npm run check` 通過。
- [x] 4.4 新增 Hub 頁面相關 i18n key 至 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts`（namespace: `hub.*`），涵蓋分頁標題、卡片欄位標籤、Install 按鈕文字、連線錯誤提示、安裝成功/失敗 Toast 訊息。HubPage 的所有使用者可見文字一律透過 `t(locale, key)` 取得，不硬編碼。驗證方式：`npm run check` 通過（TranslationDict type 強制 en/zh-TW 結構對齊，缺 key 會 compile error）。

## 5. 連線與安裝修正 (Connection & Install Fixes)

- [x] 5.1 在 `market-server/src/server.js` 註冊 `@fastify/cors` plugin，使 Market Server 回傳 `Access-Control-Allow-Origin` header，滿足 Tauri webview 跨 origin 請求需求（Tauri CSP 與 Market Server CORS 決策）。驗證方式：`curl -H "Origin: http://localhost:1420" -I http://localhost:3100/api/skills` 回傳含 `access-control-allow-origin: *` header。
- [x] 5.2 在 `src-tauri/tauri.conf.json` 的 CSP `connect-src` 加入 `http://localhost:3100`，使 Tauri webview 允許前端 fetch 請求連線至 Market Server（Tauri CSP 與 Market Server CORS 決策）。驗證方式：`npm run tauri dev` 啟動後，Hub 頁面能成功載入 skill 列表而非顯示連線錯誤。
- [x] 5.3 將 `market_install.rs` 的 `reqwest::blocking::get` + `tokio::task::spawn_blocking` 改為 async `reqwest::get`，避免 Tauri async runtime 中的 deadlock（Tauri Install Command 設計決策）。驗證方式：Hub 頁面點擊 Install 按鈕後能正常完成安裝並顯示成功提示，而非永久停留在「安裝中」。

## 6. Revert x_felina_hub_id 方案

- [x] 6.1 Revert 先前錯誤方向的改動：移除 `market_install.rs` 的 `inject_hub_id` 函式與呼叫處、移除 `canonical_skills.rs` 的 `hub_id` 欄位 / `extract_hub_id` / `HUB_ID_KEY` / `canonical_skills_write` 中的 hub_id 保留邏輯、移除前端 `SkillListEntry` 的 `hubId` 欄位。恢復 `HubPage.tsx` 到不含 hub_id 比對的狀態（移除 `installedHubIds`）。驗證方式：`npm run check` 通過，`cargo build` 通過，grep 確認 codebase 中不再有 `x_felina_hub_id` / `hub_id` / `inject_hub_id` / `extract_hub_id` 的引用（spec/design artifacts 除外）。

## 7. Directory Hash Comparison

- [x] 7.1 實作 Directory Hash Comparison（已安裝判定）決策的核心函式：在 `fan_out/mod.rs` 新增 pub `directory_hash` 函式，接受 skill 目錄 path，計算 `SHA-256(semantic_hash(SKILL.md) + sorted sibling hashes)`，回傳 hex string。複用既有的 `semantic_hash` 和 `compute_sibling_hashes`。驗證方式：新增 Rust unit test，給定一個含 SKILL.md + 一個 sibling 的 tempdir，驗證 `directory_hash` 回傳穩定且非空的 hex string；修改 sibling 內容後 hash 改變。`cargo test` 通過。
- [x] 7.2 在 `market_install.rs` 的 `install_market_skill` 完成解壓後，呼叫 `directory_hash` 計算安裝後的 skill 目錄 hash，寫入 `.felina-sync-meta.json` 的 `directoryHash` 欄位，滿足 Directory Hash Recording on Install 需求。驗證方式：安裝完成後，`~/.felina/skills/<skill-name>/.felina-sync-meta.json` 包含 `directoryHash` 欄位。`cargo build` 通過。
- [x] 7.3 Market Server `GET /api/skills` 回傳新增 `contentHash` 欄位（mock 值即可，因 prototype 無真正上傳流程），`server.js` 的 `SKILLS` 陣列每筆加上預算好的 hash 字串。驗證方式：`curl http://localhost:3100/api/skills` 回傳的每筆 skill 包含 `contentHash` 欄位。
- [x] [P] 7.4 新增 Tauri command `get_skill_directory_hash(name: String) -> Option<String>`，讀取指定 canonical skill 的 `.felina-sync-meta.json` 的 `directoryHash` 欄位並回傳。在 `commands/mod.rs` + `lib.rs` 註冊，`commands.ts` 新增 typed wrapper。驗證方式：`npm run check` 通過，`cargo build` 通過。
- [x] [P] 7.5 修改 `HubPage.tsx` 的已安裝判定邏輯，滿足 Installed State Display 需求：頁面載入時同時取 hub skill list（含 `contentHash`）和 local canonical skill list，對同名 skill 取其 `directoryHash`（透過 `get_skill_directory_hash` 或 list 回傳的資料），比對 hash。同名 + hash 相同 → 顯示「已是最新」；同名 + hash 不同或不存在 → 顯示「安裝」。驗證方式：`npm run check` 通過。
- [x] 7.6 更新 i18n：將 `hub.installed`（"Installed" / "已安裝"）改為 `hub.upToDate`（"Up to date" / "已是最新"），反映 directory hash 比對語意。驗證方式：`npm run check` 通過。

## 8. 驗證與審查 (Validation & Review)

- [x] 8.1 執行 `/felina-ui-guidelines` review 本變更引入的 Hub 頁面 UI 改動，輸出命中的 guideline 與 deviation 清單，驗證前端介面是否符合無邊框與毛玻璃規範。
- [x] 8.2 執行 `/spectra-audit` 審查本變更的安全面向，重點檢視：(a) `install_market_skill` 的 HTTP 下載是否有路徑穿越風險（解壓縮目標限制在 `~/.felina/skills/` 下），(b) 強制覆蓋行為的 UI 提示是否充分，(c) `reqwest` 請求是否限制在 localhost。輸出審查報告與修正建議。
- [x] 8.3 執行 `npm run tauri dev` 進行手動端對端驗證：啟動 Docker 伺服器，點擊側邊欄 Hub 分頁，確認介面正確顯示 Mock Skill 列表。點擊 Install 按鈕驗證 Skill 成功解壓縮寫入至 `~/.felina/skills/` 且 `.felina-sync-meta.json` 包含 `directoryHash`。安裝後卡片變為「已是最新」。在 Skills 頁面編輯該 skill 後回到 Hub，確認狀態變回「安裝」（hash 不再相同）。切換頁面後回到 Hub 確認狀態持續正確。額外驗證：關閉 Docker 後重新進入 Hub，確認顯示連線錯誤狀態而非空白。
