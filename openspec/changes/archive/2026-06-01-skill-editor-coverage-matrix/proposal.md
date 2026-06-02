## Summary

將 CoverageMatrix 摘要檢視從傳統格線風格翻新為極簡現代風格，與 SkillEditor 的文件中心化設計語彙對齊，並升級為導航樞紐。

## Motivation

Skills 頁面已完成 SkillEditor 的文件中心化重構（Document Header、Target Chips、Content 分頁），但切換到 CoverageMatrix 摘要檢視時，傳統的格線邊框和純文字狀態符號造成明顯的視覺割裂感。需要統一設計語言，同時提升 CoverageMatrix 從純展示到導航樞紐的功能性。

## Proposed Solution

1. **去格線化**：移除 gap-px 和 cell 的 border-b border-border/50，data row 改用 hover:bg-bg-secondary/20 group hover，保留 header 底線作為 header/data 分界
2. **狀態圖示精緻化**：純文字符號（✓, ●, ⚠）升級為帶狀態色微弱底色圓角 Badge（如 inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/10 text-success）
3. **導航樞紐**：Skill 名稱加 cursor-pointer + hover 回饋，新增 onSkillClick prop，點擊後切換回 List 模式並展開對應 SkillEditor

## Non-Goals

- 不修改 CoverageMatrix 的資料來源或計算邏輯
- 不新增後端指令（純前端 UI 改動）
- 不變更 CoverageMatrix 的欄位結構（agent 欄位不增減）

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `coverage-matrix`：CoverageMatrix 視覺風格從格線化改為無邊框 hover 行，狀態 icon 升級為圓角 Badge，新增 skill 名稱點擊導航功能

## Impact

- 受影響 specs：coverage-matrix（呈現方式與互動變更）
- 受影響程式碼：
  - Modified: src/lib/components/skills/CoverageMatrix.tsx（去格線化、Badge 升級、onSkillClick prop）
  - Modified: src/lib/components/skills/SkillsPage.tsx（傳 onSkillClick callback）
- 無新增依賴
- 無破壞性變更
