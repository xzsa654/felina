## Context

現有 SkillEditor 版面為垂直表單結構：toolbar（Save/Rename/Delete）→ Properties（Name input + Description textarea）→ Advanced（AgentFields + Extras，摺疊）→ Body（Markdown edit/preview）。SkillsPage 中 TargetEditor 獨立於 SkillEditor 上方渲染。

重構目標是轉為 Notion 風格文件中心化版面，此 change 處理骨架結構，不含 Target Chips、Split View、Settings 卡片化。

## Goals / Non-Goals

**Goals:**

- Name 顯示為大字體文件標題，不可編輯
- Description 以柔和色調緊接 Name 下方，仍為可編輯 textarea
- Action Bar 整合到 Document Header 右側
- Content / Settings 分頁骨架
- Sticky Header + 可捲動內容區
- Broken Raw Mode 隱藏分頁
- Dirty State 視覺標示

**Non-Goals:**

- Target Chips（後續 change）
- Split View 雙欄預覽（後續 change）
- Agent Fields 卡片化（後續 change）
- 後端修改

## Decisions

### 1. Document Header 結構

```
┌──────────────────────────────────────────────┐
│ skill-name *              [Rename][Del][Save] │
│ A brief description of the skill              │
├──────────────────────────────────────────────┤
│ [Content]  [Settings]                         │
└──────────────────────────────────────────────┘
```

- Name：`<h1>` 或 `<div>` with `text-2xl font-bold`，直接渲染 `skill.name`。不可編輯。`*` 號在有未儲存變更時出現。
- 新建模式：Name 改為可編輯的 `text-2xl` input（無邊框、無背景，`border-transparent focus:border-accent`），視覺上像 Notion 的 Untitled 佔位。
- Description：`<textarea>` with `text-sm text-text-secondary`，`rows={1}` auto-resize，無外框（`border-transparent focus:border-accent`）。
- Action Bar：`flex items-center gap-2`，位於 Name 行右側（`justify-between`）。按鈕順序：Cancel（僅新建）→ Rename → Delete → Save。

### 2. 分頁骨架

使用 `useState<"content" | "settings">` 管理 active tab（沿用現有 `activeTab` state）。

分頁列 DOM：
```tsx
<div className="flex gap-4 border-b border-border">
  <button className={activeTab === "content" ? "border-b-2 border-accent ..." : "..."}>
    Content
  </button>
  <button className={activeTab === "settings" ? "border-b-2 border-accent ..." : "..."}>
    Settings
  </button>
</div>
```

- Content 分頁：放現有 Body 區塊（edit/preview 切換 + textarea/MarkdownPreview）
- Settings 分頁：放現有 Advanced 區塊（AgentFieldsEditor + extras key-value rows），移除摺疊按鈕（因為已隔離到獨立分頁，預設展開）

### 3. Sticky Header

Document Header + 分頁列包裹在 `sticky top-0 z-10 bg-bg-primary` 容器中。下方 Content / Settings 區域設為 `flex-1 overflow-y-auto`。

外層結構：
```tsx
<div className="flex flex-col h-full">
  <div className="sticky top-0 z-10 bg-bg-primary">
    {/* Document Header */}
    {/* Tab bar */}
  </div>
  <div className="flex-1 overflow-y-auto p-4">
    {/* Content or Settings */}
  </div>
</div>
```

需驗證 sticky 在 SkillsPage 的 Panel 容器內是否正確運作（Panel 本身可能需要 `overflow-y-auto` 而非外層 scroll）。

### 4. Broken Raw Mode

`brokenRaw` 分支提前 return，不渲染 Document Header 的文件標題版面。保留獨立的紅色 Action Bar（現有的 rawTitle + Save 按鈕），隱藏分頁列，直接渲染滿版 textarea。結構與現有 brokenRaw 分支類似，只需確保不套用新的 Document Header wrapper。

### 5. Dirty State 標示

定義 `isDirty` 判斷邏輯：比較 name/description/body/extras/agentFields 與 `skill` props 的原始值。若任一不同，在 Name 旁顯示 `*`。

```tsx
const isDirty = useMemo(() => {
  if (isNew) return false;
  return name !== (skill?.name ?? "")
    || description !== (skill?.description ?? "")
    || body !== (skill?.body ?? "")
    || JSON.stringify(extras) !== JSON.stringify(initExtras(skill))
    || JSON.stringify(agentFields) !== JSON.stringify(skill?.agentFields ?? {});
}, [name, description, body, extras, agentFields, skill, isNew]);
```

顯示：
```tsx
<span className="text-2xl font-bold">{name}{isDirty && <span className="text-accent ml-1">*</span>}</span>
```

### 6. i18n 新增 keys

- `skills.editor.tabContent`: "Content" / "內容"
- `skills.editor.tabSettings`: "Settings" / "設定"

現有 keys 維持不變（`skills.editor.properties` 等不再使用但不主動刪除，避免影響其他地方）。

## Implementation Contract

### Task scope: Document Header 重構

- Properties 區塊（h3 "Properties" + Name input + Description textarea）替換為 Document Header（Name 大字體 + Description 無框 textarea）
- Action Bar 從獨立 toolbar 移到 Name 行右側
- 新建模式 Name 為可編輯 input（text-2xl，無邊框）
- 既有模式 Name 為不可編輯文字
- 驗證：`npm run check` 通過

### Task scope: 分頁骨架

- 新增 Content / Settings 分頁列（底線型）
- Content 放 Body（edit/preview），Settings 放 Advanced（AgentFields + extras）
- Settings 不再需要摺疊按鈕（ChevronDown/ChevronRight），改為預設展開
- 驗證：`npm run check` 通過

### Task scope: Sticky Header + Scroll

- Document Header + 分頁列 sticky
- Content / Settings 區域獨立捲動
- 驗證：`npm run tauri dev` 手動確認捲動行為

### Task scope: Broken Raw Mode

- brokenRaw 分支不渲染 Document Header / 分頁列
- 保留紅色 Action Bar + 滿版 textarea
- 驗證：手動觸發 broken skill 進入 raw mode 確認

### Task scope: Dirty State

- `isDirty` memo 比較 state 與 props
- Name 旁 `*` 標示
- 驗證：修改任一欄位後 `*` 出現，儲存後消失
