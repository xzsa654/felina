## 1. Windows `.cmd` 變體重試

- [x] 1.1 在 src-tauri/src/tokens/tokscale.rs 的 `run_tokscale_command` 路徑實作 Windows 限定的 `.cmd` 變體重試：spawn 裸命令名稱（無路徑分隔符、無副檔名）回 `NotFound` 時，以同名 `.cmd` 重試一次；以 `cfg(target_os = "windows")` guard，非 Windows 與含路徑分隔符的目標（含 `tokscale_bin` 明確覆寫）不重試。完成後 `tokscale.cmd` / `npx.cmd` shim 可被成功 spawn。驗證：`cargo test --lib`（tokens 範圍）通過且 1.2 的新測試覆蓋此行為。

## 2. 單元測試

- [x] 2.1 在 src-tauri/src/tokens/tokscale.rs 測試模組新增單元測試：(a) 裸名稱判定 — 無路徑分隔符且無副檔名的目標才產生 `.cmd` 變體候選；(b) 明確路徑（如 `/opt/bin/tokscale` 或含 `\` 的 Windows 路徑）不產生變體候選；(c) 既有 `explicit_tokscale_binary_override_uses_no_npx_fallback` 行為不變。驗證：cargo test --lib 全綠。

## 3. 文件對齊

- [x] 3.1 更新 docs/tokscale-backed-token-ingestion.md 的 binary 解析說明，補上 Windows `.cmd` shim 重試行為與解析順序表（tokscale → tokscale.cmd → npx → npx.cmd → missing_binary）。驗證：文件內容與 delta spec 的 Example 表一致（content review）。
