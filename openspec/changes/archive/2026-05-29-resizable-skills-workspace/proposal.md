## Why

目前 Skills 頁面的左側清單與右側編輯器為固定寬度或單純的 Flex 比例。當使用者的 Skill 數量變多，或者需要較寬的編輯/預覽空間時，固定寬度會造成瀏覽與編輯的雙重不便。引入可調整寬度與可收合的機制能大幅提升工作流的可用性。

## What Changes

- 引入無樣式的輕量邏輯套件 `react-resizable-panels`。
- 重構 `SkillsPage.tsx`，將原有的 flex layout 改為 `PanelGroup` 包覆。
- 實作左側清單可拖曳調整寬度，設定合理的最小與最大寬度。
- 實作左側清單的收合 (Collapse) 行為，讓使用者可專注於右側編輯器。
- 將使用者的寬度偏好透過 `react-resizable-panels` 的 `autoSaveId` 機制存入瀏覽器 `localStorage`，確保重開後維持佈局。

## Non-Goals (optional)

- 不涉及其他頁面 (如 Projects, Tokens) 的佈局修改。
- 不引入帶有樣式的 UI 框架庫，拖曳把手 (Resizer handle) 仍使用純 Tailwind 繪製以保持視覺一致性。

## Capabilities

### New Capabilities

- `skills-workspace-layout`: 定義 Skills 頁面的左右分割、可拖曳寬度與收合的行為規範。

### Modified Capabilities

(none)

## Impact

- Affected specs: `skills-workspace-layout` (新增)
- Affected code:
  - Modified: `package.json` (新增 `react-resizable-panels` 依賴)
  - Modified: `src/lib/components/skills/SkillsPage.tsx` (版面重構)
  - New: `src/lib/components/skills/ResizableHandle.tsx` (純樣式把手元件)
