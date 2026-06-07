## Why

打包後的 Felina 桌面 app 在 Windows 上，Token 頁首次載入和 Session History 點擊時會彈出多個 CMD 黑色視窗。根因是後端使用 `Command::new("curl")` 和 `Command::new("cmd").arg("/C")` 呼叫外部程序，Windows GUI app spawn 子程序時預設會建立 console window。此外，依賴外部 curl 二進位檔是脆弱的——使用者機器不保證有 curl，且引入 PATH hijacking 風險。

## What Changes

- `ccusage.rs`：所有 `Command::new("curl")` HTTP 呼叫替換為 `reqwest` async HTTP client（專案已有此 dependency）
- `tokscale.rs`：移除 `cmd /C` wrapper，直接 `Command::new(bin)`，Windows 上加 `CREATE_NO_WINDOW` creation flag
- `tokens.rs` 的 `reveal_path`：Windows 上 `Command::new("explorer")` 加 `CREATE_NO_WINDOW` creation flag

## Non-Goals

- 不改 Tauri command API contract（前端呼叫方式不變）
- 不改 macOS / Linux 行為邏輯
- 不重構 ccusage 的資料結構或錯誤型別
- 不處理 tokscale binary 不存在的 UX 改善（已有 `MissingBinary` 狀態處理）

## Capabilities

### New Capabilities

（none）

### Modified Capabilities

- `token-analytics-api`：後端 HTTP 實作從外部 curl 改為 reqwest，移除對外部二進位的依賴；子程序呼叫加 `CREATE_NO_WINDOW` 消除 GUI app 彈窗

## Impact

- Affected specs: `token-analytics-api`（實作方式變更，行為不變）
- Affected code:
  - Modified: `src-tauri/src/tokens/ccusage.rs`, `src-tauri/src/tokens/tokscale.rs`, `src-tauri/src/commands/tokens.rs`
- 無新增依賴（`reqwest` 已在 Cargo.toml）
- 無破壞性變更
- 風險：ccusage 的 curl → reqwest 改動幅度較大，需確保 HTTP header/timeout/status-code 解析行為一致
