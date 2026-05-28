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

### drift-detection-and-conflict-ui

| Field | Value |
|---|---|
| type | planned-change |
| status | active (Spectra change, 4/16) |
| flagged | 2026-05-20 |
| last-seen | 2026-05-28 |
| description | Target 端 drift 自動偵測：batch scan API + check_drift 共用函式 + CoverageMatrix/TargetEditor drifted 狀態 + app 啟動/refocus/reload 觸發。 |

### forked-target-overlay

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-28 |
| description | Per-target 客製化：canonical 推到某 project 後，使用者手改的部分自動與未來主檔更新進行 3-way merge 保留。 |

Design route (2026-05-28 discuss 定案):
- 採用行級字串合併 (Git-style Diff)，廢棄「整段替換格式」的 MVP 構想。
- 底層使用 Rust `git2` (libgit2) crate 進行 `git2::Merge::merge_file`。
- 若發生合併衝突，由 `git2` 產生標準 `<<<<<<<` 標記，並在前端實作 Conflict Resolution UI 供使用者決策。
- 依賴 `local-versioning-and-snapshot-layer` 提供的 Base Snapshot 作為 3-way merge 的基礎。

### local-versioning-and-snapshot-layer

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-22 |
| last-seen | 2026-05-28 |
| description | Phase 2 compare/overwrite/delete/conflict/overlay 的共用安全層，直接基於內建 `git2` 管理的本地隱藏 repo 實作。 |

Design route (2026-05-28 discuss 定案):
- 系統不再手動管理 `.snapshots` 資料夾或 JSON 內的長字串。
- 引入 Rust `git2` crate，將 `~/.felina/skills/` 自動初始化為隱藏的 Git Repo。
- Canonical 的每次變更自動轉換為 git commit，`last_sync[target].base_snapshot` 直接儲存 commit hash。
- 達成零外部相依性（不需系統安裝 Git），直接享受原生的 Snapshot 與 Rollback 能力。

### sync-info-bar-scalability

| Field | Value |
|---|---|
| type | suggestion |
| status | parked (Spectra change, 0/6) |
| flagged | 2026-05-22 |
| last-seen | 2026-05-28 |
| description | Sync info 面板在 agent 數量擴增時的 UI 縮放：摺疊/摘要視圖或 chip 化，失敗 target 展開、成功摺起。 |

### skill-export-validation-pipeline

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-05-28 |
| description | Fan-out 匯出時搭配各 agent 官方 skill 驗證工具做品質檢查，補強現有 YAML schema 驗證。 |

Notes:
- Codex 有官方 skill 驗證腳本：`C:/Users/A11410004/.codex/skills/.system/skill-creator/scripts/quick_validate.py`
- Gemini 有 skill-creator 內建規範：`C:/Users/A11410004/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/builtin/skill-creator/SKILL.md`
- Schema 驗結構，官方腳本驗內容規範，兩者互補。

### skill-creation-destination-model

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | Create new skill 時跳出簡化版 Dialog，要求輸入名稱與選擇初始同步目標 (Target)，避免新手忘記設定。 |

Design route (2026-05-28 discuss 定案):
- 點擊「新增 Skill」時跳出精簡的 Create Dialog。
- 包含「Skill Name」輸入框 (自動對應到 `skill.name`)。
- 包含「Initial Target」選單 (直接複用現有的 Add Target 元件，可選 Global、特定 Project 或 None)。
- 建立完成後，自動在背景綁定 Target 並轉導至編輯器畫面。
- 取代原本在對話框內嘗試解釋 Workspace/Global 落點的複雜化做法。

### third-party-agent-path-configuration

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | 使用者可手動新增第三方 agent 的 project path 與 global path，讓 Felina 能管理內建三家之外或變體 agent 的 skill 位置。 |

Scope:
- 支援手動新增第三方 agent project path。
- 支援手動新增第三方 agent global path。
- 需要決定第三方 agent 是否只是路徑 alias，或需要完整 agent definition（id、display name、project/global path template、skill schema、validation command）。
- 需與 existing Agent Paths / Custom Project Paths / agent-scoped field catalog 分清責任邊界。

---

## Phase 3 — Skill Community

### skill-marketplace

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-28 |
| blocked-by | resolve-multi-source-skill-import; drift-detection-and-conflict-ui; skill-creation-destination-model; local-versioning-and-snapshot-layer |
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

### contextual-help-button

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-05-28 |
| description | 右上角增加說明按鈕，解釋比較無法馬上理解的按鈕含義與操作概念。全站性 UX 改善，不限特定 Phase。 |

### temporary-nav-surface-simplification

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | 暫時隱藏 Settings / Templates 等尚未成熟或非主線頁面，使前端主導覽只保留 Skills、Projects、Tokens、Session。 |

Scope:
- 收斂 Sidebar 主導航，降低早期產品表面積。
- 需保留必要 hidden routes 或 secondary entry points，避免 Felina Settings / Claude Settings 類功能無入口。
- 需要先定義「隱藏」是從 Sidebar 移除、route 保留，還是完整停用頁面。

### resizable-skills-workspace

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | Skills page 的 skill list 與 editor/preview 區域應可摺疊或拖曳調整寬度，提升長列表與編輯工作流的可用性。 |

Scope:
- 支援 skill list collapse。
- 或支援 list 與 editor pane 之間的 draggable resize。
- 需保存或重設使用者調整狀態的策略待定。

### customizable-sidebar-order

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | 左側導覽列項目可拖曳重新排序，讓使用者依自己的工作習慣調整主導航順序。 |

Scope:
- 支援 Sidebar nav item drag-and-drop ordering。
- 需定義排序偏好儲存位置（Felina local preferences）與 reset/default 行為。
- 需避免 hidden routes、non-nav routes、command palette ordering 互相漂移。

### skill-import-entrypoint-ux

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-28 |
| last-seen | 2026-05-28 |
| description | 使用者想新增或匯入 project skill 時，直覺會先到 Skills page 的 Import，而不是 Project page 的 Import to global；需要調整入口導引或整合流程。 |

Scope:
- 檢討 Skills page Import 與 Project page Import to global 的資訊架構。
- 決定 Skills page Import 是否直接支援 project-skill import，或導引使用者選擇 project/source。
- 需與 `clarify-skill-import-conflicts`、`resolve-multi-source-skill-import` 的 conflict semantics 分開：本項聚焦入口與流程直覺，不先重設 import conflict model。
