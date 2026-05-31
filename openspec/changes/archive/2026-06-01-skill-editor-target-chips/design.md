## Context

TargetEditor 目前在 SkillsPage 中獨立渲染於 SkillEditor 上方，接收 `skillName`、`projectPath`、`targets`、`knownProjects` 等 props。`skill-editor-document-header` 已建立 Document Header 結構。本 change 將 TargetEditor 融入 Document Header 作為 Metadata 屬性列。

## Goals / Non-Goals

**Goals:**
- 新增 TargetChips 收合態元件
- TargetEditor 移入 SkillEditor 內部（Description 下方、分頁列上方）
- 收合/展開切換

**Non-Goals:**
- 修改 TargetEditor 後端邏輯
- 修改 AddTargetDialog / PullConfirmDialog / TargetRemovalDialog
- Target 拖曳排序

## Decisions

### 1. TargetChips 元件

新增 `TargetChips.tsx`，負責收合態渲染：

```tsx
interface TargetChipsProps {
  targets: SkillTarget[];
  onExpand: () => void;
  onAdd: () => void;
}
```

每個 target 渲染為 compact chip：`<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-secondary text-xs">`，內容為 `{agent} · {scope} · {mode}`。scope 為 project 時追加 project 路徑的最後一段目錄名。

chip 點擊觸發 `onExpand`。最右邊 `+` 按鈕觸發 `onAdd`。

### 2. SkillEditor 整合

SkillEditor 新增 props：
- `targets: SkillTarget[]`
- `projectPath: string | null`
- `knownProjects?: KnownProject[]`
- `onTargetsChange?: () => void`

在 Document Header 的 Description 下方、分頁列上方渲染：
- `isNew` 時不渲染
- 收合態：`<TargetChips>`
- 展開態：`<TargetEditor>`（現有完整元件）

新增 `targetsExpanded` state 管理切換。

### 3. SkillsPage 修改

移除 SkillsPage 中獨立的 `<TargetEditor>` 渲染（`<div className="px-4 pt-4">` 包裹的區塊），改為將 target 相關 props 傳給 SkillEditor。

### 4. Sticky 整合

TargetChips / TargetEditor 位於 sticky header 區域內（Document Header 和分頁列之間）。展開態的 TargetEditor 內容可能較長，此時 TargetEditor 本身需要 `max-h` + `overflow-y-auto` 限制高度，避免 sticky 區域佔據太多畫面。建議 `max-h-[200px]`。

## Implementation Contract

### Task scope: TargetChips 元件
- 新增 `TargetChips.tsx`，渲染 compact chips + `+` 按鈕
- 驗證：`npm run check` 通過

### Task scope: SkillEditor 整合
- SkillEditor 新增 target 相關 props
- 收合/展開 toggle 切換 TargetChips / TargetEditor
- 驗證：`npm run check` 通過

### Task scope: SkillsPage 修改
- 移除獨立 TargetEditor 渲染
- 傳遞 target props 給 SkillEditor
- 驗證：`npm run check` + `npm run tauri dev` 手動驗證
