# Tasks

## 0. Requirement & Decision Coverage

Each task group below maps to spec requirements and design decisions:

- Group 1 covers requirements: `Modal primitive SHALL portal to document.body`、`Modal primitive SHALL close on Escape and overlay click`、`Modal primitive SHALL lock body scroll while open`、`Modal primitive SHALL trap and return focus`、`Modal primitive SHALL accept open, onClose, title, size, and children`. It also realizes design decisions: `Modal primitive 用 children + props，不用 slot composition`、`Portal target 固定為 document.body`、`ESC / click-outside / focus trap 不可關閉`、`Focus trap 用手寫，不引入第三方`.
- Groups 2–4 cover requirement: `Migrated dialogs SHALL use the Modal primitive instead of inline portal or backdrop boilerplate`. They also realize design decisions: `分三批 migrate，每批獨立 PR`、`Scope shape correction：排除 anchored dropdown 與 side drawer`、`OnboardingWelcome 的 z-[200] 不額外開 prop`.

## 1. Modal primitive 實作

- [x] 1.1 Modal primitive SHALL accept open, onClose, title, size, and children — 在 `src/lib/components/shared/Modal.tsx` 新增 default-exported `Modal` component，props 為 `{ open: boolean; onClose: () => void; title?: string; size?: "sm" | "md" | "lg"; children: ReactNode }`；`open=false` 時 return `null`
- [x] 1.2 Modal primitive SHALL portal to document.body — 在 Modal 內以 `createPortal(<div>...</div>, document.body)` 渲染（portal target 固定為 `document.body`）；overlay 用 `fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center`；content 容器用 `relative bg-bg-secondary border border-border rounded-2xl shadow-2xl` + size 對應寬度（`sm=w-96` / `md=w-[36rem]` / `lg=w-[48rem]`）
- [x] 1.3 Modal primitive SHALL trap focus while open — 在 Modal 內加 `useEffect`：mount 時 focus 第一個 text-entry input/textarea（無則 fallback 到 container with `tabindex=-1` + outline 抑制）；Tab/Shift+Tab 在 modal 內循環；close 時**不**做 programmatic `prev.focus()`（user-reported regression：programmatic focus 在 Chromium 啟發式下會觸發 `:focus-visible` 顯示黑框）
- [x] 1.4 Modal primitive SHALL lock body scroll while open — 在 Modal 內加 `useEffect`：mount 時記下 `document.body.style.overflow` 原值並設為 `"hidden"`；unmount/close 時還原原值
- [x] 1.5 Modal primitive SHALL close on Escape and overlay click (keydown half) — 在 Modal 內加 `useEffect`：mount 時 `document.addEventListener("keydown", handler)`；handler 對 `Escape` 呼叫 `onClose`、對 `Tab`/`Shift+Tab` 在 modal 容器 querySelectorAll focusable elements，若 activeElement === last 且非 Shift 則 preventDefault + focus first，若 activeElement === first 且 Shift 則 preventDefault + focus last；unmount 時 removeEventListener
- [x] 1.6 Modal primitive SHALL close on Escape and overlay click (overlay-click half) — overlay div 加 `onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}` 處理 click-outside；content 容器加 `onClick={(e) => e.stopPropagation()}` 避免 bubble
- [x] 1.7 當 `title` prop 存在時，content 容器第一個 child 為 `<div class="flex items-center justify-between border-b border-border px-5 py-3"><h3>{title}</h3><button onClick={onClose}><X size={16} /></button></div>`；`title` 缺省時不渲染預設 header
- [x] 1.8 在瀏覽器手動驗：開三個 size、按 ESC 關、點 overlay 關、點 content 不關、按 Tab 在 modal 內循環、關閉後 focus 回原 trigger button、body scroll 鎖定/還原；`npm run check` 綠（**需使用者手動驗**）

## 2. [P] Batch A — `shared/` migrate

- [x] 2.1 `src/lib/components/shared/ConfirmDialog.tsx`：移除 `fixed inset-0` overlay、移除 `<button class="absolute inset-0" onClick={oncancel}>` backdrop；改用 `<Modal open={open} onClose={oncancel} size="sm">` 包住現有 icon + title + message + 兩顆 button；保留現有 `AlertTriangle` icon、`danger` 配色、Cancel/Confirm button 結構不變
- [x] 2.2 `src/lib/components/shared/InfoDialog.tsx`：移除 `fixed inset-0` overlay、移除 backdrop button、移除自寫 X close header；改用 `<Modal open={open} onClose={onClose} title={title} size="md">` 包住 `content` ReactNode；驗證 `max-h-[80vh]` scrollable content 在 Modal 內仍可滾動（content 容器需 `max-h-[80vh] overflow-auto`）
- [x] 2.3 Migrated dialogs SHALL use the Modal primitive instead of inline portal or backdrop boilerplate (Batch A 驗收) — `npm run check` 綠（auto）；手動驗 ConfirmDialog 已由使用者確認（**需使用者再手動驗 InfoDialog**：唯一 caller 是 TargetEditor 的 section help 入口）。`ProjectPicker` 已從 scope 排除（anchored dropdown，非 modal）

## 3. [P] Batch B — `skills/` migrate

