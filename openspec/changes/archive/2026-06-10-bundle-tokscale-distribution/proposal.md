## Why

終端使用者透過安裝檔（.msi/.exe/.dmg）取得 Felina，環境中通常沒有 tokscale 也沒有 Node.js — Token 分析的 tokscale 來源直接落到 `missing_binary`，整個功能形同不存在。`tokscale-windows-cmd-resolution-fix`（已完成）只救了「自己裝過 tokscale」的使用者；本 change 讓「什麼都沒裝」的使用者開箱即用。

## What Changes

- Tauri bundle 加入 tokscale sidecar（`bundle.externalBin`）：build 時將各平台官方 binary 打包進安裝檔，與主程式同目錄
- 新增 build 前置 script：從 npm registry 抓取對應 target 平台的 `@tokscale/cli-*` tarball（如 `@tokscale/cli-win32-x64-msvc`、`@tokscale/cli-darwin-arm64`），解出原生 binary 並以 Tauri target-triple 命名放入 src-tauri/binaries/
- Runtime binary 解析鏈擴充為：`FELINA_TOKSCALE_BIN` env override → PATH 上的 tokscale（含 `.cmd` 變體）→ **sidecar（主程式同目錄）** → npx fallback → `missing_binary`
- tokscale 版本 pin 在 build script 中，隨 Felina release 一起更新（不做 app 內獨立更新）

## Capabilities

### New Capabilities

- `tokscale-sidecar-distribution`: tokscale binary 的打包散佈 — build script 抓取規則、sidecar 命名與擺放位置、版本 pin 策略

### Modified Capabilities

- `tokscale-backed-token-ingestion`: binary 解析順序需求擴充 — PATH 之後、npx 之前插入 sidecar 解析層

## Impact

- Affected specs: `tokscale-sidecar-distribution`（新增）、`tokscale-backed-token-ingestion`（修改 binary resolution 需求）
- Affected code:
  - New: scripts/fetch-tokscale.mjs、src-tauri/binaries/.gitignore
  - Modified: src-tauri/tauri.conf.json、src-tauri/src/tokens/tokscale.rs、src-tauri/src/tokens/tokscale_ingestion.rs、package.json、docs/tokscale-backed-token-ingestion.md
  - Removed: （無）
- 依賴變動：無新增 Cargo 依賴；npm 端僅用 Node 內建模組寫 fetch script（無新 devDependency）
- 風險：安裝檔體積 +13~18MB（各平台）；build 流程新增網路依賴（npm registry）— offline build 需預先快取 binaries；無破壞性變更，解析鏈僅插入一層，既有 env override / PATH / npx 行為不變
