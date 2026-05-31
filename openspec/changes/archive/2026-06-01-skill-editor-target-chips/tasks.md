## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings。驗證：記錄輸出結果。

## 2. TargetChips 元件（Target Chips Metadata Row requirement; Task scope: TargetChips 元件）

- [x] 2.1 新增 `src/lib/components/skills/TargetChips.tsx`，props 為 `targets: SkillTarget[]`、`onExpand: () => void`、`onAdd: () => void`。每個 target 渲染為 compact chip（`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-secondary text-xs`），內容為 `{agent} · {scope} · {mode}`，scope 為 project 時追加專案路徑最後一段目錄名。chip 點擊觸發 `onExpand`。最右邊 `+` 按鈕觸發 `onAdd`。驗證：`npm run check` 通過。

## 3. SkillEditor 整合（Target Chips Metadata Row requirement; Task scope: SkillEditor 整合; Design: SkillEditor 整合）

- [x] 3.1 SkillEditor 新增 target 相關 props（`targets`、`projectPath`、`knownProjects`、`onTargetsChange`）。在 Document Header 的 Description 下方、分頁列上方新增 target 區域：`isNew` 時不渲染；收合態渲染 `<TargetChips>`；展開態渲染 `<TargetEditor>`。新增 `targetsExpanded` state 管理切換。展開態 TargetEditor 包裹在 `max-h-[200px] overflow-y-auto` 容器中。新增收合按鈕讓使用者從展開態回到收合態。驗證：`npm run check` 通過。

## 4. SkillsPage 修改（Target Chips Metadata Row requirement; Task scope: SkillsPage 修改; Design: SkillsPage 修改）

- [x] 4.1 從 SkillsPage 移除獨立的 `<TargetEditor>` 渲染（`<div className="px-4 pt-4">` 包裹的區塊）。將 target 相關 props（`targets`、`projectPath`、`knownProjects`）傳遞給 SkillEditor，`onTargetsChange` callback 呼叫 `loadEntries()`。驗證：`npm run check` 通過。

## 5. i18n

- [x] [P] 5.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 Target Chips 相關 keys：`skills.targetChips.expand`（"Expand targets" / "展開同步目標"）、`skills.targetChips.collapse`（"Collapse" / "收合"）。驗證：`npm run check` 通過。

## 6. 驗證

- [x] 6.1 執行 `npm run check`，確認零 error。驗證：與 baseline 相比無新增。
- [x] 6.2 `npm run tauri dev` 手動驗證：(1) 既有 skill 顯示 Target Chips 收合態；(2) 點擊 chip 展開完整 TargetEditor；(3) 收合按鈕回到 chips；(4) `+` 按鈕開啟 AddTargetDialog；(5) 新建模式不顯示 chips；(6) 展開態多 target 時有 max-height 限制並可內部捲動。驗證：六項行為皆符合預期。
