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
