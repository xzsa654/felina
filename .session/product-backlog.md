# Product Backlog

待立項的產品功能 roadmap。項目正式進入開發時,透過 `spectra new change` 立 Spectra change,並在這份文件移除或標註 `in-progress: <change>`。

維護規則:
- 只收尚未開立 Spectra change 的「未來功能 / 方向」。
- 已立項並進入開發的工作不重複追蹤;以 Spectra 的 `spectra list` 為準。
- 項目需註明 `flagged: YYYY-MM-DD`(首次登錄日)與 `last-seen: YYYY-MM-DD`(最近一次 session 確認仍要做的日期)。
- 不放工具 / 框架 / 流程層面的設計問題,那類項目歸 `.session/design-backlog.md`。


Entry format:
- Use `### <item-name>` for each backlog item; keep status and qualifiers out of the title.
- Put metadata in a Markdown table so preview mode is readable:
  `| Field | Value |` with fields such as `type`, `status`, `flagged`, `last-seen`, `blocked-by`, `description`, `archive-path`.
- Put longer details below the table under `Scope:`, `Notes:`, `Suggested scope:`, or other short labels.
- Keep archived/completed changes when they are useful historical roadmap context, but mark `status: archived` and include `archive-path`; do not leave them looking claimable.
- Planned work should use `type: planned-change` and `status: planned`; non-committed ideas should use `type: suggestion` and `status: not-committed`.
- Update `last-seen` when an item is actively reviewed or its status changes.

---

## Phase 1 — Skill foundation Spectra changes

### multi-agent-skills-foundation

| Field | Value |
|---|---|
| type | spectra-change |
| status | archived |
| flagged | 2026-05-20 |
| last-seen | 2026-05-22 |
| archived | 2026-05-22 |
| archive-path | `openspec/changes/archive/2026-05-22-multi-agent-skills-foundation` |
| description | Canonical skill storage, agent path settings, existing-skill import, Skill CRUD, fan-out push, pending-push sync state, and visual frontmatter editor. |
| original-blocked-by | `agent-skills-schema-reference` |

Notes:
- This was the Skills-first foundation for the broader capability/control-plane direction.
- Keep as historical roadmap context; do not treat as claimable backlog work.

## Product Direction - Capability Registry / Local Agent Control Plane

### capability-registry-control-plane

| Field | Value |
|---|---|
| type | umbrella-direction |
| status | active-direction |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Felina should be treated as a local agent control plane, not only a skill editor. The user-facing first slice remains Skills, but the architecture should avoid skill-only dead ends. |

Near-term strategy:
- Implement Skills first as the concrete, reusable template for a broader capability system.
- Keep current Phase 1.5 / Phase 2 skill-sync sequencing intact; do not interrupt `path-bug-and-target-model`, `known-projects-and-multi-target`, or `skill-sync-lifecycle`.
- Use official vendor docs to verify each new capability family before adding it, following the same pattern used for `agent-skills-schema`.

Architecture note:
- Model toward `Capability`, `Artifact`, `RuntimeBinding`, and `ExecutionRecord` even while only `kind=skill` is exposed in the UI.
- Future `Capability.kind` candidates: `skill`, `hook`, `subagent`, `workflow`, `mcp-tool`, `prompt-template`, and `policy-pack`.
- Registry concerns should include source paths, install targets, lifecycle, version/sync metadata, permissions, drift state, and later execution/observability records.

Expansion path:
- After Skills stabilizes, verify official docs for hooks/subagents/workflows/tool definitions before proposing new capability kinds.
- Future control-plane views may include topology/dependency view, runbook view, and incident/trace view, but these should follow the registry/lifecycle foundation rather than precede it.

### scope-model-simplification — single global canonical + project tab as managed-inventory view

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-24 |
| last-seen | 2026-05-24 |
| description | 重新檢討 global / project 雙 canonical 模型。改為「**單一 global 主檔（`~/.felina/skills`）**」為唯一真相來源，**取消 project-scope canonical（`<project>/.felina/skills`）**；project 分頁從「第二個主檔倉庫」改成「**該 project 的 skill 納管清單（唯讀 view）**」。 |

