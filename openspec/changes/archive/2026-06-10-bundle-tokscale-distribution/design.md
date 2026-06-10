## Context

Felina 的 Token 分析依賴外部 CLI tokscale。現有 binary 解析鏈（`tokscale-windows-cmd-resolution-fix` 後）：`FELINA_TOKSCALE_BIN` env override → PATH 上的 tokscale（Windows 含 `.cmd` 變體重試）→ `npx --yes tokscale@latest`（Windows 含 `npx.cmd` 重試）→ `missing_binary`。安裝版終端使用者通常沒有 tokscale 也沒有 Node，整條鏈走到底落空。

前提調查（2026-06-10，記錄於 .knowledge/ideas-backlog.md 條目）：tokscale 全鏈 MIT license 可 redistribute；npm 有官方 8 平台原生 binary 套件 `@tokscale/cli-<platform>`；體積 win32-x64 ~17.8MB、darwin-arm64 ~13.2MB、darwin-x64 ~14.7MB。

關鍵程式事實：`ingest_with_default_adapter`（src-tauri/src/tokens/tokscale_ingestion.rs）沒有 Tauri AppHandle，sidecar 路徑解析不能依賴 `tauri::Manager` API。

## Goals / Non-Goals

**Goals:**

- 安裝版使用者（無 tokscale、無 Node）開箱即可取得 tokscale 資料
- Windows / macOS 安裝檔均內含對應平台 binary
- 既有解析鏈行為（env override、PATH、npx）完全不變，sidecar 僅是插入一層
- dev 模式（`npm run tauri dev`、`cargo test`）在 sidecar 不存在時不受影響

**Non-Goals:**

- 不做 app 內 tokscale 獨立更新（版本 pin 在 build script，隨 Felina release 走）
- 不做 on-demand 下載（已於 2026-06-10 討論淘汰：sidecar 體積可接受，不值得引入下載/校驗複雜度）
- 不做安裝器 optional checkbox / 寫 User PATH（已淘汰：單平台、雙 script 維護、動使用者系統）
- 不讓使用者從 terminal 呼叫 bundled tokscale（binary 只供 Felina 內部使用）
- Linux 打包驗證（bundle targets 含 Linux，但本 change 只驗證 Windows + macOS；fetch script 仍支援 Linux triple）

## Decisions

**D1 — Tauri `bundle.externalBin` 而非 `resources`**：externalBin 是 Tauri 對「隨附執行檔」的原生機制，bundler 自動處理 target-triple 命名、簽章（macOS）與安裝目錄擺放（與主程式同目錄）。resources 需自行處理執行權限與路徑差異。

**D2 — Build 前置 script 從 npm registry 抓 binary，而非 commit 進 repo 或 CI artifact**：binary ~18MB/平台不適合進 git；npm registry 是 tokscale 官方散佈通道（GitHub release 無 assets）。script 寫成冪等：目標檔已存在且版本符合即跳過，支援 offline rebuild。下載後解 tarball 取出 binary，重新命名為 `tokscale-<target-triple>(.exe)` 放入 src-tauri/binaries/（gitignored）。

**D3 — 版本 pin 於 script 常數**：`TOKSCALE_VERSION` 寫死在 fetch script 頂部。升級 = 改一行 + 重新 build。不追 latest，避免 build 不可重現。

**D4 — Runtime sidecar 解析用 `std::env::current_exe()` 同目錄，不用 Tauri API**：解析發生在 tokens 模組（無 AppHandle 可用），且 externalBin 安裝後就在主程式同目錄。`current_exe().parent().join("tokscale" + EXE_SUFFIX)`，檔案存在才採用。dev 模式該檔不存在 → 自然跳過，鏈行為同現狀。

**D5 — 解析順序：PATH 先於 sidecar**：使用者自裝的 tokscale 通常較新；bundled 版本不應蓋掉。順序：env override → PATH（含 .cmd）→ sidecar → npx → missing_binary。

**D6 — fetch script 掛在 beforeBuildCommand 鏈**：package.json 的 build script 前置執行 `node scripts/fetch-tokscale.mjs`，只用 Node 內建模組（https、zlib、fs）— npm tarball 是 gzip tar，自行實作最小 tar 解包（只需取單一檔案）。不新增 devDependency。

## Implementation Contract

**Behavior**

- 安裝版 Felina 在無 tokscale、無 Node 的機器上，Token page refresh 後 tokscale 來源 status 為 ok 且有資料（驗證：安裝檔裝進乾淨環境手動驗證，或檢查 stderr log 顯示採用 sidecar 路徑）
- 使用者 PATH 上有 tokscale 時，優先使用 PATH 版本，sidecar 不啟用（驗證：單元測試 — 解析順序候選列表）
- dev 模式 sidecar 檔案不存在時，解析鏈與現狀完全一致（驗證：既有 tokscale 測試全綠且無行為變更）
- `npm run tauri build` 在 binaries 缺失時自動下載；已存在且版本符合時跳過下載（驗證：連續執行兩次 fetch script，第二次輸出 skip 訊息）

**Interface / data shape**

- fetch script：`node scripts/fetch-tokscale.mjs [--target <rust-triple>]`，無參數時依當前平台推導 triple；成功 exit 0 並輸出寫入路徑，失敗 exit 1 並輸出 npm registry 錯誤
- `tauri.conf.json`：`bundle.externalBin: ["binaries/tokscale"]`
- Rust：tokscale.rs 新增 sidecar 候選解析（函式名建議 `sidecar_tokscale_path() -> Option<PathBuf>`，回傳存在的檔案路徑），插入 `TokscaleCommandAdapter` 的 fallback 鏈 PATH 之後 npx 之前
- 版本 pin：fetch script 頂部常數 `TOKSCALE_VERSION`（初值 `3.1.2`）

**Failure modes**

- npm registry 不可達且 binaries 不存在 → build fail with明確錯誤訊息（不產出缺 sidecar 的安裝檔）
- sidecar 檔案存在但執行失敗 → 維持既有 `CommandFailed` 語意，繼續走 npx fallback 不中斷
- 下載的 tarball 無預期 binary 路徑 → script exit 1 並列出 tarball 內容

**Scope boundaries**

- In scope：fetch script、tauri.conf.json externalBin、Rust 解析鏈插層、package.json build 鏈、docs 更新、單元測試
- Out of scope：Linux 打包驗證、app 內版本更新 UI、tokscale 版本升級自動化、安裝器 UI 變動

## Risks / Trade-offs

- 安裝檔體積 +13~18MB — 已於討論接受（桌面 app 可接受增量）
- Build 新增網路依賴 — D2 冪等設計緩解：binaries 已存在即 offline 可 build
- macOS 簽章：externalBin 由 Tauri bundler 處理 codesign；若未配置簽章身分，行為與主程式一致（同樣未簽），不額外惡化
- tokscale CLI 介面變動風險：版本 pin（D3）確保 build 可重現；升級時跑既有整合測試驗證 JSON schema 相容
