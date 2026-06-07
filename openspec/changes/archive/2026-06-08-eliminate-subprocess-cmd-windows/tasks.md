## 1. CREATE_NO_WINDOW 共用 helper

- [x] 1.1 建立 `no_window_command(program: &str) -> Command` helper，Windows 上設定 `creation_flags(0x08000000)`，非 Windows 直接 `Command::new(program)`。放在 `src-tauri/src/tokens/mod.rs`（或 `src-tauri/src/util.rs` 若已存在）。驗證：`cargo check` 通過，helper 為 `pub(crate)`。

## 2. ccusage curl → reqwest

- [x] [P] 2.1 將 `ccusage.rs` 中 Anthropic OAuth/Usage API 的 `Command::new("curl")` 呼叫替換為 `reqwest::blocking::Client`，保留 timeout 8 秒、Authorization header、anthropic-version header。回傳型別不變。驗證：`cargo check` 通過，`ccusage.rs` 中不再有 `Command::new("curl")`。
- [x] [P] 2.2 將 `ccusage.rs` 中取得 organization members 的 curl 呼叫替換為 reqwest。驗證：同 2.1。
- [x] [P] 2.3 將 `ccusage.rs` 中取得 usage breakdown 的 curl 呼叫替換為 reqwest。驗證：同 2.1。
- [x] 2.4 確認 macOS keychain `Command::new("security")` 呼叫保持不變（有 `cfg!(target_os = "macos")` guard）。驗證：程式碼審查確認 security 呼叫未被修改。

## 3. tokscale 去 cmd /C + CREATE_NO_WINDOW

- [x] 3.1 `tokscale.rs` 的 `run_tokscale_command`：Windows 分支從 `Command::new("cmd").arg("/C").arg(bin)` 改為 `no_window_command(bin)`（直接執行 exe）。驗證：`cargo check` 通過，`run_tokscale_command` 中無 `cmd /C`。

## 4. reveal_path CREATE_NO_WINDOW

- [x] [P] 4.1 `tokens.rs` 的 `reveal_path`：Windows 分支的 `Command::new("explorer")` 改用 `no_window_command("explorer")`。驗證：`cargo check` 通過。

## 5. 整合驗證

- [x] 5.1 `cargo test --lib -p felina` 全部通過，無新增 warning。驗證：CI 等級 test pass。
- [x] 5.2 Windows 上 `npm run tauri build` 後安裝 app，點擊 Token 頁不彈 CMD 視窗。驗證：手動 e2e。
- [x] 5.3 點擊 Session History 的 reveal transcript 不彈額外 CMD 視窗。驗證：手動 e2e。
