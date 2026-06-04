# Product Backlog

產品功能的規劃池。從模糊構想到可執行的 change 都可以放，隨著前一個 change 的開發逐漸讓後續規劃清晰化。項目正式進入開發時，透過 `spectra new change` 立 Spectra change，完成後從本文件移除。

項目層級（由模糊到具體）:
- **`umbrella-direction`** — 產品方向 / 架構願景，不直接對應單一 change，用來指引後續規劃。
- **`suggestion`** — 構想雛形，scope 尚未收斂，隨開發推進逐步具體化。
- **`planned-change`** — scope 已明確、可立 Spectra change 的項目。

維護規則:
- 已立項但尚未歸檔的工作（active 或 parked Spectra change）可保留在本文件中作為產品脈絡，但狀態必須標明 `active` / `parked` 並以 `spectra list` / `spectra list --parked` 為準。
- 已歸檔的 change 從本文件移除；歷史紀錄在 `openspec/changes/archive/` 下。
- 項目需註明 `flagged: YYYY-MM-DD`（首次登錄日）與 `last-seen: YYYY-MM-DD`（最近確認日）。

准入條件:
- **產品功能或使用者可見行為**：會改變 UI、新增操作、或影響使用者體驗。
- **未被既有條目涵蓋**：不與現有 entry scope 重疊；若屬子項，更新該條目而非新增。
- suggestion 層級不要求明確交付物，但至少要能描述「解決什麼問題 / 滿足什麼需求」。

不收的項目（歸其他位置）:
- 當前 session 的 bug fix / 追加任務 → Spectra change tasks 或 handoff Open Questions
- 純研究 / 調查 → `.session/` 下獨立文件（如 `agent-capability-research.md`）
- 使用者隨口提到但未確認要做的想法 → 不記錄；等使用者明確表示「加進 backlog」再收

Entry format:
- Use `### <item-name>` for each backlog item; keep status and qualifiers out of the title.
- Put metadata in a Markdown table so preview mode is readable:
  `| Field | Value |` with fields such as `type`, `status`, `flagged`, `last-seen`, `blocked-by`, `description`.
- Put longer details below the table under `Scope:`, `Notes:`, or other short labels.
- Planned work should use `type: planned-change` and `status: planned`; non-committed ideas should use `type: suggestion` and `status: not-committed`.
- Update `last-seen` when an item is actively reviewed or its status changes.

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

## Phase 1.5 — Target Freedom Sequence

`skill-sync-lifecycle` original umbrella scope was split on 2026-05-25.
`skill-target-lifecycle-safety` completed and archived (2026-05-26).
`skill-identity-namespace-strategy` completed and archived (2026-05-26).

---

## Phase 2 — Skill Sync Advanced

### forked-target-overlay

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-30 |
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
| last-seen | 2026-05-31 |
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
| last-seen | 2026-05-30 |
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
| last-seen | 2026-05-30 |
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
| last-seen | 2026-06-01 |
| description | 導入 Rust `notify` 實作 OS-level 檔案監控，取代前端綁定視窗 focus 的輪詢，達成外部修改「即時且零效能浪費」的無縫同步體驗。 |

Scope:
- 在 Tauri 後端啟動時，註冊監聽 `~/.felina/skills/` 及已追蹤專案的 agent 目錄。
- 外部編輯器修改檔案時，透過 Tauri Event 即時推播給前端。
- 前端解除 window focus 與 visibilitychange 綁定的全域重整，改由 Event 觸發局部資料刷新（搭配 SWR 模式確保體驗順滑）。

---

### push-commit-noop-fastpath-and-parallel

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-06-03 |
| last-seen | 2026-06-04 |
| description | `skill_sync_commit` / `skill_sync_all_commit` 在 Push 路徑做了過多無意義工作:NoOp row 仍跑 git snapshot + 全目錄 sibling-hash;且 N 個 dirty skills 是 serial for loop。等待公式:單 skill push = 1×M targets、Push all = N×M,跨 skill 的 `try_snapshot` 無法共用,前端 await 整段 commit 跑完。 |

