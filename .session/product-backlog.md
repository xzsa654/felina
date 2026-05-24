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
- 工具 / 框架 / 流程 / 開發體驗問題 → `.session/design-backlog.md`
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

### skill-sync-lifecycle

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-24 |
| description | Lifecycle safety: push dry-run, drift detection, cascade-vs-detach prompts, multi-source import resolution, arbitrary-folder import, scope moves. |

Scope:
- **Import resolution 選項收斂**: wizard 的「保留 canonical」與「跳過」目前對有衝突的 candidate 執行結果完全相同（都 no-op 不寫入），是語意冗餘。應收斂或重新設計衝突解決選項，讓每個選項有明確不同的行為。
- **Push dry-run**: preview write paths + create/overwrite/no-op counts; user confirms to commit.
- **Push-time drift check**: compare target SKILL.md hash with `last_sync.pushed_hash`; drift → prompt override / detach / cancel.
- **Canonical delete prompt**: Cascade (delete agent files) / Detach (leave orphaned) / Cancel.
- **Per-target removal prompt**: target row 移除時提示是否一併刪除 agent-side file（converge with cascade/detach semantics）。
- **In-place target repoint**: "project not found" 時可 Browse 重新指向新路徑，取代 delete + re-add。
- **Multi-source import resolution**: 同名 skill 存在多個 agent dir 時，讓 user 選權威來源。
- **Import target 顯式化**: import 時直接寫 sync-meta sidecar（取代現行讀取時隱性 backfill），與 multi-source resolution 整合。
- **Import-all + rename 批次衝突**: 批次匯入遇同名衝突時的 per-conflict keep/overwrite/rename 流程。
- **跨 project 同名 skill**: single-global-by-name 下同名不同內容 skill 的 namespace 策略。
- **Arbitrary-folder import**: 從任意資料夾匯入 SKILL.md（不限三家 agent dir）。

---

## Standalone Planned Changes

### skills-i18n-and-convention

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-24 |
| last-seen | 2026-05-24 |
| description | Skills / Projects 頁 i18n 補齊 + 建立「新 UI 文字一律用 i18n key」的開發規範，讓後續 change 不再產生硬編碼文字。 |

Scope:
- 盤查 `src/lib/components/skills/*` 和 `src/lib/components/projects/*` 所有硬編碼 UI 文字。
- 在 `en.ts` / `zh-TW.ts` 新增 `skills` 和 `projects` namespace，替換所有硬編碼。
- 不翻譯 user/system data（skill names, paths, agent IDs, timestamps, backend errors）。
- 更新 CLAUDE.md 或 Spectra config 加入規範：新增/修改 UI 文字時一律使用 `t(locale, key)`，不允許硬編碼。
- Implementation reference: Tokens 頁（`src/lib/components/tokens/TokensPage.tsx` + `tokens` namespace）。

---

## Phase 2 — Skill Sync Advanced

### drift-detection-and-conflict-ui

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-20 |
| last-seen | 2026-05-20 |
| description | App 開啟時掃描 agent skill 目錄與 canonical 的差異，提供三向 diff + 覆蓋/拉回/解綁三種解決動作。 |

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

