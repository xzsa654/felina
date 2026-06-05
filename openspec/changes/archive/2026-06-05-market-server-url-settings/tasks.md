## 1. 專案基線建立 (Baseline)

- [x] 1.1 執行 `npm run check` 記錄現有的 TypeScript 錯誤與警告，將結果輸出以區分未來新增的型別問題。

## 2. 後端設定讀寫 (Backend Config)

- [x] [P] 2.1 在 `market_install.rs`（或新增獨立 module）實作 market server URL 的持久化讀寫：新增 `get_market_server_url` Tauri command（回傳已設定的 URL 或預設值 `http://localhost:3100`）和 `set_market_server_url(url: String)` Tauri command（寫入設定檔），滿足 Market Server URL Read Command 和 Market Server URL Write Command 需求。設定持久化至 `~/.felina/settings.json`（或既有路徑）。在 `commands/mod.rs` + `lib.rs` 的 `invoke_handler!` 註冊，`commands.ts` 新增 typed wrappers。驗證方式：`npm run check` 通過，`cargo build` 通過。
- [x] [P] 2.2 修改 `market_install.rs` 的 `install_market_skill` 函式，將寫死的 `http://localhost:3100` 改為呼叫 `get_market_server_url` 取得設定值，滿足 Local Package Extraction 的 MODIFIED 需求。驗證方式：`cargo build` 通過。

## 3. 前端 Settings UI

- [x] 3.1 新增 `src/lib/components/settings/MarketServerSection.tsx`，提供 Market Server URL 文字輸入欄位與儲存按鈕，滿足 Market Server URL Setting 需求。載入時呼叫 `get_market_server_url` 取得目前值，儲存時呼叫 `set_market_server_url`。驗證方式：`npm run check` 通過。
- [x] 3.2 在 `FelinaSettingsPage.tsx` 引入 `MarketServerSection`，放置於適當位置。驗證方式：`npm run check` 通過。

## 4. Hub 頁面整合

- [x] 4.1 修改 `HubPage.tsx`，移除寫死的 `const API_BASE = "http://localhost:3100"`，改為頁面載入時呼叫 `get_market_server_url` 取得設定值作為 API base URL，滿足 Hub UI Presentation 的 MODIFIED 需求。驗證方式：`npm run check` 通過。

## 5. i18n

- [x] 5.1 新增 Settings Market Server section 相關 i18n key 至 `en.ts` 和 `zh-TW.ts`（namespace: `felinaSettings.marketServer.*`），涵蓋 section 標題、URL 欄位 label、placeholder、儲存按鈕文字。驗證方式：`npm run check` 通過（TranslationDict type 強制結構對齊）。

## 6. 驗證與審查 (Validation & Review)

- [x] 6.1 執行 `/felina-ui-guidelines` review 新增的 MarketServerSection UI，輸出命中的 guideline 與 deviation 清單。
- [x] 6.2 執行 `npm run tauri dev` 進行手動端對端驗證：開啟 Settings 頁面確認 Market Server section 出現、預設值為 `http://localhost:3100`。修改 URL 後儲存，切到 Hub 頁面確認 fetch 使用新 URL（可透過 DevTools Network 觀察）。重啟 app 後確認設定持久化。