Investigation (2026-06-04 discuss):
- **檔案定位**:
  - `src-tauri/src/commands/fan_out/mod.rs:615` `skill_sync_commit`(單 skill,inter-target serial)
  - `src-tauri/src/commands/fan_out/mod.rs:730` `skill_sync_all_commit`(多 skill,inter-skill serial)
  - `src-tauri/src/commands/fan_out/mod.rs:693` NoOp 分支(三件貴事)
  - `src-tauri/src/commands/fan_out/mod.rs:30` `try_snapshot` → `snapshot.rs:31 commit_skill_changes`(每個 skill 一次 git commit)
  - `src-tauri/src/commands/fan_out/mod.rs:127` `compute_sibling_hashes`(遞迴 walk target 目錄 SHA-256)
- **NoOp `at` 欄位有實際 reader,不能 full short-circuit**:
  - 後端 `check_drift`(`mod.rs:77`)mtime fast-path 用 `entry.at` 判斷 `mtime ≤ at`;若 NoOp 不更新 `at`,使用者打開過 SKILL.md(沒改內容)就會讓 drift scan 落到慢路徑(讀檔算 hash),跟優化方向相反
  - 前端 `CoverageMatrix.tsx:42`、`TargetPopover.tsx:125`、`TargetChips.tsx:48`、`SyncInfoBar.tsx:39`、`types/skills.ts:53` 的 `lastSynced` 都顯示 `at`(UI「上次同步時間」)
- **並行化只能做 inter-skill 層,不能做 inter-target**:同一 skill 的 `meta` 多 target 共用,inter-target 並行會 race;不同 skill 各自獨立 `canonical_skill_dir` + 獨立 `.felina-sync-meta.json`,可安全並行

修改方向:
- (a) NoOp fast-path:`item.rendered_hash`(或 `current_hash`)== `meta.last_sync[key].pushed_hash` 時,跳過 `try_snapshot` 與 `compute_sibling_hashes`(兩件貴事),但仍用 `entry.get_mut` 把 `at` 更新成 `attempted_at`(保留後端 mtime fast-path);`sibling_hashes` 與 `base_snapshot` 保留舊值
- (b) Inter-skill 並行化:`skill_sync_all_commit:730` 的 `for entry in entries` 改 `tokio::spawn_blocking` + `try_join_all`;用 `tokio::sync::Semaphore` 限並行度 8(或 num_cpus);**前提需驗證**:`try_snapshot`/`commit_skill_changes` 用的是 per-skill repo 還是共用 `~/.felina/skills/.git` repo,若是共用 repo,git2 並行 commit 會 lock 競爭,須改 serial 化 snapshot 或改 strategy
- (c) Inter-target 維持序列(同 skill 內 `for item in preview.items`),不動

非本 change scope（獨立 follow-up 短打）:
- 前端 `refreshDriftScan()` debounce — `SkillsPage.tsx`、`PendingPushBar.tsx`、`TargetEditor.tsx` 等 7+ 處 fire-and-forget,每個 trigger 語義不同(reload entries / view mode / target edit),不容易一刀切。後端加速後若仍有 IO 競爭再開短打

Acceptance:
- 單 skill push 對「全 target 都 NoOp」的情境:時間 < 100ms(或合理基準)
- Push all 對 N=20 dirty skills:時間 < N=1 時的 8×(假設 Semaphore=8,理想線性加速)
- `check_drift` mtime fast-path 在 NoOp push 後使用者沒碰檔的情境仍命中
- 既有單元測試全綠;追加並行 race condition test(同 skill 不能被 inter-skill 並行誤推兩次)

Open Questions（propose 階段需 resolve):
- `try_snapshot` 共用 repo 還是 per-skill repo？決定並行化是否 work
- NoOp 是否該 short-circuit `at` 更新?(語義:「Push 時間」vs「內容變動時間」— 已暫定保留更新以維持 mtime fast-path)
- Semaphore 上限該硬編 8 還是讀 `num_cpus`?

Notes:
- 2026-06-03 由使用者「按 push 為何要等」追問挖出,寫進 OQ
- 2026-06-04 走 `/spectra-discuss` 完整盤點 5 個 assumption + grep 打臉 NoOp 完全 short-circuit 假設後,投入到 backlog 暫存,等下次 session propose
- 電量問題暫不 propose;進場時直接 `/spectra-propose push-commit-noop-fastpath-and-parallel`,本條目的 Investigation + 修改方向 + Open Questions 可直接搬進 design.md

---

## Phase 3 — Skill Community

