## Context

Felina 的 canonical skill 目前以 ~/.felina/skills/ 作為主檔來源，per-skill target list 存在 `.felina-sync-meta.json` schema v2。現有 fan-out 會依 target 直接寫入 agent-native skill directory，成功後記錄 `last_sync[targetKey].pushed_hash` 與 timestamp；target disabled、detached、forked 會被略過。現有 UI 已有 push all、per-skill push、target editor、orphan prune scan/apply、project not found indicator，但尚未把「預覽、drift 阻擋、刪除策略、target removal 策略、missing project repoint」串成一致的安全生命週期。

查詢 project knowledge 後，本設計套用兩個既有經驗：`kb-ui-consistency-design` 要求 UI 確認流程重用 shared ConfirmDialog 而非 browser-native confirm；`kb-frontend-identity-migration-display-vs-storage` 提醒 repoint 這類 storage identity 變更要先保護 backend key 與 sync-meta key 的一致性，display 可以跟隨現有 target row 呈現。

這是安全敏感變更，因為它會讀寫使用者 filesystem 並新增刪除 agent-side skill 目錄的路徑。實作 tasks 必須包含 `/spectra-audit` 審查步驟。

## Goals / Non-Goals

**Goals:**

- Push 前提供 non-mutating preview，讓使用者看到 per-target 寫入計畫與彙總。
- Push 時以 `last_sync.pushed_hash` 偵測 agent-side drift，並要求 override / detach / cancel 決策。
- Canonical delete 與 target removal 都用明確 policy 表達「刪 agent-side file」或「保留成 orphan」。
- Missing project target 可在 Target editor 內直接 repoint 到新的 project path。
- 前後端 IPC contract 明確，React UI 只負責呈現與收集決策，Rust backend 負責 path resolution、hash、write/delete 與 sync-meta mutation。

**Non-Goals:**

- 不做 diff viewer、three-way merge、agent-side 匯回 canonical、forked overlay。
- 不改 canonical skill by-name identity、namespace 或同名 skill 策略。
- 不新增 dependency；hash、filesystem 與 serialization 使用現有 Rust/TypeScript 工具鏈。
- 不自動刪除 detached 或 disabled target 的檔案；仍由明確 delete/prune policy 觸發。

## Decisions

### Push preview command returns a non-mutating write plan

新增 backend command `skill_sync_preview(name: String)` 與 `skill_sync_all_preview()`。它們共用 fan-out 的 target enumeration、agent route resolution 與 render logic，但只回傳 plan，不寫檔、不建立目錄、不更新 sync-meta。Preview item 包含 canonical skill name、target identity、agent、scope、project、destination skill directory、destination `SKILL.md` path、operation、drift fields、error message。Push all preview 以 skill 為外層 grouping，讓 PendingPushBar 可呈現總數與逐 skill detail。

選擇 backend 產生 preview，而不是 frontend 推算，原因是可避免 React 重作 path routing、agent schema render、hash 與 missing project 判斷。Frontend wrapper 只保留 typed invoke contract。

替代方案是修改現有 `skill_sync_one` 加一個 dry-run flag；本設計選擇新增 preview command，避免既有 push caller 被 boolean mode 混淆，也讓後續 audit 可以清楚區分 non-mutating 與 mutating command。

### Drift resolution is explicit per target before writes

實際寫入 command 新增 drift-aware contract：`skill_sync_commit(name, resolutions)` 與 `skill_sync_all_commit(resolutionsBySkill)`。Commit 會重新計算 preview，避免使用者確認後 filesystem 已改變卻沿用舊 plan。若最新 preview 出現未 resolution 的 `blocked-drift` 或 overwrite-unknown target，commit 必須拒絕並回傳 per-target blocked result；只有 resolution=override 才可覆寫，resolution=detach 只更新 target mode，不寫檔，resolution=cancel 不寫檔且不改 target 設定。UI 必須明確說明 Detach 與 Cancel 的差異：Detach 是「保留檔案並停止 canonical 管理此 target」，Cancel 是「本次不處理，維持 drift/pending 狀態」。

