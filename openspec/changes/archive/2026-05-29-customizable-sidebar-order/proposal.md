## Why

目前左側的主導覽列 (Sidebar) 項目順序是固定的。為了讓使用者能依據個人工作習慣 (例如頻繁查看 Tokens 或切換 Projects) 自訂常用項目的位置，我們需要引進拖曳重新排序 (Drag and Drop) 的功能，以提升整體的客製化操作體驗。

## What Changes

- 引入 `@dnd-kit/core`、`@dnd-kit/sortable` 等純邏輯拖曳套件。
- 將 `Sidebar.tsx` 中的導覽選單重構為 SortableContext，讓各選項支援拖曳對調。
- 在 `navigation.ts` Zustand store 中加入儲存自訂順序 (Custom Order) 的 state。
- 使用 Zustand 的 `persist` middleware 將排序偏好持久化至瀏覽器的 LocalStorage。
- 確保當 App 未來新增預設路由時，能正確合併至使用者自訂的順序列表中。

## Non-Goals (optional)

- 不實作「隱藏特定導覽項目」的功能（這將由其他的 UX 優化專案處理）。
- 不改變目前註冊的導覽頁面集合，僅改變渲染順序。

## Capabilities

### New Capabilities

- `sidebar-navigation-order`: 定義 Sidebar 項目排序的互動規則、持久化機制以及與預設選單的合併邏輯。

### Modified Capabilities

(none)

## Impact

- Affected specs: `sidebar-navigation-order` (新增)
- Affected code:
  - Modified: `package.json` (新增依賴 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)
  - Modified: `src/lib/components/layout/Sidebar.tsx` (實作拖曳 UI)
  - Modified: `src/lib/stores/navigation.ts` (實作排序狀態與持久化)
