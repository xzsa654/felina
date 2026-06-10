# Ideas Backlog

產品功能的規劃池。從模糊構想到可執行的 change 都可以放，隨著前一個 change 的開發逐漸讓後續規劃清晰化。項目正式進入開發時，透過 Spectra 立 change，完成後移至 `milestones.md`。

Schema: `~/.claude/skills/project-knowledge/schema/ideas-backlog.md`

---

## Product Direction

### capability-registry-control-plane

| Field | Value |
|---|---|
| type | umbrella-direction |
| status | active-direction |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Felina 定位為 local agent control plane，不只是 skill editor。Skills 是第一個落地的 capability kind，架構應避免 skill-only dead ends。 |

Near-term strategy:
- Skills 先做完作為 capability system 的 reusable template。
- Phase 1.5 / Phase 2 skill-sync 順序不動。
- 新 capability family 上線前先用 vendor docs 驗證，同 `agent-skills-schema` 模式。

Architecture note:
- Model toward `Capability`, `Artifact`, `RuntimeBinding`, `ExecutionRecord`，目前只暴露 `kind=skill`。
- Future `Capability.kind` candidates: `skill`, `hook`, `subagent`, `workflow`, `mcp-tool`, `prompt-template`, `policy-pack`。
- Agent capability research: `.session/agent-capability-research.md`。

---

<!-- Phase 1.5 — Target Freedom Sequence: completed 2026-05-26; all items archived. -->

---

## Phase 2 — Skill Sync Advanced

### forked-target-overlay

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-06-09 |
| description | Per-target 客製化：canonical 推到某 project 後，使用者手改的部分自動與未來主檔更新進行 3-way merge 保留。目前尚未出現明確的客製化 skill 需求，待觀察。 |

Design route (2026-05-28 discuss 定案, 2026-05-29 更新, 2026-05-30 補齊前置):
- 採用行級字串合併 (Git-style Diff)，廢棄「整段替換格式」的 MVP 構想。
- 底層使用 Rust `git2` (libgit2) crate 進行 `git2::Merge::merge_file`。
- 若發生合併衝突，由 `git2` 產生標準 `<<<<<<<` 標記，並在前端實作 Conflict Resolution UI 供使用者決策。
- 依賴 `local-versioning-and-snapshot-layer`（已完成 2026-05-29）提供的 Base Snapshot 作為 3-way merge 的基礎。
- `pull-diff-preview`（已完成 2026-05-29）提供了 `similar` crate 行級 diff + inline diff viewer + `PullConfirmDialog` diff 渲染元件，可直接複用於 Conflict Resolution UI。
- `sibling-drift-detection`（已完成 2026-05-29）擴展 drift 偵測至 sibling 檔案，提供 per-target sibling hash map baseline。
- `sibling-pull-sync`（已完成 2026-05-29）擴展 pull 流程支援 sibling 檔案同步回 canonical，含衝突處理策略選擇。
- `sibling-push-cleanup`（已完成 2026-05-30）push 時清除 canonical 已移除的孤兒 sibling。
- `skill-fork-preview`（已完成 2026-06-09）fork activation、ForkStatus 四態分類、ForkPreviewDialog（Preview/Raw/Diff 三 tab）。
- 拆分為兩階段：Part 1 pull-diff-preview ✅ → Part 2 forked-target-overlay（本項）。

Notes:
- 2026-05-30 討論：針對 per-project 進行客製化 skill 的頻率很低，此 item 暫定不一定會施作（但前置的 git diff 相關機制已完成）。

<!-- local-versioning-and-snapshot-layer: archived 2026-05-29, removed per backlog rules -->

### skill-export-validation-pipeline

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-06-09 |
| description | Fan-out 匯出時搭配各 agent 官方 skill 驗證工具做品質檢查，補強現有 YAML schema 驗證。同時涵蓋各 agent 建立 skill 時的路徑規範參考。 |

Notes:
- Codex 有官方 skill 驗證腳本：`C:/Users/A11410004/.codex/skills/.system/skill-creator/scripts/quick_validate.py`
- Gemini 有 skill-creator 內建規範：`C:/Users/A11410004/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/builtin/skill-creator/SKILL.md`
- Codex 建立 skill 的路徑參考（來自 Codex skill-creator 規範）：
  - Workspace: `<project>/.codex/skills/{skill_name}/SKILL.md`
  - Global: `~/.codex/skills/{skill_name}/SKILL.md`