Drift 判斷以 target 現有 `SKILL.md` hash 對比 `last_sync[targetKey].pushed_hash`。有 last_sync 且 hash 不同是 `blocked-drift`；沒有 last_sync 但 destination file 存在是 overwrite-unknown，也必須在 preview 中明確確認。不存在的 destination 是 create；存在且 rendered hash 相同是 no-op；存在且目前 hash 等於 last_sync 但 rendered hash 不同是 overwrite。

替代方案是只在 frontend preview 後呼叫既有 push；本設計不採用，因為 race window 會讓 drift guard 失效。

### Destructive skill delete uses Cascade Detach Cancel policy

`canonical_skills_delete` 保留或包裝為 policy-aware backend command，例如 `canonical_skills_delete_with_policy(name, policy)`。Policy 為 `cascade`、`detach`、`cancel`。Detach 只刪 canonical directory。Cascade 會根據該 skill 當下 sync-meta target list 解析 `enabled + tracked` target 的 agent-side skill directory，逐一嘗試刪除，收集 deleted / failed path，再刪 canonical directory；disabled、detached、forked target 明確不在 Cascade 刪除範圍內。若 canonical directory 刪除失敗，結果必須明確 surface。Cancel 在 frontend 不呼叫 mutating backend command，或 backend 收到 cancel 時回傳 no-op result。

Cascade 不掃描整個 agent skill root，也不刪 disabled / detached / forked target 或 target list 之外的 orphan；那些仍歸既有 explicit orphan prune 或 per-target removal policy 管理。這個範圍較保守，可降低 cascade 誤刪 unrelated skill directory 的風險。

UI 使用 existing shared `ConfirmDialog` 風格做三選一確認，不使用 `window.confirm`。Dialog 文字必須列出 canonical path、將嘗試刪除的 `enabled + tracked` target count，並提供可展開的 path list 或摘要；disabled、detached、forked target 可以作為保留說明呈現，但不得被計入 Cascade delete count。當 `enabled + tracked` target count 為 0 時，Cascade button 必須 disabled，讓使用者只能選 Detach 或 Cancel，避免產生「連動刪除但實際沒有任何 agent-side target 可刪」的誤導操作。

### Target removal uses the same detach versus delete semantics

TargetEditor 的 row removal 不再直接 filter 掉 target list。UI 先要求使用者選擇 Remove target only、Remove target and delete file、Cancel。Remove target only 呼叫 target update command 只移除 target row，並讓現有 `skill_targets_set` prune 舊 target key 的 last_sync。Remove target and delete file 需要 backend command 對單一 target 解析 destination skill directory、刪除該目錄、再移除 target row；刪檔失敗時必須回傳 failed path，target row 是否移除依 backend contract 固定為「刪檔成功才移除」。

選擇「刪檔成功才移除」而不是部分成功後仍移除 target，是為了避免 UI 顯示 target 不存在但 filesystem 仍留有使用者以為已刪的檔案。使用者仍可改選 Remove target only 來保留 orphan。

### Missing project target repoint updates only project path and target key

Project not found row 新增 Repoint button，使用 Tauri dialog 選取 replacement project root。Repoint 只更新該 target 的 `project` field，保留 `agent`、`scope=project`、`enabled`、`mode`。更新後透過既有 target set 流程寫回 sync-meta；因 target key 改變，舊 key 的 `last_sync` 會被 prune，skill 會 dirty，下一次 preview 會以新路徑計算 create/overwrite/no-op。

Repoint 不刪 old project path 的任何檔案，也不自動新增 Known Projects entry，除非現有選路徑流程本來會做這件事。路徑 normalization 必須走既有 frontend `normalizeProjectPath` 與 backend `known_projects::normalize_path`/path helpers，不得用無條件 lowercase。

### UI consistency and component reuse

