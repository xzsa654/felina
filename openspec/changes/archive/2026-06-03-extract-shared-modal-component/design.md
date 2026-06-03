## Context

19 個 dialog 散落於 `src/lib/components/` 下 6 個子目錄，皆採 `fixed inset-0` 直接在 React tree 原地渲染。實測現況：

- **portal 使用**：僅 `AddTargetDialog`（被 sticky 容器踩過 stacking context bug 後改的）
- **ESC 監聽**：僅 `RenameSkillDialog`（用 `addEventListener('keydown', ...)`，每次 mount 自寫）
- **focus trap / return focus**：無
- **scroll lock**：無
- **click-outside 關閉**：部分有（多為 `<button class="absolute inset-0" onClick={onClose}>` 模式），部分無

當前不存在共享 Modal primitive。`shared/` 目錄已有 `ConfirmDialog`、`InfoDialog`、`ProjectPicker` 是 dialog-shaped 但仍各自重寫 overlay/backdrop boilerplate。

無第三方 UI library（無 Radix、無 Headless UI、無 cmdk 之外的 overlay primitive），UI 慣例為手寫 Tailwind + Lucide icons。

## Goals / Non-Goals

**Goals:**

- 提供唯一 Modal primitive，集中 portal / overlay / ESC / click-outside / scroll lock / focus trap / return focus 行為
- 19 個 dialog 全部 migrate 完成後，移除各 dialog 重複的 overlay / backdrop boilerplate
- API 對 caller 最低侵入：children + props，不強制 slot composition
- 分三批可獨立驗證的 migrate，每批靜態 gate（`npm run check`）綠燈即可進下一批

**Non-Goals:**

- 不改變任何 dialog 的視覺設計、文案、欄位、業務邏輯
- 不包含非 centered-modal 語意的 overlay：Sidebar (mobile drawer)、CommandPalette (cmdk 浮層)、TargetPopover (anchored popover)、ContributionGraph tooltip (cursor-following)、`ProjectPicker` (anchored dropdown backdrop)、`InstructionsPage` 右側 drawer overlay (`fixed top-0 right-0 h-full w-[500px]` side panel)
- 不引入第三方 UI library
- 不新增 ESLint rule（後續 follow-up）
- 不處理 nested modal / modal stacking（目前無 caller 需求）

## Decisions

### Modal primitive 用 children + props，不用 slot composition

19 個 dialog 的 header / body / footer 結構差異大：`ConfirmDialog` 有 icon + double-button、`InfoDialog` 有 X close + scrollable content、`AddTargetDialog` 是長 form。強制 `<Modal.Header><Modal.Body><Modal.Footer>` 會逼全部 caller 結構化重寫，scope 超出本 change。

採 `<Modal open onClose title? size?>{children}</Modal>`：Modal 負責 portal + overlay + close 行為，caller 自行排版 header / body / footer。`title` 可選（給有共同 title bar 的 dialog）；`size` 用預設常數（`sm` / `md` / `lg`）對齊現有寬度（`w-96` / `w-[36rem]` / 更寬）。

**Alternatives**：slot composition（拒絕，見上）；render prop（過度抽象、無需求）。

### Portal target 固定為 `document.body`

唯一 portal target，避免引入 PortalContainer context。當前 19 個 dialog 都是 global overlay，無 region-scoped modal 需求。

**Alternatives**：context-based portal target（無 caller 需要、純未來推測，YAGNI）。

### ESC / click-outside / focus trap 不可關閉

不提供 `closeOnEsc={false}` / `closeOnOverlayClick={false}` props。19 個現有 dialog 都期望這些行為（即便當下沒實作），不開可選 prop 避免 caller 各自配置漂移。若未來真有「強制使用者確認、不可 ESC 關閉」需求（例：destructive confirm），再開 prop。

**Alternatives**：開可選 props（YAGNI、易誤用）。

### Focus trap 用手寫，不引入第三方

第三方（如 `focus-trap-react`）會帶入 dep。focus trap 邏輯不複雜：mount 時找第一個 focusable element focus、Tab/Shift+Tab 在 modal 內 querySelectorAll focusable elements 循環。對齊「無第三方 UI library」原則。