問題（2026-05-24 與使用者釐清 b 收尾時浮現）：
- APP 初衷是「skill 散落各 agent / 各 project 難管 → 一個主檔、fan out 收斂」。但 **project-scope canonical 反而把主檔打散到每個 project**，重新製造它要解決的分散問題。
- `cross-project-push-and-coverage`（b）落地後，**global 主檔已能 push 到任意 project 的 agent 目錄**，使「每個 project 自存一份主檔」幾乎失去存在理由。
- 「project 主檔可進該 repo git 版控」這個理由站不住：要版控直接把 `.claude/skills` 納入 git 即可；user 對 `.claude/skills` 的 commit/gitignore 處置，對 `.felina/skills` 只會一視同仁，`.felina` 無額外版控優勢。
- 現況 global / project 兩分頁**操作行為完全相同、UI 看不出差異**，project 分頁顯得多餘，且雙 scope 概念對一般 user 是額外認知負擔。

提案方向：
- **單一 canonical = global**。`<project>/.felina/skills` 主檔取消。
- **「project 專屬 skill」= 一個 global 主檔 + target 只指向該 project**（專屬變成 targeting 的選擇，而非另開 storage），維持單一來源、不再打散。
- **project 分頁改成納管清單 view**（2026-05-24 與使用者敲定的 v1 形狀）：
  - (a) **一列 = 一個 skill 名**，後面用 per-agent chip 標各 agent 狀態（claude / codex / gemini 各是否存在）。
  - (2) **v1 先做二元標記：已納管 / 未納管**（「已納管」= `~/.felina` 有同名 global 主檔且其 target 指向此 project）；drift（agent 檔被手改、與主檔不一致）等狀態留 Phase 2 / (c) 再疊。
  - (3) **未納管的 skill → 一鍵 import 到 global 收編**。import 入口由此統一為「從 project 現況收編進 global」，不再有「匯入成 project 主檔」。

開放問題 / 影響：
- 既有 project-scope canonical 的遷移（例如本專案 `C:/MyProject/Pershing/felina/.felina/skills/git/`）：是否、如何搬到 global 或就地保留相容。
- 與 coverage matrix 的關係：project 分頁的納管清單可視為「project 視角的覆蓋表」（行=此 project 實際有的 skill，而非 global 主檔）。
- 連帶小 bug：import wizard 多來源 defer 訊息 `"...handled by the upcoming target-control change"` 文字過時（該 change 已 archived，真正的多來源解析排在 (c)）；重做 import 入口時一併修正指向。

Notes：
- 比 `cross-project-push-and-coverage`（b）大很多，**不在 (b) 動**；(b) 在現有模型下是正確的，照常收尾。
- 下一步建議用 `/spectra-discuss` 正式展開，再決定是否立 change（可能影響 (c) `skill-sync-lifecycle` 的 import / scope-move scope）。

## Phase 1.5 — Target freedom sequence after path-bug-and-target-model

原本規劃為單一 `unified-skill-target-control` change,2026-05-22 discuss 後拆成 (a) → (b) → (c) 三 sub-change(見各 entry blocked-by)。

### path-bug-and-target-model

| Field | Value |
|---|---|
| type | spectra-change |
| status | archived |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| archived | 2026-05-22 |
| archive-path | `openspec/changes/archive/2026-05-22-path-bug-and-target-model` |
| description | Foundation for Windows path reverse-resolution, sync-meta v2 per-skill target model, and fan-out switch to targets-driven. Synced 1 modified + 2 added requirements into `multi-agent-skills` capability spec. |

Notes:
- Keep as historical roadmap context; do not treat as claimable backlog work.
- Confirmed-stable foundation for sub-changes (a)/(b)/(c) below.

### known-projects-and-multi-target — Phase 1.5 (a)

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| blocked-by | — (foundation `path-bug-and-target-model` archived) |
| description | Known Projects three-source model + per-skill target editor + explicit orphan-prune button. Replaces agents-derived targets with explicitly-edited target list. |

