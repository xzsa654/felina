## 1. Baseline

- [x] 1.1 執行 npm run check 記錄現有 TypeScript errors/warnings 數量作為 baseline。驗證：npm run check 結果記錄

## 2. 去線條化與圓角選取態

- [x] 2.1 SkillList.tsx 移除 border-l-2 選取指示器，改為 mx-2 rounded-md。selected 項目使用 bg-bg-secondary 背景，hover 使用 hover:bg-bg-secondary/50（Rounded Selection Indicator 需求）。行為：選中的 skill row 顯示圓角填充背景，無左側邊框。驗證：npm run check 通過

## 3. 分組標題

- [x] [P] 3.1 SkillList.tsx 排序後根據 sortRank 分界插入群組標題 li 元素：rank 0 的項目上方插入 "Action Required" 標題，rank 1 的項目上方插入 "All Skills" 標題。若所有 skill 同屬一組則只顯示一個標題（Grouped Skill List with Section Headers 需求）。行為：列表中出現非互動式群組標題分隔不同優先級的 skill。驗證：npm run check 通過
- [x] [P] 3.2 i18n 新增 keys：en.ts 加 skills.list.groupActionRequired = "Action Required"、skills.list.groupAllSkills = "All Skills"；zh-TW.ts 加對應翻譯 "需要處理"、"所有技能"。行為：群組標題透過 t(locale, key) 取值。驗證：npm run check 通過（TypeScript TranslationDict 強制對齊）
- [x] 3.3 SkillList.tsx 的 sortRank 納入 drift：當 skill 有任一 target 的 driftMap 狀態為 "drifted" 時 rank 0（歸 Action Required）。drift 判斷沿用 render 現有的 driftMap[canonicalId] 邏輯，抽共用 helper 避免重複（Grouped Skill List with Section Headers 需求）。行為：偵測到 drift 的 skill 出現在 Action Required group。驗證：npm run check 通過

## 4. Agent Chip 精簡與 Push 按鈕可見性

- [x] [P] 4.1 SkillList.tsx 的 agent badge 改為小型 chip，只顯示 agent，省略 location 與 mode 欄位。chip 依 agent 去重（同一 skill 多個同 agent target 只顯示一個 chip）（Compact Agent Chip Format 需求）。行為：每個 skill row 的 agent chip 顯示如 "claude" 或 "gemini"。驗證：npm run check 通過
- [x] [P] 4.2 SkillList.tsx 的 Push 按鈕加 group + opacity-0 group-hover:opacity-100 過渡動畫；dirty 狀態時移除 opacity-0 使按鈕永遠可見（Contextual Push Button Visibility 需求）。行為：dirty skill 的 push 按鈕常駐可見，非 dirty skill 的 push 按鈕僅 hover 時浮現。驗證：npm run check 通過
- [x] 4.3 SkillList.tsx chip 改為 agent brand icon：建立 `AgentId → icon 資產` 對應（anthropic→claude.svg、codex→codex.png，import 自 `$lib/assets/`），有 icon 的 agent 以 `<img>`（含 alt/title=agent 名）呈現、無 icon 者沿用文字 fallback。gemini 暫以 antigravity.png 呈現（後續會另開 change 把 gemini 全面換成 antigravity）（Compact Agent Chip Format 需求）。行為：list chip 顯示 claude/codex/antigravity logo。驗證：npm run check 通過

## 5. 驗證

- [x] 5.1 執行 npm run check 確認零新增 TypeScript errors（與 baseline 比較）。驗證：error 數 ≤ baseline
- [x] 5.2 npm run tauri dev 手動驗證以下行為：(a) 選中項目為圓角背景無左邊框、(b) hover 項目有微弱背景色、(c) 群組標題正確顯示（Action Required / All Skills 或單一標題）、(d) agent chip 顯示 brand icon（claude/codex/antigravity），無 location/mode、(e) dirty skill push 按鈕常駐可見、(f) clean skill push 按鈕 hover 才出現。驗證：逐項目視確認
