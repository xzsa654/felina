## Context

Felina 桌面 app 的 token analytics 模組在後端使用外部 CLI 工具：
- `ccusage.rs`：透過 `Command::new("curl")` 呼叫 Anthropic OAuth/Usage API（取得 quota snapshot）
- `tokscale.rs`：透過 `Command::new("cmd").arg("/C").arg(bin)` 執行 tokscale 外部工具
- `tokens.rs` 的 `reveal_path`：透過 `Command::new("explorer")` 開啟檔案總管

Windows GUI app spawn 子程序時，若未設 `CREATE_NO_WINDOW` (0x08000000) flag，會為每個子程序建立 console window。專案已有 `reqwest` dependency（async HTTP client with blocking feature），可取代 curl。

## Goals / Non-Goals

**Goals:**

- 消除所有 Windows CMD 彈窗（Token 頁載入、Session History 點擊）
- 移除 ccusage 對外部 curl 二進位的依賴
- 維持 macOS / Linux 行為不變

**Non-Goals:**

- 不改 Tauri command 簽名或前端呼叫方式
- 不重構 ccusage 資料型別（`QuotaSnapshot`、`UsageResponse` 等）
- 不改善 tokscale missing binary 的 UX

## Decisions

1. **ccusage curl → reqwest**：使用 `reqwest::blocking::Client`（ccusage 已在 `spawn_blocking` 內執行，不需 async runtime），設定 `timeout(Duration::from_secs(8))` 對齊原 curl `--max-time 8`。HTTP status code 直接從 response 取，不需 parse stdout。

2. **Windows CREATE_NO_WINDOW helper**：建立一個共用 helper `fn no_window_command(program: &str) -> Command`，在 Windows 上設定 `creation_flags(0x08000000)`，其他平台直接 `Command::new(program)`。放在 `src-tauri/src/tokens/mod.rs` 或一個小的 util 位置。`tokscale.rs` 和 `tokens.rs` 的 reveal_path 都使用此 helper。

3. **tokscale 去掉 cmd /C**：直接 `Command::new(bin)` 就能執行 .exe，不需 cmd wrapper。

4. **macOS keychain 讀取保留 Command**：`ccusage.rs` 中 macOS 的 `Command::new("security")` 呼叫不在 Windows 上執行（有 `cfg!(target_os = "macos")` guard），不需修改。

## Implementation Contract

**Behavior：**
- Token 頁載入時不再彈出 CMD 視窗
- Session History 的 reveal transcript 不再彈出額外 CMD 視窗
- HTTP 請求行為（timeout、header、endpoint）與原 curl 完全一致
- tokscale 子程序執行結果不變

**Interface / data shape：**
- `get_quota_snapshot_cached` 回傳型別不變（`Option<QuotaSnapshot>`）
- `reveal_path` 簽名不變
- `run_tokscale_command` 簽名不變，回傳 `std::io::Result<Output>`

**Failure modes：**
- reqwest 網路錯誤 → 與原 curl 失敗同樣回傳 None / error string
- tokscale binary 不存在 → 與現有 `MissingBinary` 狀態一致
- explorer 開啟失敗 → 與現有 error propagation 一致

**Acceptance criteria：**
- `cargo check` 通過，零 warning
- `cargo test --lib -p felina` 既有 token 相關測試全過
- Windows 上 `npm run tauri build` 後安裝 app，點擊 Token 頁和 Session History 不彈 CMD 視窗
- macOS build 不受影響（`cfg` guard 正確）

**Scope boundaries：**
- In scope：`ccusage.rs` 全部 curl 呼叫、`tokscale.rs` 的 `run_tokscale_command`、`tokens.rs` 的 `reveal_path`
- Out of scope：前端、i18n、Tauri command 註冊、任何新 feature

## Risks / Trade-offs

- **reqwest blocking vs async**：ccusage 跑在 `spawn_blocking` 內，用 `reqwest::blocking` 是正確選擇。若未來要改為 async 呼叫需另行重構。
- **curl 行為差異**：curl 會自動跟隨 redirect，reqwest blocking 預設也會。需確認 `redirect(Policy::limited(10))` 或使用預設。
- **測試覆蓋**：ccusage 的 HTTP 行為無法在 unit test 驗證（需真實 API token），依賴手動 e2e。
