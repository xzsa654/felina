## Context

`skill-target-lifecycle-safety` 將 canonical Skill 刪除定義為 Cascade / Detach / Cancel，並以當時的 `enabled + tracked` target 作為 Cascade 刪除範圍。`auto-sync-mode` 後續將可操作模式改為 `auto` / `manual`，舊 sidecar 的 `tracked` 在 Rust serde 層永久反序列化為 `manual`，但刪除資格判斷未完整對齊。

目前前端 `DeletePolicyDialog` 只計入 `target.mode === "tracked"`；後端 `resolve_current_target_skill_dirs` 只計入 `TargetMode::Manual`。兩層不僅彼此不一致，也都漏掉啟用的 Auto target。此行為涉及刪除使用者本機 Agent Skill directories，屬安全敏感的 filesystem delete 邏輯。

相關既有知識要求 canonical source 與 fan-out output 邊界保持明確，且 UI destructive confirmation 必須與實際檔案影響一致。本變更不改變 source-of-truth 架構，只修正刪除 eligibility。

可重用的現有元件與邏輯：

- `src/lib/components/skills/DeletePolicyDialog.tsx`：現行 canonical delete 三選一 Dialog。
- `src/lib/components/skills/sync-status-utils.ts`：現行 target 狀態純函式集合，可放置前端共用 eligibility helper。
- `src-tauri/src/commands/canonical_skills.rs`：現行 policy-aware canonical delete 與 filesystem tests。
- `tests/sync-status-utils.test.ts`：現行 target 狀態純函式測試入口。

本變更為 UI-related，會修改 Dialog 顯示數量、摘要與文案，但不新增視覺模式或新 Dialog。

## Goals / Non-Goals

**Goals:**

- 讓 canonical Cascade delete 對齊現行 target mode 模型。
- 前端 Dialog count / summary / disabled state 與後端實際刪除 eligibility 一致。
- Legacy `tracked` 在前端資料中仍視為受管理的 manual target，維持 backward compatibility。
- 以測試鎖定 Auto、Manual、legacy Tracked、Disabled、Detached、Forked 的刪除邊界。

**Non-Goals:**

- 不改變 Detach、Cancel 或單一 target removal policy。
- 不改變 Auto Sync、Push Preview、Drift Detection 或 target mode 儲存格式。
- 不移除 TypeScript `TargetMode` 中的 legacy `tracked` 值。
- 不掃描 target list 以外的 Agent directories。
- 不改變 canonical directory 刪除失敗或 per-target 刪除失敗的既有結果契約。

## Decisions

**Canonical cascade eligibility uses enabled managed targets**

Canonical Cascade delete 的 eligibility 定義為：

- `enabled === true`
- mode 為 `auto`、`manual` 或 legacy `tracked`

Disabled targets，以及 `detached` / `forked` targets 不 eligible。這與現行「受 Felina 管理且啟用」的使用者語意一致，同時保留 legacy sidecar / frontend data compatibility。

替代方案是把所有 `enabled` targets 都視為 eligible；不採用，因為 `detached` 與 `forked` 即使 enabled 也具有明確的保留語意。

**Frontend eligibility is a reusable pure helper**

前端在 `sync-status-utils.ts` 新增可測試的 managed-target eligibility helper，`DeletePolicyDialog` 使用該 helper 計算 count、summary 與 Cascade disabled state。這避免再次在 destructive Dialog 內硬編 target mode 判斷。

替代方案是只在 Dialog 中擴充條件；不採用，因為 target mode alias 容易再次演進，純函式更適合用 node:test 鎖定。

**Backend remains authoritative for filesystem deletion**

後端 `resolve_current_target_skill_dirs` 使用 Rust `TargetMode::Auto | TargetMode::Manual` 判斷 eligible targets。Legacy JSON `tracked` 已由既有 serde alias 反序列化為 `Manual`，因此後端不新增新的 enum variant 或 migration。

前端 helper 包含 legacy `tracked` 是為了處理 TypeScript runtime data 與舊資料形狀；實際 filesystem delete 仍完全由後端重新讀取 sync-meta 並決定，不信任前端摘要。

替代方案是把前端計算出的 paths 傳給後端刪除；不採用，因為會擴大 destructive IPC 的信任邊界。

