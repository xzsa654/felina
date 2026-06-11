# Milestones

已完成功能與重要變更的時序紀錄。項目自 `ideas-backlog.md` 開發完成後移入此處。

Schema: `~/.claude/skills/project-knowledge/schema/milestones.md`

---

## Installer / Distribution

### tokscale-windows-cmd-resolution-fix

| Field | Value |
|---|---|
| completed | 2026-06-10 |
| origin | backlog |
| spec | tokscale-windows-cmd-resolution-fix |
| description | 修復 Windows 上 `std::process::Command` 不解析 `.cmd` shim，導致 npm 安裝的 tokscale 與 npx fallback 失效、Token 分析拿不到 tokscale 資料的問題。 |

Key decisions:
- 裸命令名稱（無路徑分隔符、無副檔名）spawn 回 NotFound 時以 `.cmd` 變體重試一次；明確路徑（`FELINA_TOKSCALE_BIN` / `tokscale_bin` override）永不變體重試
- 不經 shell 執行，避免注入面；非 Windows 平台行為不變
- 解析順序：tokscale → tokscale.cmd → npx → npx.cmd → missing_binary

Impact:
- `src-tauri/src/tokens/tokscale.rs`（`cmd_variant` helper + `run_tokscale_command` 重試）
- `openspec/specs/tokscale-backed-token-ingestion/spec.md`（新增 Windows command shim 解析需求）
- `docs/tokscale-backed-token-ingestion.md`（Binary Resolution 章節）

### bundle-tokscale-distribution

| Field | Value |
|---|---|
| completed | 2026-06-10 |
| origin | backlog |
| spec | bundle-tokscale-distribution |
| description | 讓未安裝 tokscale 的使用者開箱即用：Tauri build 時從 npm registry 抓取平台原生 tokscale binary 打包為 sidecar，安裝後與主程式同目錄。Runtime 解析鏈擴充為 5 步（env override → PATH → sidecar → npx → missing_binary）。 |

Key decisions:
- `bundle.externalBin` 而非 `resources`（Tauri 原生 sidecar 機制，自動處理 triple 命名與簽章）
- Build script 從 npm registry 抓 tarball 而非 commit binary 進 repo（~18MB/平台不適合 git）
- 版本 pin 於 script 常數 `TOKSCALE_VERSION`（不追 latest，build 可重現）
- `current_exe()` 同目錄解析 sidecar，不依賴 Tauri AppHandle（tokens 模組無 AppHandle）
- PATH 優先於 sidecar（使用者自裝版本通常較新）
- `TokscaleCommandAdapter` 從 primary+fallback 重構為 `candidates: Vec<Candidate>` 鏈式解析

Impact:
- 新增 `scripts/fetch-tokscale.mjs`、`src-tauri/binaries/.gitignore`
- 修改 `tokscale.rs`（candidates 重構 + sidecar 解析）、`tauri.conf.json`、`package.json`
- `openspec/specs/tokscale-sidecar-distribution/spec.md`（新增 capability）
- `openspec/specs/tokscale-backed-token-ingestion/spec.md`（+1 requirement）
- 安裝檔體積 +13~18MB（各平台）