**Alternatives**：`focus-trap-react`（拒絕，新 dep）。

### Scope shape correction：排除 anchored dropdown 與 side drawer

`/spectra-apply` 暫停時實地 inspect 19 個 `fixed inset-0` callsite 後發現：

- `shared/ProjectPicker.tsx` 的 `fixed inset-0 z-40` 是 click-outside backdrop，搭配 `absolute top-full left-0` 的 dropdown 內容；該元件定位錨在 trigger button，硬包 Modal 會破壞 anchored 行為（變成置中彈窗）。歸入 Non-Goals「anchored popover」類別（同 `TargetPopover`）。
- `instructions/InstructionsPage.tsx` 的內嵌 overlay 是右側 drawer (`fixed top-0 right-0 h-full w-[500px]`)，不是 centered modal；歸入 Non-Goals「mobile drawer」類別（同 `Sidebar`）。
- `projects/ManagedInventory.tsx` 內嵌 overlay 經盤點實際有 **6 個獨立 modal**（resolution / rename / discard / linkConflict / importConflict / drawer card），不是原 task 4.4 假設的單一 overlay；其中 drawer card 持有 `drawerRef`，migration 時 ref 與 focus 行為需注意。

修正後涵蓋 15 個檔案、約 20 個 modal instance；Total tasks 從 32 → 36。

**Alternatives considered**：直接強推 Modal 改寫所有 `fixed inset-0`（拒絕，會破壞 ProjectPicker 與 InstructionsPage 的非 modal 行為）；獨立成新 change（拒絕，scope 範圍與本 change 同主題，獨立反而增加 governance 成本）。

### OnboardingWelcome 的 `z-[200]` 不額外開 prop

`OnboardingWelcome` 原 markup 用 `z-[200]`（其他 dialog 都用 `z-50`），意圖是「first-run 永遠最上層」。Modal primitive 預設 `z-50`，migrate 後降級。判斷：onboarding 是首次啟動時的唯一 modal，當下不存在其他 modal 並存，`z-50` 足夠。不為單一 callsite 開 `z` prop。

**Alternatives**：在 Modal API 加 `zIndex` prop（拒絕，YAGNI；若未來有 modal stacking 需求，與 nested modal 一併設計）。

### 分三批 migrate，每批獨立 PR

- Batch A — `shared/`：3 個 dialog，最少風險，先驗 Modal API
- Batch B — `skills/`：9 個 dialog，最大宗
- Batch C — page-level overlay：5 個內嵌 overlay

每批靜態 gate 綠 + 手動 UI 抽樣（每批選 1-2 個 dialog 開啟、按 ESC、點 overlay、按 Tab 驗 focus 不逃出）即可進下一批。一次性全量 migrate 拒絕：視覺 regression 難分批驗證。

**Alternatives**：一次性 migrate（拒絕）。

## Implementation Contract

**Behavior:**

- Modal mount 時：`createPortal` 到 `document.body`，`document.body.style.overflow = 'hidden'`，焦點移到 modal 內第一個 focusable element（input / button / select / textarea / `[tabindex]:not([tabindex="-1"])`）
- Modal unmount 時：還原 body overflow、focus 回到 mount 前 `document.activeElement`
- 按 `Escape`：呼叫 `onClose`
- 點 overlay（modal content 之外的 backdrop 區域）：呼叫 `onClose`
- 按 `Tab` / `Shift+Tab` 在 modal 內最後/第一個 focusable element 時循環到對端

