## Problem

在 Windows 上，使用者即使已透過 npm 全域安裝 tokscale（產生 `tokscale.cmd` shim），Token 分析的 tokscale 來源仍回報 `MissingBinary`、拿不到任何資料。npx fallback（`npx --yes tokscale@latest`）同樣失效，因為 Windows 的 npx 實際是 `npx.cmd`。

## Root Cause

`run_tokscale_command`（src-tauri/src/tokens/tokscale.rs）透過 `std::process::Command::new` 直接 spawn 程式名稱。Rust 的 `Command::new` 不經過 shell，在 Windows 上不會解析 `.cmd` / `.bat` shim，只會找 `.exe`。npm 全域安裝產生的 `tokscale.cmd` 與 Node 內附的 `npx.cmd` 都屬於 `.cmd` shim，因此 spawn 一律回 `NotFound`，adapter 走到 `MissingBinary` 終態。

## Proposed Solution

在 Windows 平台、且 spawn 目標是「裸程式名稱」（非使用者明確指定的完整路徑）時，若初次 spawn 回 `NotFound`，改以 `.cmd` 變體重試（例如 `tokscale` → `tokscale.cmd`、`npx` → `npx.cmd`）。實作收斂在 tokscale spawn 路徑（src-tauri/src/tokens/tokscale.rs 的 command 執行 helper），以 `cfg(target_os = "windows")` 明確 guard，macOS/Linux 行為不變。使用者透過 `tokscale_bin` 明確指定的路徑不做變體推測，維持現有「明確覆寫不走 fallback」語意。

## Non-Goals

- 不打包或散佈 tokscale binary（屬於後續 `bundle-tokscale-distribution` change）
- 不改動 fallback 鏈順序（explicit bin → PATH tokscale → npx）與 `MissingBinary` / `CommandFailed` 狀態語意
- 不處理 `commands/tokens.rs` 中 spawn `explorer` 的呼叫點（`explorer.exe` 不受 `.cmd` 問題影響）
- 不引入 shell 執行（不經 `cmd /C` 整串執行使用者輸入，避免注入面）

## Success Criteria

- Windows 上 npm 全域安裝 tokscale 的環境，token refresh 能成功取得 tokscale 資料（status 不再是 `missing_binary`）
- Windows 上只裝 Node（無 tokscale）的環境，npx fallback 能被實際執行
- tokscale 與 npx 都不存在時，仍回報 `MissingBinary`，行為與現況一致
- macOS/Linux spawn 行為完全不變
- 新增 Rust 單元測試涵蓋：裸名稱 NotFound 時嘗試 `.cmd` 變體、明確路徑不做變體重試
- `cargo test --lib` 通過（tokens 模組範圍）

## Impact

- Affected specs: `tokscale-backed-token-ingestion`（Modified — binary 解析需求補上 Windows `.cmd` shim 行為）
- Affected code:
  - Modified: src-tauri/src/tokens/tokscale.rs
  - New: （無）
  - Removed: （無）
- 依賴變動: 無新增 npm / Cargo 依賴
- 風險: 無破壞性變更；僅 Windows 平台新增重試路徑，與 `bundle-tokscale-distribution` 為前後置關係（本 change 先行）
