## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline。驗證：npm run check 結果記錄

## 2. 去格線化與 Row Hover

- [x] 2.1 CoverageMatrix.tsx 移除 data row 的 gap-px 和 cell border-b border-border/50，改為整行 group hover:bg-bg-secondary/20。保留 header 底線作為 header/data 分界（Coverage Matrix View 需求）。行為：data row 無邊框，hover 時整行微弱背景色。驗證：npm run check 通過

## 3. 狀態 Badge 升級

- [x] 3.1 CoverageMatrix.tsx 中將純文字狀態符號（✓, ●, —, ○）替換為圓角 Badge 元件：每個 Badge 為 inline-flex items-center justify-center w-5 h-5 rounded-full，搭配語意色底色（bg-success/10 text-success 等）（Coverage Matrix View 需求）。行為：每個 cell 的狀態以帶底色圓角 Badge 呈現。驗證：npm run check 通過

## 4. 導航樞紐

- [x] 4.1 CoverageMatrix.tsx 新增 onSkillClick?: (name: string) => void prop。Skill 名稱欄加 cursor-pointer + hover:text-accent 回饋，點擊時呼叫 onSkillClick（Coverage Matrix View 需求）。行為：skill 名稱可點擊且有 hover 視覺回饋。驗證：npm run check 通過
- [x] 4.2 SkillsPage.tsx 傳 onSkillClick callback 給 CoverageMatrix，callback 執行 setViewMode("list") 並 setSelectedName(name)，實現從摘要檢視點擊 skill 名稱後切換到 List 模式並展開對應 SkillEditor。行為：點擊 skill 名稱後自動切換到 List 模式並選中該 skill。驗證：npm run check 通過

## 5. 驗證

- [x] 5.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 5.2 npm run tauri dev 手動驗證以下行為：(a) CoverageMatrix 無格線邊框、(b) data row hover 整行背景色、(c) 狀態 cell 顯示圓角 Badge 且色系正確、(d) skill 名稱 hover 回饋 + 點擊切換到 List 模式並展開對應 skill、(e) 空 skill 狀態顯示正常。驗證：逐項目視確認