本變更重用 `src/lib/components/shared/ConfirmDialog.tsx` 作為 destructive/overwrite confirmation 的一致入口，並在 `SkillsPage.tsx`、`TargetEditor.tsx`、`PendingPushBar.tsx` 內維持現有 compact work-surface 風格。Blocking errors 以 modal 或現有 error banner 顯示；preview 結果是使用者必須確認的 modal/panel，不使用 browser-native confirm/alert。i18n key 加到 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 skills namespace，不翻譯 skill name、agent id、path、timestamp、backend error。

## Implementation Contract

In scope:

- Backend commands: `skill_sync_preview`, `skill_sync_all_preview`, `skill_sync_commit`, `skill_sync_all_commit`, `canonical_skills_delete_with_policy`, and a target removal/repoint-capable command surface if existing `skill_targets_set` cannot express delete-file semantics safely.
- Frontend wrappers in `src/lib/tauri/commands.ts` and shared TypeScript types in `src/lib/types/skills.ts` for preview items, operation enum, drift resolution enum, delete policy, target removal policy, and command results.
- UI updates in `SkillsPage.tsx`, `TargetEditor.tsx`, and `PendingPushBar.tsx` to preview before push, collect drift decisions, confirm delete/removal policies, and browse/repoint missing project targets.
- Rust tests around preview classification, drift guard refusal, override write, detach resolution, cascade vs detach delete, and target removal delete-file semantics where filesystem behavior is covered by existing command test patterns.
- Static verification with `npm run check`, relevant `cargo test` scope, and manual `npm run tauri dev` smoke for push preview, canonical delete, target removal, and missing project repoint.

Out of scope:

- Import conflict resolution, multi-source import, same-name namespace strategy, forked overlays, diff/merge UI, and marketplace/versioning behavior.
- Global orphan discovery outside current target list for cascade delete.
- Changing canonical storage directory, sync-meta schema version, or agent field mapping rules.

Observable behavior:

- A user invoking push sees a preview before any file is modified.
- Preview primary copy summarizes user impact in readable language, such as targets needing attention and the fact that no files change before confirmation; raw operation counts are secondary detail.
- A drifted target cannot be overwritten unless the user chooses Override for that target.
- Choosing Detach for drift changes the target to detached and preserves the agent-side file; choosing Cancel preserves both the file and target configuration.
- Deleting a canonical skill requires Cascade, Detach, or Cancel; Cascade deletes only enabled tracked target directories, while disabled, detached, and forked target directories are preserved.
- Removing a target requires keeping or deleting that target's agent-side directory, and the action affects only that target destination.
- A project not found row can be repointed without deleting and re-adding the target.

Failure modes:

- Preview resolution failures appear as skipped or error preview items and do not mutate files.
- Commit rejects stale or incomplete drift decisions after recomputing preview.
- Per-target writes and deletes isolate failures and return path-level results.
- Missing project targets remain editable and are not silently disabled or removed.

Acceptance criteria:

- `spectra validate skill-target-lifecycle-safety` passes for artifacts.
- `npm run check` passes after implementation.
- Relevant Rust tests pass for fan-out preview/commit/delete/target removal logic.
- Manual Tauri smoke confirms push preview is non-mutating, drift requires a decision, delete policies match file outcomes, and repoint changes only the target project path.
- `/spectra-audit skill-target-lifecycle-safety` is run before archive because the change writes and deletes user files.

## Risks / Trade-offs

- [Risk] Preview can become stale before commit. → Commit recomputes preview and rejects missing or outdated decisions.
- [Risk] Cascade delete could remove more than the user expects. → Limit cascade to enabled tracked targets only, show paths before confirmation, and isolate failures.
- [Risk] Target removal delete-file can leave confusing partial state if deletion fails. → Keep target row when delete-file fails; user can retry or choose Remove target only.
- [Risk] Repoint path comparison can diverge across Windows/macOS. → Use existing path helpers and avoid ad hoc lowercase comparisons.
- [Risk] UI introduces inconsistent modal patterns. → Reuse `ConfirmDialog` and existing inline banner/error patterns from skills UI.