**Interface:**

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;            // 可選；提供時 render 預設 header（title + X close button）
  size?: "sm" | "md" | "lg"; // 預設 "md"；對應 w-96 / w-[36rem] / w-[48rem]
  children: ReactNode;       // caller 自行排 body / footer；title 缺省時連 header 一起自排
}
```

匯出位置：`src/lib/components/shared/Modal.tsx`，default export。

**Failure modes:**

- `open=false` 時 return `null`，不掛 portal、不影響 body overflow
- 多個 Modal 同時 `open=true`：本 change 不支援 stacking，由 caller 保證不會發生（當前 19 個 callsite 無此 case）。若未來出現 stacking 需求，獨立 change 處理。

**Acceptance criteria:**

- `npm run check` 綠燈
- Modal primitive 手動驗證（每個 size）：開啟 / ESC 關 / 點 overlay 關 / Tab 循環 / 關閉後 focus 回原位 / body scroll lock 生效
- 每批 migrate 完成後抽樣 1-2 個 dialog 手動驗 UI 無 regression
- 全部 migrate 完成後：repo 內 `fixed inset-0` 的 callsite 僅剩 Non-Goals 列出的非 centered-modal overlay（Sidebar、CommandPalette、TargetPopover、ContributionGraph、`ProjectPicker`、`InstructionsPage` 右側 drawer、Modal.tsx 本身）

**Scope boundaries:**

**In scope**：Modal primitive 實作 + 15 個檔案（shared 2 + skills 9 + page-level 4）共約 20 個 modal instance 的 portal / overlay / 關閉行為 lift。其中 `SkillsPage` 內含 2 個 inline modal、`ManagedInventory` 內含 6 個 inline modal，每個 instance 獨立 migrate。

**Out of scope**：dialog 內部視覺設計變更、業務邏輯變更、文案變更、Sidebar/CommandPalette/TargetPopover/ContributionGraph tooltip、`ProjectPicker` (anchored dropdown)、`InstructionsPage` side drawer、ESLint rule、modal stacking 支援、`closeOnEsc` / `closeOnOverlayClick` 等可選配置、Modal `zIndex` prop。

## Risks / Trade-offs

- **[Risk] Focus trap 手寫遺漏 edge case（disabled input、hidden tabindex、shadow DOM）** → Mitigation：focusable selector 採保守白名單（`input:not([disabled])`、`button:not([disabled])`、`select:not([disabled])`、`textarea:not([disabled])`、`[tabindex]:not([tabindex="-1"])`）；本 app 無 shadow DOM，不處理
- **[Risk] body overflow lock 與既有 sticky / fixed element 互動 regression** → Mitigation：Batch A migrate 後手動驗主要 page（Skills / Projects / Tokens）的 scroll lock 行為
- **[Risk] return focus target 已 unmount（例如 dialog 由動態列表觸發、列表已重 render）** → Mitigation：return focus 前檢查 element 仍在 DOM；若不在，fallback 到 `document.body.focus()`
- **[Risk] migrate 過程 ESC 行為改變使用者習慣** → Mitigation：19 個 dialog 本來就有人沒 ESC 有人有；migrate 後一致有 ESC 是 net positive、不需 opt-out
- **[Trade-off] 不支援 nested modal** → 當前 0 caller 需求；若未來需要，獨立 change 加 stacking context

## Migration Plan

1. **Batch A — `shared/`**（2 dialog）：先實作 Modal primitive，migrate `ConfirmDialog` / `InfoDialog`。靜態 gate + 手動驗 Modal 行為。
2. **Batch B — `skills/`**（9 dialog）：依序 migrate `AddTargetDialog` / `SyncPreviewDialog` / `RenameSkillDialog` / `PullConfirmDialog` / `CreateSkillDialog` / `DeletePolicyDialog` / `SkillImportWizard` / `ImportStagingDialog` / `TargetEditor`。每個 migrate 後 `npm run check`。
3. **Batch C — page-level overlay**（4 檔，10 個 instance）：migrate `OnboardingWelcome` / `AgentPathsSection` 內嵌 / `SkillsPage` 內嵌（browsePickerOpen + browseProject 共 2 個）/ `ManagedInventory` 內嵌（resolution / rename / discard / linkConflict / importConflict / drawer 共 6 個）。
4. **驗收**：repo grep `fixed inset-0` 結果只剩 Non-Goals 列出的非 centered-modal overlay + `Modal.tsx` 自身。

Rollback：每批獨立 commit，任一批 regression 可單獨 revert。Modal.tsx 新增、無刪除原 dialog file，rollback 不影響 schema 或資料。
