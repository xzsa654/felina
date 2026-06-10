## 1. Build pipeline — fetch script 與 bundle 設定

- [x] 1.1 新增 scripts/fetch-tokscale.mjs：頂部常數 `TOKSCALE_VERSION = "3.1.2"`；無參數時依當前平台推導 Rust target triple，`--target <triple>` 可覆寫；依 design D2 的 triple→npm 套件對照（x86_64-pc-windows-msvc → @tokscale/cli-win32-x64-msvc、aarch64-apple-darwin → @tokscale/cli-darwin-arm64、x86_64-apple-darwin → @tokscale/cli-darwin-x64，Linux triple 同樣支援）從 npm registry 下載 tarball、解出原生 binary、寫入 src-tauri/binaries/tokscale-<triple>(.exe)。冪等：目標檔已存在且版本 marker 符合即輸出 skip 訊息並 exit 0。失敗模式：registry 不可達且無既存檔 → exit 1 明確錯誤；tarball 無預期 binary → exit 1 並列出 tarball 內容。只用 Node 內建模組。（覆蓋 requirement: Fetch pinned binary from npm registry at build time）驗證：本機執行兩次 — 第一次下載成功並輸出寫入路徑，第二次輸出 skip；`--target` 指定 darwin triple 亦能下載
- [x] 1.2 [P] 新增 src-tauri/binaries/.gitignore（忽略目錄內所有 binary、保留 .gitignore 自身），並在 tauri.conf.json 加 `bundle.externalBin: ["binaries/tokscale"]`。（覆蓋 requirement: Bundle tokscale binary as a Tauri sidecar）驗證：git status 不出現 binaries 下的 binary 檔
- [x] 1.3 package.json 的 tauri build 前置鏈掛上 fetch script（beforeBuildCommand 或對應 npm script），確保 `npm run tauri build` 會先確保 sidecar 存在。驗證：刪除 binaries 後跑 build 前置鏈，binary 被自動補齊

## 2. Runtime — sidecar 解析層

- [x] 2.1 在 src-tauri/src/tokens/tokscale.rs 新增 `sidecar_tokscale_path() -> Option<PathBuf>`：`std::env::current_exe()` 同目錄 + 平台 EXE 後綴，檔案存在才回傳 Some；並將 sidecar 候選插入 `TokscaleCommandAdapter` 解析鏈 PATH 之後、npx 之前（僅在無 explicit override 時）。sidecar 執行失敗維持 `CommandFailed` 語意並繼續 npx fallback。（覆蓋 requirement: Resolve bundled sidecar tokscale binary）驗證：cargo test --lib（tokens 範圍）全綠
- [x] 2.2 新增單元測試：(a) 解析鏈候選順序 — 無 override 時候選依序為 PATH bin、sidecar（存在時）、npx；(b) sidecar 檔案不存在時候選列表與現狀一致；(c) explicit override 時不含 sidecar 候選。驗證：cargo test --lib 全綠且新測試覆蓋三情境

## 3. 文件與驗證

- [x] 3.1 更新 docs/tokscale-backed-token-ingestion.md：Binary Resolution 章節改為 5 步解析順序表（env override → PATH(+.cmd) → sidecar → npx(+.cmd) → missing_binary），補 sidecar 擺放位置與 TOKSCALE_VERSION pin 說明。驗證：內容與 delta spec 的 full resolution order Example 表一致（content review）
- [x] 3.2 Windows 端到端驗證：執行 npm run tauri build 產出安裝檔，確認安裝目錄含 tokscale.exe；在 PATH 無 tokscale 的環境啟動安裝版，Token page refresh 取得 tokscale 資料（status ok）。驗證：手動 assertion 記錄於 change notes（macOS 驗證留待有 mac 環境時補，記為 known gap）
