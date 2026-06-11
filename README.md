# Felina

Felina 是給 agent CLI 使用者的本機桌面控制台。它把散落在不同 agent 工具與專案目錄裡的 skills、設定、專案綁定與使用紀錄，收斂成一個可以檢視、編輯、同步與追蹤的桌面 App。

Felina 目前聚焦在 Anthropic Claude Code、OpenAI Codex CLI、Google Gemini / Antigravity CLI 的 multi-agent skill 管理。長期方向是成為 local agent control plane：Skills 是第一個落地的 capability kind，後續可延伸到 hooks、subagents、workflows、MCP tools、prompt templates、policy packs 等 agent 能力。

## 適合誰

- 已經在使用 Claude Code、Codex CLI、Gemini CLI 或 Antigravity CLI 的開發者。
- 需要在多個 project 之間管理 agent skills 的團隊或個人。
- 不想手動維護多份 `SKILL.md`、agent-native 目錄與同步狀態的人。
- 想用本機工具檢視 token/session 使用情況，而不是把資料送到遠端服務的人。

## 解決的問題

Agent CLI 的設定與 extension 檔案通常分散在不同位置：

- Claude Code 使用 `.claude/skills/`。
- Codex CLI 使用 `.agents/skills/` 與相關 Codex 設定。
- Gemini / Antigravity CLI 使用 `.gemini/skills/` 或相容目錄。
- 不同 project 可能各自有不同版本、不同同步狀態與同名 skill 衝突。

Felina 的核心想法是：使用者在 Felina 的 canonical store 編輯一次，再由 App 依照各 agent 的 native format fan-out 到對應位置。

## 核心能力

### Skills

- 以 `~/.felina/skills/` 作為 canonical skill master。
- 編輯、修復、刪除與同步 canonical skills。
- 從 agent-native skill directories 匯入既有 skills。
- 將同一份 canonical skill fan-out 到 Claude、Codex、Gemini / Antigravity。
- 依 target 管理 global / project scope、enabled 狀態與 tracked/detached 模式。
- 顯示 coverage matrix，快速看出每個 skill 已同步到哪些 agent / project。

### Projects

- 管理 Known Projects 清單。
- 查看 project-local agent skill presence。
- 從 project 視角理解哪些 skills 已被 Felina 納管、哪些仍只是 agent-native 檔案。
- 對不存在的 project path 提供可見狀態，而不是靜默失效。

### Tokens 與 History

- 掃描本機 agent CLI session / token 使用資料。
- 以 dashboard 檢視每日、模型、project、session 層級的使用情況。
- 從 token summary 連到 History，檢視對應 session。
- 這些資料保留在本機，不需要 server 或 telemetry。

### Settings、Memory、Templates

- 提供 Claude Code 相關設定與 memory 檔案的視覺化管理介面。
- 提供可重用 templates，降低建立新設定或 skill 的成本。
- 這些頁面仍是 local-file-first 的桌面工具，不依賴遠端帳號。

## 設計原則

- **Local-only**：Felina 讀寫本機檔案；沒有 server、沒有 telemetry。
- **Respect native formats**：每個 agent 的輸出仍寫回它自己的原生格式與目錄。
- **Canonical first**：使用者編輯的主檔在 `~/.felina/skills/`，agent-native 目錄是 fan-out output。
- **Explicit sync**：同步、覆蓋、刪除與衝突處理應讓使用者看得見，不靠隱性背景魔法。
- **Capability-general direction**：目前先把 Skills 做完整，但架構避免把 Felina 鎖死成 skill-only editor。

## Screenshots

<p align="center">
  <img src="screenshots/skills.png" width="800" alt="Felina Skills page">
  <br><em>Skills — canonical skills, targets, sync state, and coverage</em>
</p>

<details>
<summary>View more screenshots</summary>

<p align="center">
  <img src="screenshots/settings.png" width="800" alt="Felina Settings page">
  <br><em>Settings — local agent configuration management</em>
</p>

<p align="center">
  <img src="screenshots/memory.png" width="800" alt="Felina Memory page">
  <br><em>Memory — local project memory browser and editor</em>
</p>

</details>

## 開發

### Requirements

- Node.js 18+
- npm
- Rust toolchain
- Tauri v2 prerequisites for your platform

### Setup

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` 會啟動完整 Tauri App。只執行 `npm run dev` 只會啟動 Vite，呼叫 Tauri commands 的頁面無法完整運作。

#### Token Analytics 的 tokscale

Token 儀表板需要 `tokscale` 來擷取使用數據。Felina 依照以下順序尋找 `tokscale`：

1. `FELINA_TOKSCALE_BIN` 環境變數指定的絕對路徑（設定後獨佔使用，不 fallback）
2. `PATH` 中的 `tokscale` 指令（Windows 含 `.cmd` 變體重試）
3. 主程式同目錄的 sidecar binary（安裝版隨 bundle 內建）
4. `npx --yes tokscale@latest` 作為 fallback

**通常不需要任何設定**：安裝版會命中內建的 sidecar；開發環境中 `tokscale` 已列為 devDependency，`npm install` 後位於 `node_modules/.bin/tokscale`，PATH 找不到時 npx fallback 也能接手。

**進階 — `FELINA_TOKSCALE_BIN` override**

只在需要強制使用特定版本或本地 build 的 tokscale 時才設定。指定的路徑必須有效 — 設定後不會 fallback 到其他來源。

macOS / Linux：

```bash
export FELINA_TOKSCALE_BIN="$PWD/node_modules/.bin/tokscale"
```

Windows (PowerShell)：

```powershell
$env:FELINA_TOKSCALE_BIN = "$PWD\node_modules\.bin\tokscale.cmd"
```

> 注意：環境變數只對「從該 shell 啟動的程序」生效（例如 `npm run tauri dev`）。從 Finder / 開始選單啟動的安裝版 GUI 不會繼承 shell 環境，對其設定 env var 不會生效 — 安裝版請直接依靠內建 sidecar。

### Useful Commands

```bash
npm run check
npm run build
npm run tauri build
spectra list
spectra validate
spectra analyze
```

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri v2 |
| Frontend | React 19, TypeScript strict mode, React Router |
| State | Zustand |
| Styling | Tailwind CSS v4 |
| Backend | Rust Tauri commands |
| Package manager | npm |

## Architecture Notes

- Frontend code lives in `src/`.
- Backend commands live in `src-tauri/src/commands/`.
- Frontend-to-backend calls go through typed wrappers in `src/lib/tauri/commands.ts`.
- Active frontend pages are defined in `src/router.tsx`.
- Active backend commands must be registered through `src-tauri/src/commands/mod.rs` and `src-tauri/src/lib.rs`.
- Path identity and project path normalization should use the shared helpers instead of ad hoc string comparison.

## Repository Workflow

Felina uses Spectra for spec-driven development:

- Specs live in `openspec/specs/`.
- Active change proposals live in `openspec/changes/`.
- Completed changes are archived under `openspec/changes/archive/`.
- Product roadmap items live in `.knowledge/ideas-backlog.md` until they become Spectra changes.

## License

[AGPL-3.0](LICENSE)
