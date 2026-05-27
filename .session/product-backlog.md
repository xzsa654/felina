# Product Backlog

產品功能的規劃池。從模糊構想到可執行的 change 都可以放，隨著前一個 change 的開發逐漸讓後續規劃清晰化。項目正式進入開發時，透過 `spectra new change` 立 Spectra change，完成後從本文件移除。

項目層級（由模糊到具體）:
- **`umbrella-direction`** — 產品方向 / 架構願景，不直接對應單一 change，用來指引後續規劃。
- **`suggestion`** — 構想雛形，scope 尚未收斂，隨開發推進逐步具體化。
- **`planned-change`** — scope 已明確、可立 Spectra change 的項目。

維護規則:
- 已立項並進入開發的工作不重複追蹤；以 `spectra list` 為準。
- 完成的 change 從本文件移除；歷史紀錄在 `openspec/changes/archive/` 下。
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
`skill-identity-namespace-strategy` has a parked Spectra change (0/16).

### clarify-skill-import-conflicts

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-25 |
| description | Clarify single-source import conflict semantics and make target creation explicit. |

Scope:
- **Import resolution 選項收斂**: wizard 的「保留 canonical」與「跳過」目前對有衝突的 candidate 執行結果完全相同（都 no-op 不寫入），是語意冗餘。應收斂或重新設計衝突解決選項，讓每個選項有明確不同的行為。
- **Import target 顯式化**: import 時直接寫 sync-meta sidecar（取代現行讀取時隱性 backfill），並讓 overwrite / rename / keep 行為在 UI 與 backend contract 中可區分。

### resolve-multi-source-skill-import

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-25 |
| description | Resolve imports where the same skill name appears in multiple sources or outside standard agent directories. |

Scope:
- **Multi-source import resolution**: 同名 skill 存在多個 agent dir 時，讓 user 選權威來源。
- **Import-all + rename 批次衝突**: 批次匯入遇同名衝突時的 per-conflict keep/overwrite/rename 流程。
- **Arbitrary-folder import**: 從任意資料夾匯入 SKILL.md（不限三家 agent dir）。

### skill-identity-namespace-strategy

| Field | Value |
|---|---|
| type | planned-change |
| status | parked (Spectra change, 0/16) |
| flagged | 2026-05-22 |
| last-seen | 2026-05-26 |
| description | Product-model decision for same-name skills across projects under Felina's single global canonical store. |

Conclusion (2026-05-25):
- **維持 single-global-by-name flat namespace**，不引入 project namespace。
- **同名碰撞在 import 時由使用者選擇一個來源當 canonical 內容**，其餘來源以 disabled target 保留。
- Import wizard 提供多來源 diff 預覽（歸 #15/#16 scope）。
- Disabled target 可查看 agent 端現有內容（歸 #14/#15 scope）。
- 版本差異長期由 Phase 2 forked overlay 處理。
- Rationale: project namespace 會動到整個 identity model（sync-meta、fan-out、import、UI），成本與現階段需求不匹配。

### skill-content-markdown-preview

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-05-27 |
| description | Skill review body 與 sync target Eye button 提供 Markdown 預覽模式，將 MD 語法渲染為閱覽 UI。Memory page 已有 md preview 實作可復用。 |

---

## Phase 2 — Skill Sync Advanced

### drift-detection-and-conflict-ui

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-27 |
| description | App 開啟時掃描 agent skill 目錄與 canonical 的差異，提供三向 diff + 覆蓋/拉回/解綁三種解決動作。 |

Scope (2026-05-27 討論補充):
- **批次 drift scan API**：一次 IPC 呼叫遍歷所有 enabled tracked target，讀 agent 端 SKILL.md 算 hash 比對 `lastSync.pushed_hash`，回傳 `Map<targetKey, DriftStatus>`。純讀取，不 render、不 write。
- **觸發時機**：app 啟動、window refocus、手動 reload。不做 file watcher。
- **前端消費**：矩陣（CoverageMatrix）和 sync info 面板增加 `drifted` 狀態顯示。
- **與 preview 的關係**：`build_preview_for_skill` 裡的 hash 比對邏輯抽成共用 `check_drift` 函式，preview 和 drift scan 都呼叫。Preview 額外做 render + operation 分類，drift scan 只回傳 hash 是否一致。
- Push 時的 preview API 不變，仍走完整 render + operation 流程。

### cross-agent-field-normalize

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-20 |
| description | 同步前比對 target agent schema，主檔有 target 不認識的欄位時提示過濾/保留/mapping，選擇持久化為 per-skill per-agent mapping rule。 |

### forked-target-overlay

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-22 |
| description | Per-target 客製化：canonical 推到某 project 後，使用者手改的部分以 overlay 檔保留，canonical 更新時自動套新 base + 舊 overlay。 |

Design route (2026-05-22 discuss 定案 Route 2 overlay):
- Overlay 以獨立 `.patch.md` 存於 canonical sidecar `overlays/` 下。
- MVP 用整段替換格式；未來可延伸 unified diff。
- Render flow: `fan_out(canonical) → apply overlay(target) → write SKILL.md`。
- Phase 1 已預留鉤子：sync-meta `targets[].mode` 含 `forked` placeholder、`last_sync[target].base_snapshot` 欄位。

### local-versioning-and-snapshot-layer

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Phase 2 compare/overwrite/delete/conflict/overlay 的共用安全層：file snapshot + content hash + optional Git adapter + rollback。 |

### sync-info-bar-scalability

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Sync info 面板在 agent 數量擴增時的 UI 縮放：摺疊/摘要視圖或 chip 化，失敗 target 展開、成功摺起。 |

### skill-export-validation-pipeline

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-05-27 |
| description | Fan-out 匯出時搭配各 agent 官方 skill 驗證工具做品質檢查，補強現有 YAML schema 驗證。 |

Notes:
- Codex 有官方 skill 驗證腳本：`C:/Users/A11410004/.codex/skills/.system/skill-creator/scripts/quick_validate.py`
- Gemini 有 skill-creator 內建規範：`C:/Users/A11410004/AppData/Roaming/npm/node_modules/@google/gemini-cli/bundle/builtin/skill-creator/SKILL.md`
- Schema 驗結構，官方腳本驗內容規範，兩者互補。

---

## Phase 3 — Skill Community

### skill-marketplace

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-20 |
| description | 公司內部 skill 分享 marketplace。使用者可發佈/訂閱他人 skill。Server stack 初步討論 Vercel + Supabase。會影響 skill schema（需加唯一識別、版本、作者欄位）。 |

---

## UX / General

### contextual-help-button

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-27 |
| last-seen | 2026-05-27 |
| description | 右上角增加說明按鈕，解釋比較無法馬上理解的按鈕含義與操作概念。全站性 UX 改善，不限特定 Phase。 |