- Gemini 建立 skill 的路徑參考（來自 Gemini skill-creator 規範）：
  - Workspace: `<project>/.agents/skills/{skill_name}/SKILL.md`
  - Global: `~/.gemini/antigravity-cli/skills/{skill_name}/SKILL.md`
  - Shared: `~/.gemini/skills/{skill_name}/SKILL.md`
- Schema 驗結構，官方腳本驗內容規範，兩者互補。

### third-party-agent-path-configuration

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-28 |
| last-seen | 2026-06-09 |
| description | 使用者可透過 Felina Settings 手動新增無限多組第三方 agent 的路徑 (Global / Project)，使其成為動態 Map 支援。 |

Design route (2026-05-28 discuss 定案):
- 將後端的 `AgentPathsConfig` 從寫死三家改為動態 HashMap。
- 這些手動新增的第三方 Agent 預設採用標準 YAML 結構匯出，不帶有特定代理的專屬欄位。
- 實作極輕量化：單純負責將 Canonical 檔案轉存到指定的路徑。

Notes:
- 2026-05-30 討論：這屬於可添加的加分項，不影響主要施作方向，但優先度略高於其他 suggestion。

### dynamic-agent-field-catalog

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-06-09 |
| description | 將各家 Agent 的特有 YAML 欄位定義下放至 Felina Settings，讓進階使用者能自行擴充，不再寫死於程式碼。 |

Scope:
- 取代爬蟲或靜態程式碼定義，將 Custom Field Mapping 的權限交給使用者。
- 讓第三方 Agent（如 OpenCode）也能透過 UI 設定獲得專屬欄位的支援。
- 作為 `third-party-agent-path-configuration` 之後的進階客製化功能。

### os-level-file-watcher-sync

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-01 |
| last-seen | 2026-06-09 |
| description | 導入 Rust `notify` 實作 OS-level 檔案監控，取代前端綁定視窗 focus 的輪詢，達成外部修改「即時且零效能浪費」的無縫同步體驗。 |

Scope:
- 在 Tauri 後端啟動時，註冊監聽 `~/.felina/skills/` 及已追蹤專案的 agent 目錄。
- 外部編輯器修改檔案時，透過 Tauri Event 即時推播給前端。
- 前端解除 window focus 與 visibilitychange 綁定的全域重整，改由 Event 觸發局部資料刷新（搭配 SWR 模式確保體驗順滑）。

<!-- push-commit-noop-fastpath-and-parallel: archived 2026-06-04, removed per backlog rules -->

---

## Phase 3 — Skill Community

### skill-marketplace

| Field | Value |
|---|---|
| type | umbrella-direction |
| status | active-direction |
| flagged | 2026-05-20 |
| last-seen | 2026-06-09 |
| blocked-by | — |
| description | 公司內部 Skill Hub（原 marketplace）。Hub MVP 已上線：publish / install / auth / server hardening / storage ops 均完成。本 umbrella 追蹤 Hub 後續增強方向。 |

已完成的 Hub 基礎（均已 archived）:
- `local-skill-market-prototype`（2026-06-05）— Hub 原型 + 卡片牆 + 安裝流程
- `hub-publish-enablement`（2026-06-05）— Publish + tar.gz 上傳
- `hub-install-import-parity-and-preview`（2026-06-05）— Install preview
- `market-server-url-settings`（2026-06-05）— Server URL 設定
- `hub-auth-install-safety`（2026-06-08）— Auth（register/login/JWT）+ install safety（hash diff confirm）
- `market-server-security-hardening`（2026-06-08）— CORS / rate limit / password policy / container user
- `market-server-auth-lifecycle`（2026-06-08）— Refresh token rotation / server-side isOwner
- `market-server-container-ops`（2026-06-08）— Graceful shutdown / DB pool / independent migration
- `market-server-storage-ops`（2026-06-08）— MinIO service account / orphan cleanup / private bucket policy

後續增強方向（各自立 change）:
- `hub-discoverability`（已在 backlog，planned）— 搜尋 / 排序 / 詳細頁 / skeleton / retry UX
- Package identity / versioning / install conflict resolution
- SSO / Microsoft Entra ID 整合（schema 已預留 author 欄位，升級路徑：JWT → OAuth verified）
- Server adapter contract（抽象化 server 介面，支援不同部署環境）

