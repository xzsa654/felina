## Summary

將 SkillList 側邊欄從「傳統檔案列表」升級為「現代化筆記本側欄」，與右側 SkillEditor 的 Notion 風格設計語彙對齊。

## Motivation

Skills 頁面右側的 SkillEditor 已完成文件中心化重構，但左側 SkillList 仍使用 border-l-2 選取指示器和平面列表排列。視覺風格差異在頁面左右兩側形成割裂感，需要統一為圓角選取態、分組標題、精簡 chip 的現代側欄風格。

## Proposed Solution

1. **去線條化與圓角選取態**：移除 border-l-2 選取指示器，改為 mx-2 rounded-md + bg-bg-secondary（selected）/ hover:bg-bg-secondary/50（hover）
2. **明確分組排序**：保留現有 sortRank 邏輯（broken/dirty/無 target 置頂），在排序後根據 sortRank 分界插入群組標題（Action Required / All Skills）。若所有 skill 同屬一組則只顯示一個標題
3. **標籤精簡**：Agent badge 改為只顯示 agent 的小型 chip（省略 location 與 mode，依 agent 去重，保持緊湊）
4. **Push 按鈕可見性**：dirty 時永遠顯示，非 dirty 時 hover 才浮現（opacity-0 group-hover:opacity-100）

## Non-Goals

- 不修改排序邏輯本身（sortRank 函式不變）
- 不修改後端指令（純前端 UI 改動）
- 不新增搜尋或篩選功能

## Capabilities

### New Capabilities

- `skill-list-presentation`：SkillList 側欄的分組標題、圓角選取態、精簡 chip 格式、Push 按鈕條件可見性

### Modified Capabilities

（無）

## Impact

- 受影響程式碼：
  - Modified: src/lib/components/skills/SkillList.tsx（去線條化、圓角選取態、分組標題、chip 格式、push 按鈕可見性）
  - Modified: src/lib/i18n/locales/en.ts（新增 skills.list.groupActionRequired、skills.list.groupAllSkills）
  - Modified: src/lib/i18n/locales/zh-TW.ts（對應翻譯）
- 無新增依賴
- 無破壞性變更