- [x] 3.1 `src/lib/components/skills/AddTargetDialog.tsx`：移除自寫 `createPortal` + `fixed inset-0` overlay + 自寫 X close header；改用 `<Modal open onClose={onClose} title={t(locale, "skills.addTargetDialog.title")} size="sm">` 包住 agent/scope/project form
- [x] 3.2 `src/lib/components/skills/SyncPreviewDialog.tsx`：移除 `fixed inset-0` overlay 與自寫 backdrop；改用 `<Modal open onClose={...} size="lg">`（不傳 `title`，保留 dialog 自有 header）；驗證 grid template `8rem_6rem_minmax(0,1fr)_12rem` 與 `<TargetCell>` 排版在 Modal 內無 regression
- [x] 3.3 `src/lib/components/skills/RenameSkillDialog.tsx`：移除自寫 ESC `addEventListener`、移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} title={...} size="sm">` 包住 input + buttons
- [x] 3.4 `src/lib/components/skills/PullConfirmDialog.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} size="lg">`（保留 dialog 自有 diff preview header）
- [x] 3.5 `src/lib/components/skills/CreateSkillDialog.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} title={...} size="sm">`
- [x] 3.6 `src/lib/components/skills/DeletePolicyDialog.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} title={...} size="sm">`
- [x] 3.7 `src/lib/components/skills/SkillImportWizard.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} size="lg">`（保留 wizard 多步驟自有 header）
- [x] 3.8 `src/lib/components/skills/import/ImportStagingDialog.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} size="lg">`
- [x] 3.9 `src/lib/components/skills/TargetEditor.tsx`：移除 `fixed inset-0` overlay；改用 `<Modal open onClose={...} size="md">`
- [x] 3.10 `npm run check` 綠；手動抽樣驗 AddTargetDialog（在原本踩 stacking context bug 的 sticky 容器內仍正常）+ SyncPreviewDialog（grid 排版無 regression）+ RenameSkillDialog（ESC 仍能關閉、無重複 listener）

## 4. [P] Batch C — page-level overlay migrate

- [x] 4.1 OnboardingWelcome 的 `z-[200]` 不額外開 prop — `src/lib/components/shared/OnboardingWelcome.tsx`：將內嵌的 `fixed inset-0` overlay 改用 `<Modal open onClose={...} size="lg">` 包住 onboarding 內容。原 markup 用 `z-[200]` 意圖「first-run 永遠最上層」；migrate 後降為 Modal 預設 `z-50`，因 onboarding 是首啟動唯一 modal、無 stacking case，足夠
- [x] 4.2 `src/lib/components/settings/AgentPathsSection.tsx`：將內嵌 error alertdialog 的 `fixed inset-0` 改用 `<Modal open onClose={...} title={...} size="md">`
- [x] 4.3 `src/lib/components/skills/SkillsPage.tsx`：將 page 內 **2 個** inline overlay（`browsePickerOpen` 與 `browseProject`）改用 `<Modal>`；`browsePickerOpen` 用 `size="md"` (`max-w-md`)、`browseProject` 用 `size="lg"` (`max-w-4xl`)；若 overlay 是 confirm/info 性質，優先改用既有 `ConfirmDialog`/`InfoDialog`
- [x] 4.4.1 `src/lib/components/projects/ManagedInventory.tsx` 的 `resolution` modal（識別：`projects.inventory.resolution.title`、`max-w-xl`）改用 `<Modal open onClose={onCancel} size="md">`
- [x] 4.4.2 `ManagedInventory` 的 `rename` modal（識別：`projects.inventory.rename.title`、`max-w-md`）改用 `<Modal open onClose={onCancel} title={...} size="sm">`
- [x] 4.4.3 `ManagedInventory` 的 `discard` modal（識別：`projects.inventory.discard.title`、`max-w-md`）改用 `<Modal open onClose={onCancel} title={...} size="sm">`
- [x] 4.4.4 `ManagedInventory` 的 link conflict modal（識別：`projects.inventory.link.title`、`max-w-2xl`）改用 `<Modal open onClose={onCancel} title={...} size="lg">`
- [x] 4.4.5 `ManagedInventory` 的 import conflict modal（識別：`projects.importConflictDialog.title`、`max-w-2xl`）改用 `<Modal open onClose={onCancel} title={...} size="lg">`
- [x] 4.4.6 `ManagedInventory` 的 drawer card modal（識別：用 `drawerRef`、`max-w-lg`）改用 `<Modal open onClose={onCancel} size="md">`；驗證 `drawerRef` 仍能被 caller 取得用於原本的 focus/scroll 行為（若 Modal portal 後 ref 取不到，需在 Modal 內提供 forwardRef 或 caller 改用 effect 抓 element）
- [x] 4.5 `npm run check` 綠；手動抽樣驗 OnboardingWelcome（首次開 app 流程）+ AgentPathsSection（Felina settings 內 dialog）+ ManagedInventory 其中一個（建議 rename，最常用）。`InstructionsPage` 右側 drawer 已從 scope 排除（非 centered modal）

## 5. 驗收

- [x] 5.1 `grep -rE "fixed inset-0" src/lib/components/`，確認結果僅剩：`Modal.tsx` 自身、`Sidebar.tsx` (mobile drawer)、`CommandPalette.tsx`、`TargetPopover.tsx`、`ContributionGraph.tsx` tooltip、`ProjectPicker.tsx` (anchored dropdown backdrop)、`InstructionsPage.tsx` 右側 drawer overlay。若有其他 centered modal 還在清單，回去對應 batch 補 migrate
- [x] 5.2 全域 grep `createPortal`，確認只剩 `Modal.tsx` 與 `ContributionGraph.tsx` 兩處
- [x] 5.3 全域 grep `addEventListener.*keydown` 在 `src/lib/components/`，確認沒有 dialog 還在自寫 ESC listener（page-level keyboard shortcut handler 不在此限）
- [x] 5.4 `npm run check` 綠 + `npm run tauri dev` 跑起來、開任一 dialog 手動最終驗（ESC / overlay click / focus trap / scroll lock 全部正常）