Notes:
- 不採用獨立 `skill.json` 作為 Felina marketplace 的核心 source；若需要額外 metadata，應放在 marketplace manifest，並以 canonical Skill 為 source of truth。
- Server stack 已採用 Node.js/Fastify + PostgreSQL + MinIO，部署於公司內網 Docker 環境。
- 詳細調查文件：`.session/agent-skill-market-complete.md`。

<!-- hub-install-safety-and-author-attribution: archived 2026-06-08, removed per backlog rules -->

### hub-discoverability

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-06-05 |
| last-seen | 2026-06-09 |
| blocked-by | — |
| description | Hub 從「能用」進化到「找得到 + 看得懂 + 敢裝」：搜尋 / 過濾 / 排序、skill 詳細頁（顯示完整 description、SKILL.md 預覽、author/updated_at/version 顯眼化）、loading skeleton、server 連線失敗的 retry UX。|

Scope:
- Hub 列表加搜尋欄（name + description fuzzy match，先做 client-side，skill 量 < 200 都夠）
- Hub 列表加排序（最近更新 / name / author）
- Skill 詳細頁路由（點 card 進去看完整內容）
- 詳細頁顯示 SKILL.md 預覽（讀 server 給的 tar.gz 解壓後 render）
- 顯眼化 publish date（「alice 3 天前更新」）
- Loading skeleton 取代 spinner
- Server unavailable 時 retry 按鈕 + 上次成功 cache 的列表（offline read-only fallback，optional）

Notes:
- 搜尋先 client-side；要 server-side search 是 skill 規模 > 500 才考慮，到時拆獨立 change
- 不在這個 change 做：tag / category / collection / rating / download count — 等使用者實際反映需求再加
- Loading skeleton 跟 retry UX 屬於 cross-cutting polish，跟主要功能一起做不獨立切 change

---

## Installer / Distribution

<!-- tokscale-windows-cmd-resolution-fix: archived 2026-06-10, moved to milestones -->

<!-- bundle-tokscale-distribution: archived 2026-06-10, moved to milestones -->

### enable-tauri-updater

| Field | Value |
|---|---|
| type | suggestion |
| status | parked-idea |
| flagged | 2026-06-10 |
| last-seen | 2026-06-10 |
| description | 啟用 Tauri v2 自動更新（app 內 UpdateBanner 已就緒，含 silent catch）。內部員工散發目前以手動安裝 .msi/.exe 為主，暫不需要。 |

2026-06-10 更新：updater surface 已由 `remove-updater-plugin-surface` change 全數移除（先前只拔 config 但保留 lib.rs plugin 註冊，導致 Tauri 啟動時 `PluginInitialization("updater", ...)` panic、release exe 無聲退出）。config 與程式碼必須同進退。

啟用時要做的事（全部重新加回）：
- `tauri signer generate` 產生本專案自己的 keypair（原 conf 殘留的 pubkey/endpoint 屬 glyphic 模板，已於 2026-06-10 拔除）。
- `tauri.conf.json` 補 `plugins.updater`（endpoints 指向自家 release latest.json + 新 pubkey）與 `bundle.createUpdaterArtifacts: true`（v2 格式，勿用已棄用的 `"v1Compatible"`）。
- Build 時設 `TAURI_SIGNING_PRIVATE_KEY`，並規劃 latest.json 的發佈位置（GitHub Releases 或內部檔案伺服器）。
- 後端：`src-tauri/Cargo.toml` 加回 `tauri-plugin-updater = "2"`，`src-tauri/src/lib.rs` 加回 `.plugin(tauri_plugin_updater::Builder::new().build())`。
- Capability：`src-tauri/capabilities/default.json` 加回 `"updater:default"` permission。
- 前端：加回 `@tauri-apps/plugin-updater` npm 依賴與 `UpdateBanner` 元件（可參考 archive 的 `remove-updater-plugin-surface` change 取回原實作），並在 `src/router.tsx` AppLayout 重新掛載。

## UX / General

### agent-display-name-unification

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-01 |
| last-seen | 2026-06-09 |
| description | 統一 agent 顯示名稱：底層 `AgentId` 值（`anthropic`/`codex`/`gemini`）混了供應商名與產品名，UI 各處直接印原始 id 不一致。改以 presentation 層共用 helper 統一顯示為產品名 claude / codex / gemini（未來 antigravity）。 |