**Delete dialog copy describes managed enabled targets**

Dialog 文案從「啟用且 tracked」改為「已啟用且受 Felina 管理」的使用者語意，不向使用者暴露 legacy enum 細節。Auto、Manual、legacy Tracked 都列入 count；Disabled、Detached、Forked 仍以保留訊息呈現。

## Implementation Contract

**In Scope**

- 前端提供純函式判斷 target 是否可納入 canonical Cascade delete。
- `DeletePolicyDialog` 以純函式計算可連動刪除 targets、保留數量、摘要與 Cascade disabled state。
- 後端 policy-aware canonical delete 對啟用 Auto / Manual targets 解析並刪除 Agent Skill directories。
- 更新 English / Traditional Chinese delete Dialog 文案。
- 補充前端純函式測試與 Rust filesystem delete tests。

**Out of Scope**

- Target mode migration、target removal Dialog、其他 pushable 判斷與 retained `TargetEditor` 清理。
- 新增或修改 IPC request / response shape。
- 新增第三方依賴或改變 sync-meta schema。

**Observable Behavior**

- 含一個 enabled Auto target 的 Skill 開啟 delete Dialog 時，Cascade 可使用且摘要包含該 target。
- 含 enabled Auto、enabled Manual 與 legacy enabled Tracked targets 的 Skill，前端摘要會計入三者。
- 選擇 Cascade 後，後端刪除 enabled Auto / Manual targets 的 resolved Agent Skill directories，再依既有流程刪除 canonical directory。
- Disabled、Detached 與 Forked target directories 保持不變。
- 若沒有 eligible target，Cascade 維持不可使用，Detach 與 Cancel 維持可用。

**Interfaces / Data Shape**

- `CanonicalDeletePolicy`、`CanonicalSkillDeleteResult` 與 Tauri command 名稱維持不變。
- `TargetMode` TypeScript union 維持包含 `auto | manual | tracked | detached | forked`。
- Rust `TargetMode` 維持既有 serde alias：legacy `tracked` 反序列化為 `Manual`。

**Failure Modes**

- Target directory resolution failure沿用現行行為：該 target 不產生 resolved delete path。
- Per-target filesystem deletion failure沿用現行 path-level result，不阻止其他 target deletion attempt。
- Canonical directory deletion failure沿用現行 command error。
- 前端摘要即使因 stale state 與後端不同，後端仍以磁碟上的最新 sync-meta 為 authoritative delete boundary。

**Acceptance Criteria**

- Node tests 證明 enabled Auto / Manual / legacy Tracked eligible，Disabled / Detached / Forked ineligible。
- Rust filesystem tests 證明 Cascade 刪除 Auto / Manual targets，保留 Disabled / Detached / Forked targets。
- `npm run check`、相關 node tests、相關 Rust tests 與 `cargo build` 通過。
- `npm run tauri dev` 手動驗證 Dialog count / summary / disabled state 與實際檔案結果一致。
- `/felina-ui-guidelines` review 與 `/spectra-audit align-canonical-delete-target-modes` 在 archive 前完成。

## Risks / Trade-offs

- [Risk] Cascade 現在會刪除過去因舊 bug 被漏掉的 Auto target directory，影響範圍比目前實作更大。→ Dialog 在確認前列出 eligible target 摘要，後端仍只刪 current target list 解析出的 directories。
- [Risk] 前端 legacy `tracked` 與後端 serde alias 的表達不同。→ 以前端純函式測試 legacy runtime shape，後端測試 legacy JSON alias 與 Manual delete 結果。
- [Risk] 不同模組再次各自定義 managed target。→ 本 change 僅在 destructive delete boundary 建立明確 helper 與測試；不順帶重構其他 push / dirty 邏輯。
- [Trade-off] 前後端仍各自實作 eligibility，而非共享程式碼。→ Tauri 的 TypeScript / Rust 邊界無法直接共享函式，以相同 spec scenarios 與雙層測試維持一致。

## Migration Plan

- 不需資料 migration；legacy `tracked` sidecar 仍由既有 serde alias 讀為 `Manual`。
- 發佈後新刪除行為立即適用於 Auto targets。
- 若需 rollback，可回復前後端 eligibility 與文案；不涉及 schema 或持久資料轉換。

## Open Questions

(none)
