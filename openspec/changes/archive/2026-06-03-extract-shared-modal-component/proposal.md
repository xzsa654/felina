## Summary

抽 `src/lib/components/shared/Modal.tsx` 共享元件，封裝 portal + overlay + ESC + click-outside + scroll lock + focus trap + return focus，並分三批漸進 migrate centered modal-shaped dialog（涵蓋 15 個檔案、約 20 個 dialog instance）。

**Scope correction（ingest 後）**：原 proposal 列入的 `ProjectPicker`（anchored dropdown backdrop）與 `InstructionsPage` 內嵌 overlay（side drawer）皆非 centered modal，已移至 Non-Goals 排除；`ManagedInventory` 內嵌 overlay 經盤點實際為 6 個獨立 modal 而非 1 個。

## Motivation

當前 19 個 dialog 用 `fixed inset-0` 直接渲染在 React tree 原地，其中只有 `AddTargetDialog` 透過 `createPortal` 跳脫 stacking context、只有 `RenameSkillDialog` 監聽 ESC、其餘 dialog 既無 portal 也無 focus trap。

近期 `AddTargetDialog` 曾因 caller 搬進 sticky / scroll 容器而踩 stacking context bug，被臨時改成 portal 化才解；剩下 19 個 dialog 是同樣 pattern 的潛在地雷。未來任一 caller 重構時都可能踩同樣的 bug，且沒有任何結構性機制提醒實作者。

集中到單一 Modal primitive 可以：

- 一次解決 portal、focus trap、ESC 一致性碎裂問題
- 消除 19 處重複的 overlay / backdrop boilerplate
- 為後續的 ESLint rule（`fixed inset-0` 必須伴隨 Modal / createPortal）建立 anchoring point

## Proposed Solution

新增 `src/lib/components/shared/Modal.tsx`，對外 API 採 children + props（非 slot composition），最低侵入 caller 結構：

```tsx
<Modal open onClose={handleClose} title="..." size="md">
  {/* caller 自行排 body / footer */}
</Modal>
```

Modal 內建：

- `createPortal(document.body)`
- overlay (`bg-black/40~50`) + click-outside 觸發 `onClose`
- `keydown Escape` 觸發 `onClose`（單一 listener，避免每個 dialog 重複寫）
- 開啟時 `document.body` 加 `overflow-hidden`，關閉還原
- 初次 mount 時 focus 第一個 focusable 元素；Tab / Shift+Tab 在 modal 內循環（focus trap）
- 關閉時 return focus 回觸發 modal 的元素

分三批漸進 migrate：

- **Batch A — `shared/`**：`ConfirmDialog`、`InfoDialog`
- **Batch B — `skills/`**：`AddTargetDialog`、`SyncPreviewDialog`、`RenameSkillDialog`、`PullConfirmDialog`、`CreateSkillDialog`、`DeletePolicyDialog`、`SkillImportWizard`、`ImportStagingDialog`、`TargetEditor`
- **Batch C — page-level overlay**：`OnboardingWelcome`、`AgentPathsSection`、`SkillsPage` 內嵌（2 個）、`ManagedInventory` 內嵌（6 個：resolution / rename / discard / linkConflict / importConflict / drawer）

每批獨立可驗證（靜態 gate `npm run check` + 手動 UI 抽樣）。

## Non-Goals

- **不**包含 Sidebar (mobile drawer)、CommandPalette (cmdk 浮層)、TargetPopover (anchored popover)、ContributionGraph tooltip (cursor-following)、`ProjectPicker` (anchored dropdown backdrop，定位錨在 trigger button)、`InstructionsPage` 內嵌右側 drawer (`fixed top-0 right-0 h-full w-[500px]`)。這些是 overlay 但語意不是 centered modal，硬包 Modal 會破壞各自的定位/互動模型。
- **不**新增 ESLint rule（列為後續 follow-up，不在本 change scope）。
- **不**改變任何 dialog 的視覺設計、文案、欄位、業務邏輯。僅 lift overlay / portal / 關閉行為到共享 Modal。
- **不**引入第三方 UI library（Radix / Headless UI 等）。

## Alternatives Considered

- **Slot composition (`<Modal.Header><Modal.Body><Modal.Footer>`)**：拒絕。19 個 caller 結構差異大（confirm 有 icon、info 有 X、addtarget 有 form），強制 slot 會逼全部結構化重寫，遠超 portal 化 scope。
- **一次性全量 migrate**：拒絕。19 callsite 散落 6 個目錄，視覺 regression 難分批驗證，PR review 風險過大。
- **改用 Radix Dialog / Headless UI**：拒絕。引入新 dep 與既有 Tailwind 樣式磨合成本高，且本 change 目標是「集中行為」而非「換 UI 框架」。

## Impact

- Affected specs: 新增 capability `shared-modal-primitive`
- Affected code:
  - New:
    - src/lib/components/shared/Modal.tsx
  - Modified:
    - src/lib/components/shared/ConfirmDialog.tsx
    - src/lib/components/shared/InfoDialog.tsx
    - src/lib/components/skills/AddTargetDialog.tsx
    - src/lib/components/skills/SyncPreviewDialog.tsx
    - src/lib/components/skills/RenameSkillDialog.tsx
    - src/lib/components/skills/PullConfirmDialog.tsx
    - src/lib/components/skills/CreateSkillDialog.tsx
    - src/lib/components/skills/DeletePolicyDialog.tsx
    - src/lib/components/skills/SkillImportWizard.tsx
    - src/lib/components/skills/import/ImportStagingDialog.tsx
    - src/lib/components/skills/TargetEditor.tsx
    - src/lib/components/shared/OnboardingWelcome.tsx
    - src/lib/components/settings/AgentPathsSection.tsx
    - src/lib/components/skills/SkillsPage.tsx
    - src/lib/components/projects/ManagedInventory.tsx
  - Removed: (none)
