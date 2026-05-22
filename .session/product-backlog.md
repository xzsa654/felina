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

### path-bug-and-target-model

| Field | Value |
|---|---|
| type | spectra-change |
| status | in-progress-nearly-complete |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| progress | 17/18 tasks complete; artifacts complete per `spectra status` |
| description | Foundation for path reverse-resolution, sync-meta v2, agents-derived initial targets, and fan-out switching. |

Notes:
- Was previously proposed/parked; now unparked and in progress.
- Remaining follow-up items should wait for completion confirmation and archive before depending on it as stable foundation.

### known-projects-and-multi-target

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| blocked-by | `path-bug-and-target-model` completion confirmation / archive |
| description | Known Projects, per-skill target editor, cross-project push, coverage view, and push dry-run. |

Scope:
- Known Projects three-source model: current cwd, detected Claude project paths, and explicit user-added projects persisted to `~/.felina/known-projects.json`.
- Per-skill target editor for per-agent selection across scopes/projects; replace agents-derived targets with explicit targets after the foundation lands.
- Cross-project push and coverage view using sync-meta v2 `targets` and `last_sync`.
- Push dry-run that previews write paths and overwrite impact before execution.

### skill-sync-lifecycle

| Field | Value |
|---|---|
| type | planned-change |
| status | planned |
| flagged | 2026-05-22 |
| last-seen | 2026-05-22 |
| blocked-by | `known-projects-and-multi-target` apply / archive |
| description | Import source selection, target detach/prune, push-time drift checks, canonical delete cascade/detach, arbitrary-folder import, and global/project scope moves. |

Scope:
- Multi-source import resolution from deferred skill import work; wizard should support choosing source content and deriving initial targets from detected agents.
- De-select / disable target should default to detach and offer explicit orphan prune.
- Push-time drift check compares target hash with `last_sync.pushed_hash` and offers override/detach.
- Canonical delete should prompt Cascade / Detach / Cancel and remember per-skill preference.
- Arbitrary folder import through staging preview.
- Global/project scope move with optional cleanup of original-scope targets.

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