### skill-marketplace

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-30 |
| blocked-by | — |
| description | 公司內部 Skill 社群化 marketplace。使用者可將 Felina canonical Skill 發佈到內網 Market，同仁可搜尋、查看版本、安裝回自己的 Felina canonical storage，再透過既有 fan-out 同步到各 agent target。 |

Scope:
- Market package 應以 Felina canonical model 為核心：`~/.felina/skills/<skill-name>/SKILL.md` + `.felina-sync-meta.json` + marketplace manifest。
- Install 應寫回 Felina canonical storage，不直接寫入 `.claude/skills/`、`.agents/skills/`、`.gemini/skills/` 等 agent-native output。
- 未來可接公司內網 server：metadata DB + artifact storage + Microsoft Entra ID 身份驗證。
- 正式開發前需先定義 package identity、versioning、install conflict、rollback/snapshot、安全驗證與 server adapter contract。

Notes:
- 目前不適合開成實作型 Spectra change，因為 Skills page / import / target / drift / creation destination model 仍在 Phase 1.5 與 Phase 2 收斂。
- 不採用獨立 `skill.json` 作為 Felina marketplace 的核心 source；若需要額外 metadata，應放在 marketplace manifest，並以 canonical Skill 為 source of truth。
- 舊的 Vercel + Supabase stack 註記已不作為方向；公司內網與無網際網路部署較適合自管內網 server，例如 Node.js/Fastify + PostgreSQL + MinIO 或公司既有等價服務。
- 詳細調查文件：`.session/agent-skill-market-complete.md`。

---

## UX / General


### agent-display-name-unification

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-01 |
| last-seen | 2026-06-01 |
| description | 統一 agent 顯示名稱：底層 `AgentId` 值（`anthropic`/`codex`/`gemini`）混了供應商名與產品名，UI 各處直接印原始 id 不一致。改以 presentation 層共用 helper 統一顯示為產品名 claude / codex / gemini（未來 antigravity）。 |

Scope:
- 不動底層 `AgentId` union 值（`"anthropic"` 綁 backend agent paths / fan-out / frontmatter `x_felina_agent_fields`，改值是跨前後端大手術）。
- 抽共用 helper（如 `src/lib/utils/agent-label.ts`）：`anthropic → "claude"`，codex/gemini 維持，預留 antigravity。
- 全 UI 統一接入：SkillList chip、`AddTargetDialog`、`CreateSkillDialog`、`AgentPathsSection`（目前各自寫死 `anthropic` 或 `"Anthropic Claude"`）。
- skill-editor-skill-list 的 chip 屆時改接此 helper。

### temporary-nav-surface-simplification

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-30 |
| description | 暫時隱藏 Settings / Templates 等尚未成熟或非主線頁面，使前端主導覽只保留 Skills、Projects、Tokens、Session。 |

Scope:
- 收斂 Sidebar 主導航，降低早期產品表面積。
- 需保留必要 hidden routes 或 secondary entry points，避免 Felina Settings / Claude Settings 類功能無入口。
- 需要先定義「隱藏」是從 Sidebar 移除、route 保留，還是完整停用頁面。

### projects-page-active-hub

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-06-02 |
| last-seen | 2026-06-03 |
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
| last-seen | 2026-06-03 |
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
| last-seen | 2026-06-03 |
| description | ImportStagingDialog 的 Browse Files 目前只收 ZIP（複用 skill_import_scan_zip）。較合理的 UX 是 folder picker,user 選任意目錄後後端當 agent skill 目錄掃描；需要新增後端 command（接受任意路徑 scan SKILL.md）。 |

Scope:
- 新增後端 command:接受任意 path,掃描 SKILL.md(類似 `skill_import_scan_zip` 但跳過解壓步驟,直接用既有 `collect_zip_candidates_in` 或 `collect_candidates_in` 邏輯)。
- 前端 `handleBrowseFiles` 改用 Tauri open dialog 的 `directory: true`,UI 切換 ZIP vs Folder 兩種入口（或合併成「Browse」二選一）。
- 安全:source_path 仍須走 Zip Slip 同等的 `..` segment 拒絕。

Notes:
- 由 2026-06-01 OQ 移入。`refactor-zip-import-staging` change 的 Non-Goals 明確不改後端匯入邏輯,所以另開 change。
- Decision 3「ZIP 直送 Staging」的行為若延伸到 folder picker,需確認「使用者明確選擇 = 直送 Staging」對任意路徑也成立(可能要保留 Discovered 給 folder picker 的批次掃描)。