Scope:
- 不動底層 `AgentId` union 值（`"anthropic"` 綁 backend agent paths / fan-out / frontmatter `x_felina_agent_fields`，改值是跨前後端大手術）。
- 抽共用 helper（如 `src/lib/utils/agent-label.ts`）：`anthropic → "claude"`，codex/gemini 維持，預留 antigravity。
- 全 UI 統一接入：SkillList chip、`AddTargetDialog`、`CreateSkillDialog`、`AgentPathsSection`（目前各自寫死 `anthropic` 或 `"Anthropic Claude"`）。
- skill-editor-skill-list 的 chip 屆時改接此 helper。

<!-- temporary-nav-surface-simplification: 已由 remove-legacy-settings-templates-pages (2026-06-03) + quick-settings-and-preferences (2026-05-28) 實現，移除。 -->

### projects-page-active-hub

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-02 |
| last-seen | 2026-06-09 |
| description | 將 Projects Page 從「被動檢視狀態」轉變為「主動管理中樞」。支援手動加入無 Agent 目錄的全新專案，並針對空狀態提供快速匯入 Global Skills 的引導流程 (Onboarding)。 |

Scope:
- 在左側 `ProjectsList` 或上方 Action bar 加入 `+ 新增專案 (Add Project)` 入口，支援呼叫 OS file picker 選取本地資料夾。
- 當選取的專案不包含任何 Skill 時，右側 `ManagedInventory` 不再只顯示 "Empty Inventory"，而是呈現「Skill 推薦與注入介面」。
- 空狀態推薦介面可列出常用的 Global Skills (可重複利用 `canonicalGlobalOnly` 等既有 UI 元件)，一鍵點擊「匯入」即可由 Felina 自動建立對應的 Agent Skills 資料夾並寫入檔案。
- 將 Felina 的價值延伸，使其成為開發者建立新專案後，一鍵配置 AI 環境的第一站。

### wsl-ubuntu-project-support

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-01 |
| last-seen | 2026-06-09 |
| description | Windows 端透過 `\\wsl$\Ubuntu\...` UNC 路徑存取 WSL 內的專案。需驗證 Tauri file system 跨 WSL boundary 的可行性、`normalizeProjectPath` 對 UNC 路徑的正規化、known_projects::normalize_path 後端對齊。 |

Scope:
- 跨 platform 路徑識別:WSL UNC 路徑（`\\wsl$\Ubuntu\home\user\proj`）的前端 `normalizeProjectPath` 處理。
- 後端 `known_projects::normalize_path` 必須對應同步,避免兩端 identity 不一致。
- 驗證 Tauri 2 `fs` plugin 是否能跨 WSL 邊界讀寫,或需要呼叫 PowerShell / wsl.exe 中介。
- 評估是否要對 `.agents/skills/` 等 UNC 路徑做特殊 fan-out 處理。

Notes:
- 由 2026-06-01 OQ 移入。屬探索性 platform feature,需 viability spike 才能切 spectra change。
- 主要驅動是 Windows 開發者用 WSL 跑專案的 workflow。

### import-staging-folder-picker

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-01 |
| last-seen | 2026-06-09 |
| description | ImportStagingDialog 的 Browse Files 目前只收 ZIP（複用 skill_import_scan_zip）。較合理的 UX 是 folder picker,user 選任意目錄後後端當 agent skill 目錄掃描；需要新增後端 command（接受任意路徑 scan SKILL.md）。 |

Scope:
- 新增後端 command:接受任意 path,掃描 SKILL.md(類似 `skill_import_scan_zip` 但跳過解壓步驟,直接用既有 `collect_zip_candidates_in` 或 `collect_candidates_in` 邏輯)。
- 前端 `handleBrowseFiles` 改用 Tauri open dialog 的 `directory: true`,UI 切換 ZIP vs Folder 兩種入口（或合併成「Browse」二選一）。
- 安全:source_path 仍須走 Zip Slip 同等的 `..` segment 拒絕。

Notes:
- 由 2026-06-01 OQ 移入。`refactor-zip-import-staging` change 的 Non-Goals 明確不改後端匯入邏輯,所以另開 change。
- Decision 3「ZIP 直送 Staging」的行為若延伸到 folder picker,需確認「使用者明確選擇 = 直送 Staging」對任意路徑也成立(可能要保留 Discovered 給 folder picker 的批次掃描)。
