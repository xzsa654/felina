# Felina v1.0.0

**Multi-Agent Skill 管理桌面應用程式**

Felina 讓開發者在一個本機桌面介面中，集中管理、同步與共享 Claude Code、OpenAI Codex CLI、Gemini / Antigravity CLI 的 Skills。維護一份 canonical Skill 主檔，自動轉換並部署到各 Agent 的原生目錄。

---

## Highlights

### Multi-Agent Skill 中央管理
- 以 `~/.felina/skills/` 作為 canonical source，fan-out 至 Claude、Codex、Gemini / Antigravity 的原生 Skill 目錄
- 支援 Agent-specific 專有欄位（`x_claude_*`、`x_codex_*`、`x_gemini_*`），fan-out 時自動轉換
- Skill 建立、編輯、重新命名、刪除、匯入（ZIP / 單檔）與匯出
- Markdown 預覽、Split View 同步來源對照

### 可驗證的同步與衝突防護
- Push 前預覽實際變更與受影響 targets
- Drift Detection：偵測 Agent 端被外部修改的內容，顯示不同步狀態
- Pull Diff Preview：行級差異比對，確認後才寫回 canonical
- Local Snapshot：以本機 Git 記錄每次同步基準，支援差異回溯
- ZIP 匯入走 staging 流程，經比對與確認後才寫入 canonical store
- NoOp fast-path + 跨 Skill 並行 Push，減少不必要等待

### Skill Hub — 內部 Skill 社群市場 🆕
- 自管 Market Server（Node.js / Fastify + PostgreSQL + MinIO），部署於公司內網
- 從 Felina 一鍵發佈 canonical Skill 至 Hub
- 團隊成員可瀏覽、安裝 Hub 上的 Skill，安裝後自動寫入 canonical store 並透過 fan-out 同步
- 安裝前提供 Split View Markdown 預覽
- 認證機制：登入、JWT refresh token 自動續期、remember-me、Skill ownership 驗證
- 安全強化：CORS 白名單、API rate limiting、content hash 驗證、上傳大小限制、Docker non-root

### Projects 管理視角
- 彙整本機 Known Projects，從 Project 視角檢視各 Agent 的 Skill 與 Felina 納管狀態
- 同名 Skill 衝突解決、既有 canonical Skill 連結
- 跨平台路徑正規化

### Token Analytics 與 History
- 掃描本機 Agent CLI Token / Session 資料
- 時間、模型、Project、Session 層級分析
- Token Dashboard、History 與 Session transcript 檢視
- 資料保留於本機，不上傳至遠端

### 桌面體驗
- System Tray 常駐，關閉視窗隱藏至系統匣
- Single-instance 保護，防止重複開啟
- Windows 環境不彈出 subprocess CMD 視窗
- 可調整面板、可拖曳排序側邊欄
- 英文 / 繁體中文介面（i18n）
- Light / Dark mode

---

## 技術棧

| 層級 | 技術 |
|---|---|
| Desktop Shell | Tauri v2 |
| Frontend | React 19 · TypeScript strict · Tailwind CSS v4 · Zustand · TanStack Query |
| Backend | Rust · git2 (libgit2) · similar · Rayon · SQLite |
| Market Server | Node.js / Fastify · PostgreSQL · MinIO · Docker |

---

## 安裝

| 檔案 | 說明 |
|---|---|
| `Felina_1.0.0_x64_en-US.msi` | Windows Installer（建議） |
| `Felina_1.0.0_x64-setup.exe` | NSIS 安裝程式 |

**系統需求：** Windows 10 / 11（x64）

> Skill Hub 功能需另行部署 Market Server，詳見 `market-server/` 目錄。不部署 Market Server 時，所有本機功能（Skill 管理、同步、Token Analytics）均可正常使用。

---

## License

AGPL-3.0
