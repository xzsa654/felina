## Why

Hub 頁面的 Market Server URL 目前寫死在前端 `HubPage.tsx`（`const API_BASE = "http://localhost:3100"`）和後端 `market_install.rs`（`format!("http://localhost:3100/api/skills/{}/download", id)`）。實際部署時，market server 會在公司內網某台機器上運行，使用者需要能在 Settings 中配置 server 位址。

## What Changes

- 後端新增 market server URL 設定的讀寫 Tauri commands，設定值持久化至 `~/.felina/settings.json`（或既有的設定檔路徑）。
- 前端 Settings 頁面新增「Market Server」section，提供 URL 輸入欄位。
- `HubPage.tsx` 和 `market_install.rs` 從設定讀取 URL，不再寫死。
- 預設值保持 `http://localhost:3100`，讓開發環境無需額外配置即可使用。

## Non-Goals (optional)

- 不做 server 連線測試 / health check UI（可後續加）。
- 不做多 server 支援（一次只連一個 market server）。
- 不做 URL 格式驗證以外的驗證（如 SSL 憑證檢查）。

## Capabilities

### New Capabilities

- `market-server-config`: 後端 market server URL 設定的讀寫與持久化，前端 Settings 頁面的 Market Server section UI。

### Modified Capabilities

- `mock-install-flow`: `install_market_skill` 從設定讀取 URL 而非寫死。
- `hub-ui-navigation`: Hub 頁面 `API_BASE` 從設定讀取而非寫死。

## Impact

- Affected specs: `market-server-config`（新）、`mock-install-flow`（MODIFIED）、`hub-ui-navigation`（MODIFIED）
- Affected code:
  - New:
    - `src/lib/components/settings/MarketServerSection.tsx`
  - Modified:
    - `src/lib/components/hub/HubPage.tsx`
    - `src/lib/components/settings/FelinaSettingsPage.tsx`
    - `src/lib/tauri/commands.ts`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
    - `src-tauri/src/commands/market_install.rs`
  - Removed: (none)
