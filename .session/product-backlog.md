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
- **Per-skill target editor**: list + `[+ Add target]` dialog (style matches `SkillImportWizard`). Empty default for new skills. Each row has segmented control `Tracked / Detached / Disabled / Forked (disabled, tooltip "Phase 2")`. Add target dialog picks agent + scope + project (project constrained to current project; cross-project locked behind (b)'s `[Add cross-project target]`).
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
| last-seen | 2026-05-22 |
| blocked-by | `cross-project-push-and-coverage` (b) apply / archive |
| description | Lifecycle safety: push dry-run, drift detection, cascade-vs-detach prompts on destructive actions, multi-source import resolution, arbitrary-folder import, scope moves. |

Scope:
- **Push dry-run**: preview-before-execute showing write paths + create/overwrite/no-op counts; user confirms to commit. UX form (modal vs inline, one-step vs two-step) decided during (c) propose.
- **Push-time drift check**: compare target's current SKILL.md hash with `last_sync.pushed_hash`; if drift detected (agent-side modified externally), prompt override / detach / cancel.
- **Canonical delete prompt**: when user deletes a canonical skill, prompt `Cascade (delete agent-side files too) / Detach (leave agent files orphaned) / Cancel`. Remember per-skill preference.
- **Multi-source import resolution**: extend SkillImportWizard's deferred multi-source row from S3 H — let user pick which agent folder is the authoritative source when same skill name exists in multiple agent dirs.
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
  flagged: 2026-05-22 / last-seen: 2026-05-22
  問題(S3 smoke 2026-05-22 發現):變更 skill 的 agents tag、取消某 agent 後 push,被取消 agent 資料夾(如 `.gemini/skills/<name>`)的舊檔**不會被刪除**,留成孤兒。根因:fan-out(`skill_sync_one`)只寫 `skill.agents` 列出的 target,從不 prune;S3 fan-out 規格本就是單向 render、未規範刪除。
  歸屬:刻意不在 S3 修——這是「移除一個 target 時舊檔要不要 prune」的破壞性語意,屬下一個 change(target 模型 + detach/cascade)領域,與 [[Forked-target 客製化]] 的 target list 模型一起做才不丟棄性。
  **待 discuss 的決策**:de-select agent / 移除 target 時,舊檔 → (a) 自動刪除(cascade prune) / (b) 留孤兒(detach,預設) / (c) 每次 prompt。與「刪整個 canonical 的 C7 prompt 三選一(Cascade/Detach/Cancel)」是同族,粒度不同(移除單一 target vs 移除整個 skill),收斂時應一致處理。傾向預設 (b) detach + 提供顯式「prune orphans」動作(在 tag 編輯時自動刪 agent 資料夾的檔太突兀)。

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