Scope (after 2026-05-22 discuss):
- **Known Projects** three-source model with minimal storage: `~/.felina/known-projects.json` shape `{ projects: [path] }` (L3 explicit user-added). L1=current cwd, L2=auto-detect from `~/.claude/projects/<hash>` (using path-bug-and-target-model's resolver). Merge by normalized path with dedupe; UI shows source chip(s) per project entry.
- **Per-skill target editor**: list + `[+ Add target]` dialog (style matches `SkillImportWizard`). Empty default for new skills; target editor is shown during creation (buffered mode) so user can add targets before saving. Each row has segmented control `Tracked / Disabled`, with `Detached` (Phase 2: drift detection) and `Forked` (Phase 2: overlay rendering) both disabled. Add target dialog picks agent + scope + project (project constrained to current project; cross-project locked behind (b)'s `[Add cross-project target]`).
- **SkillEditor `agents` checkbox retires**: target list becomes the sole driver. `canonical_skills_write::align_v2_targets_to_agents` is removed (new skills write empty-targets sidecar). `read_sync_meta_v2`'s "v2 + empty targets → backfill from agents" heuristic is dismantled. v1 backfill stays as one-shot legacy migration on first read.
- **Orphan prune (explicit, button-driven)**: `[Prune orphans]` action scans agent dirs for SKILL.md files whose target row no longer exists in canonical (or whose mode is now Detached); user-confirm before delete. No auto-prune on Detached toggle. Cascade/detach/cancel prompt on canonical delete stays in (c).
- **Sync info bar adaptation**: existing per-target last_sync display continues; hides for skills with empty targets.

Out of scope (defer):
- `[Add cross-project target]` button + actually pushing to cross-project agent dirs → (b).
- Coverage matrix view → (b).
- Push dry-run, push-time drift, cascade-delete prompt → (c).

### cross-project-push-and-coverage — Phase 1.5 (b)

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| blocked-by | `known-projects-and-multi-target` (a) apply / archive |
| description | Enable cross-project target rows in fan-out + coverage matrix view. Source-of-truth stays in origin project; cross-project targets render only the per-agent SKILL.md at the destination. |

Scope:
- **Cross-project target source-of-truth**: canonical lives only in origin project's `.felina/skills/`. Cross-project target row points at `{ scope: project, project: <other path> }`; push writes the agent SKILL.md into `<other path>/.claude/skills/` (or per-agent equivalent) without copying canonical to the destination. sync-meta `last_sync` keyed per-target unchanged.
- **Activate `[Add cross-project target]` button** in (a)'s add target dialog. Project picker uses Known Projects list (L1/L2/L3 from (a)).
- **Manual project path entry in AddTargetDialog**: L2 auto-detect relies on `paths::project_hash_to_path` reverse-resolution, which silently skips unresolved hashes. To cover projects that auto-detect misses, the project picker should offer a "Browse / manual path input" entry point that writes the path into L3 (`known_projects_add`) so it appears in the dropdown. This ensures users can always add cross-project targets regardless of auto-detect coverage.
- **Coverage matrix view**: new Skills page view-mode (or sub-page) showing skill × target matrix; cell shows sync state (synced / dirty / not synced / disabled / detached). Filter by agent / project.
- **Origin-project move semantics** when a target's destination project disappears from Known Projects (gracefully degrade to detached; no auto-delete).

Out of scope (defer to (c)):
- Push dry-run.
- Push-time drift check.
- Cascade/detach/cancel prompt on canonical delete.
- Multi-source import resolution.

### skill-sync-lifecycle — Phase 1.5 (c)

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-24 |
| blocked-by | `cross-project-push-and-coverage` (b) apply / archive |
| description | Lifecycle safety: push dry-run, drift detection, cascade-vs-detach prompts on destructive actions, multi-source import resolution, arbitrary-folder import, scope moves. |

Scope:
- **Push dry-run**: preview-before-execute showing write paths + create/overwrite/no-op counts; user confirms to commit. UX form (modal vs inline, one-step vs two-step) decided during (c) propose.
- **Push-time drift check**: compare target's current SKILL.md hash with `last_sync.pushed_hash`; if drift detected (agent-side modified externally), prompt override / detach / cancel.
- **Canonical delete prompt**: when user deletes a canonical skill, prompt `Cascade (delete agent-side files too) / Detach (leave agent files orphaned) / Cancel`. Remember per-skill preference.
- **Per-target removal prompt** (flagged 2026-05-24, raised during (b) smoke): removing a single target row is currently non-destructive — the rendered agent-side SKILL.md is left in place and only cleaned via the separate `[Prune orphans]` button. (c) should offer an inline prompt at target-removal time ("also delete this target's agent-side file? Cascade / Keep"), converging with the whole-skill Cascade/Detach/Cancel semantics so there aren't two inconsistent delete entry points.
- **In-place target repoint (recovery from "project not found")** (flagged 2026-05-24, raised during (b) smoke; option B from the f-degradation discussion): (b) ships only detection + display of "project not found" (Sync info bar / Coverage matrix / TargetEditor row) plus passive recovery (restore the folder, or delete + re-add the target). It does NOT offer in-place editing of a target's project path. (c) should add a "repoint" action on a target row (e.g. Browse to a new project path) so a renamed/moved destination can be updated in one step instead of delete + add. Design alongside the per-target removal prompt and cascade/detach semantics — they share the same target-row recovery UX surface.
- **Multi-source import resolution**: extend SkillImportWizard's deferred multi-source row from S3 H — let user pick which agent folder is the authoritative source when same skill name exists in multiple agent dirs.
- **Import 自動回填來源 target** (flagged 2026-05-24, raised during (b) smoke): a skill imported from a project's agent dir (e.g. `projectA/.claude/skills/`) currently lands in canonical with **empty targets** — `skill_import_apply` writes only the canonical SKILL.md + bundled siblings, never a sync-meta target. So the round-trip back to the source agent/project must be re-created by hand. (c) should auto-backfill (or prompt to backfill) a target pointing at the import source's agent + scope + project, designed together with multi-source import resolution above (when a skill is multi-source, backfill only after the user picks the authoritative source).
- **Arbitrary-folder import**: import a SKILL.md from any folder (not just the three known agent dirs) via staging preview.
- **Scope move**: convert a project skill to global (or vice versa) with optional cleanup of original-scope targets.

Notes:
- Bug 3 orphan prune (de-select target → orphan handling): the explicit `[Prune orphans]` button lives in (a). (c) adds the destructive-action consistency layer (cascade prompts) on top.

## Phase 2 — Skill sync advanced features

### local-versioning-and-snapshot-layer

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Suggested support layer for Phase 2 compare / overwrite / delete / conflict / overlay behavior. |
| rationale | Drift detection, target prune, cascade/detach, and forked-target overlay all need a common safety layer before they become reliable product workflows. |

Suggested scope:
- Detect whether `git` exists at onboarding/runtime and degrade gracefully when absent; do not assume every target path is inside a Git repo.
- Preserve before/after file snapshots before push, prune, cascade delete, override, and overlay apply.
- Use content hash/diff as the core comparison mechanism; use Git diff/status/log as optional adapters when a target path is inside a repo.
- Support rollback from local snapshots even when Git is unavailable.
- Keep file movement/write/delete in the backend filesystem layer; use Git as observability/versioning enhancement, not as primary transport.

Notes:
- Suggestion only. Re-evaluate when scoping Phase 2 drift/conflict/overlay changes; do not create a Spectra change until a concrete Phase 2 feature needs it.

### sync-info-bar-scalability-when-many-agents

| Field | Value |
|---|---|
| type | suggestion |
| status | not-committed |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| description | Skills 頁的「Sync info」面板目前每個 target 一行,在三家 agent 下沒問題;當支援 agent 數量擴增（Phase 1.5 之後可能納入更多 agent,或 capability registry 把同一 skill 推到多個 binding 時）這條 bar 會變得很長,垂直佔用過多空間。 |
| context | 2026-05-22 path-bug-and-target-model smoke 時,使用者點 skill → Sync info 列出每個 target 的 agent / scope / 最後更新時間,單一 skill 在三家 agent 已 3 行;當未來 agent 多時直觀會超出可視範圍。 |

Suggested scope:
- 設計可摺疊 / 摘要視圖:預設只顯示「最近一次 push 時間 + 成功 target 數 / 總 target 數」,展開後才列出 per-target 細節。
- 或改用 grid / pill 顯示(每個 target 變成一個小 chip,而非整行),節省垂直空間。
- 失敗 target 一律展開、成功 target 摺起。
- 跟 [[Forked-target 客製化]] 的 overlay 顯示策略一起考慮(per-target 客製化也會撐長同一條 bar)。

Notes:
- 三家 agent 時不必處理;等 agent 種類或 target 維度擴張後再做。
- 與 [[capability-registry-control-plane]] 走向相關:當 Capability/RuntimeBinding 模型上線後,同 skill 對應的 binding 數可能比現在的「3 家 agent × 2 scope」大很多。

- **Drift 偵測 + 衝突解決 UI**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  App 開啟時掃描各 agent skill 目錄是否與 canonical 不一致,提供三向 diff 與「以主檔覆蓋 / 拉回主檔 / 解綁追蹤」三種解決動作。對應 phase 1 同步策略路線二的延伸實作。

- **跨 agent 欄位 normalize 警示**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  同步前比對 target agent schema,主檔有 target 不認識的欄位時提示使用者:過濾掉 / 保留原樣 / 對應到其他欄位,選擇記為 per-skill per-agent mapping rule 持久化。

- **移除 target 時的孤兒 prune(de-select agent → 舊檔處理)**
  flagged: 2026-05-22 / last-seen: 2026-05-23
  **部分完成**：Phase 1.5 (a) `known-projects-and-multi-target` 已實作顯式 `[Prune orphans]` 按鈕 — scan 找出 target 清單中不存在或 mode 為 Disabled 的 agent-side 殘留檔,ConfirmDialog 確認後刪除,同時清除對應 `lastSync` 記錄。不在 toggle Disabled 時自動刪除(確認採 detach 預設 + 顯式 prune 方案)。
  **剩餘（歸 (c) skill-sync-lifecycle）**：刪除整個 canonical skill 時的 Cascade / Detach / Cancel 三選一 prompt。這與單一 target 的 prune 是同族但粒度不同,收斂時應一致處理。

- **Forked-target 客製化(per-target overlay,Route 2)**
  flagged: 2026-05-20 / last-seen: 2026-05-22
  使用情境:canonical 推到 `claude-project:Foo` 後,使用者進該目標檔手改一小部分(例:加 project-specific path、example、注意事項),希望此客製化保留;但 canonical 後續更新的其他部分仍能套用。等同於 git 的「tracking branch + local commits」概念套到 skill 檔。

  **設計路線(於 2026-05-22 discuss 會敲定 Route 2 overlay,捨棄 Route 1 3-way merge 與 Route 3 區段標註)**:
  - Canonical 主檔保持純淨,客製內容以**獨立 overlay 檔**儲存在 canonical sidecar:
    ```
    ~/.felina/skills/<skill-name>/
      SKILL.md                                ← canonical
      .felina-sync-meta.json                  ← targets + last_sync(Phase 1 已建立)
      overlays/
        claude-project-Foo.patch.md           ← Foo 專案的客製覆蓋
        claude-project-Bar.patch.md           ← Bar 專案的客製覆蓋
    ```
  - Overlay 格式 MVP 採「**整段替換**」(明確、好顯示);未來可延伸支援 unified diff 行級覆蓋。
  - Render flow:`fan_out(canonical) → apply overlay(target) → 寫入 target SKILL.md`。Canonical 改了等於自動套新 base + 老 overlay。
  - 三家 agent 不認識 overlay 概念,渲染後輸出仍是純 SKILL.md,對 agent 透明。

  **Phase 1 已預留的鉤子(於 `skill-tab-target-freedom` change 落地)**:
  - sync-meta sidecar schema v2 `targets[].mode` enum 已含 `forked` 值(Phase 1 只實作 `tracked`/`detached`,`forked` 留 placeholder)。
  - sync-meta `last_sync[target].base_snapshot` 欄位已預留,Phase 2 啟用(存 fork 那一刻的 canonical 內容,作為 overlay 的 base)。
  - Phase 1 reverse drift 對話框只給「override / detach」兩選一;Phase 2 加上「fork(保留客製,Phase 2 啟動)」第三選項。

  **Phase 2 要實作的工作**:
  - Overlay 編輯 UI:不能讓使用者寫 unified diff,需提供「對照原 canonical 顯示客製段落、編輯整段替換」的介面。
  - Overlay 與 canonical 結構漂移處理:canonical 把某段砍了、overlay 還想改那段時的降級策略(警告 + 落為 detached?)。
  - Push 時的 conflict surface:overlay 套用失敗時的使用者提示流。
  - Overlay 進 git 的策略(project canonical 的 overlay 進、global 的不進,同 sync-meta)。

## Phase 3 — Skill 社群化

- **公司內部 skill 分享 marketplace**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  延伸 server 端,使用者可發佈 / 訂閱他人的 skill。Server stack 初步討論:Vercel + Supabase,Node Express 是否必要待釐清。會影響 skill schema(需加唯一識別、版本、作者欄位)。

## 平行進行

- **Token 審計平台**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  由同仁負責。排程 POST token 用量到 server,支援多 uid 與時間範圍查詢。Server stack 設計待同仁釐清。Glyphic 既有 token-savings / analytics 頁面在 cleanup-glyphic-base 階段一併移除,後續由本項目的方案取代。
