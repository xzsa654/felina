## 1. Baseline

- [x] 1.1 執行 `npm run check`，記錄現有 TypeScript error 數作為 baseline。驗證：保留摘要供 9.x 比對。

## 2. Borderless Search Input above SkillList

- [x] 2.1 在 `src/lib/components/skills/SkillsPage.tsx` 新增受控狀態 `const [searchQuery, setSearchQuery] = useState("")` 並把 `searchQuery` / `onSearchChange` 兩個 prop 傳進 `SkillList`。Search 狀態 SHALL 由 SkillsPage 擁有以便未來與 scope toggle 共存且不在切換時重置。驗證：`npm run check` 通過。
- [x] 2.2 在 `src/lib/components/skills/SkillList.tsx` 元件頂部加入 borderless search input：`<div>` 容器 + leading `<Search size=14>` lucide icon + `<input>`。樣式 SHALL 為 `bg-transparent`、無 border、focus 時改用 `bg-bg-secondary/40` 而非加 border、`placeholder:text-text-muted`、字級對齊 list row。input 透過新 prop `value={searchQuery}` 與 `onChange={onSearchChange}` 受控。驗證：UI 視覺上 input 與 list 屬同一區塊、不獨立成 toolbar。
- [x] 2.3 在 SkillList 內以 `useMemo` 加入 filter 步驟：對既有 `entries` 先做 `name + description` case-insensitive substring filter，filter 後的陣列再 feed 到既有 `sortedEntries` 計算。空字串 query SHALL 等同不過濾。涵蓋 `List Search Input` 的 real-time filter / empty restore / description match 三個 scenario。驗證：新增 vitest 覆蓋三個 scenario 對應的 example。

## 3. Four-Group SortRank Schema

- [x] 3.1 在 `SkillList.tsx` 將 `sortRank(e, drifted)` 從原本回傳 `0|1` 改為回傳 `0|1|2|3`：rank 0 = `broken || drifted`、rank 1 = `dirty`、rank 2 = 無 enabled target（targets 為空，或全部 `enabled === false`）、rank 3 = 其餘。順序判定 SHALL 為「broken/drifted 優先，再 dirty，再 no-enabled-target」以維持「needs attention 訊號最強」的設計意圖。驗證：新增 vitest 覆蓋 6 case（broken / drifted / dirty / zero-targets / all-disabled / clean）的 rank 推導。
- [x] 3.2 在 `SkillList.tsx` 渲染 loop 將既有 group header 文字從 `groupActionRequired` / `groupAllSkills` 改為依 rank 切換四個新 key：`groupNeedsAttention`（0） / `groupNeedsPush`（1） / `groupNotConfigured`（2） / `groupReady`（3）。涵蓋 `Grouped Skill List with Section Headers` 的「mixed states 四 header」與「single-group 只顯示一個 header」兩個 scenario。驗證：手動觀察四種狀態 fixture 都各自獨立 header；空段不出現 header。

## 4. Per-Agent Inline Scope Marker

- [x] 4.1 [P] 在 `SkillList.tsx` 加入純函式 `agentScopeMap(targets: SkillTarget[]): Map<AgentId, { global: boolean; project: boolean }>`：對 enabled 且非 detached / forked / disabled 的 targets 依 agent 聚合 scope 存在性；同 agent 同 scope 不重複計入。驗證：新增 vitest 覆蓋四個 example（single global、mixed scope same agent、multi-agent mixed scope、disabled excluded）。
- [x] 4.2 在 row 內把原本 `chips = [...new Set(skill.targets.map(t => t.agent))]` 加 icon 的迴圈替換為：依 `agentScopeMap` 順序輸出 `<img agent/>` 後緊跟 `<Globe size=12 muted/>` / `<Folder size=12 muted/>`（依該 agent 的 global / project flag）。每個 agent unit 之間以 `gap-2`、unit 內 agent icon 與 scope marker 之間 `gap-0.5`，視覺上 agent + scope 為一組。Scope icon 統一 `text-text-muted`。涵蓋 `Per-Agent Scope Marker in List Row` 四個 scenario 的 visual layout 要求。驗證：手動驗證四個 fixture 對應的 example 顯示順序與 marker 數量符合。

## 5. i18n

- [x] [P] 5.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 的 `skills.list` 命名空間新增：
  - `searchPlaceholder`：「搜尋 skill…」/「Search skills…」
  - `groupNeedsAttention`：「需要處理」/「Needs Attention」
  - `groupNeedsPush`：「待推送」/「Needs Push」
  - `groupNotConfigured`：「未配置」/「Not Configured」
  - `groupReady`：「已就緒」/「Ready」
  舊有 `groupActionRequired` / `groupAllSkills` key SHALL 保留（不刪，未來若 archive 引用），但 SkillList 不再 reference。驗證：`npm run check` 通過；grep 確認新元件使用的 key 在兩個 locale 檔皆有定義。

## 6. Verification

- [x] 6.1 執行 `npm run check`，確認 TypeScript error 數 ≤ task 1.1 baseline。
- [x] 6.2 執行 `npx vitest run src/lib/components/skills/` 確認新增的純函式測試（sortRank、agentScopeMap、search filter）全通過。
- [x] 6.3 啟動 `npm run tauri dev` 手動驗證六情境：
  - (a) 輸入「foo」list 即時剩名字 / 描述含 foo 的 row；清空還原
  - (b) 同時有 broken / drifted / dirty / no-target / clean 五種 skill 時，list 顯示四個 header 依序為「需要處理」「待推送」「未配置」「已就緒」
  - (c) 只有 clean skill 時只顯示「已就緒」一個 header
  - (d) 一個 skill 同時有 anthropic global + anthropic project → row 顯示 `<claude><Globe><Folder>` 一組（Folder 只一個）
  - (e) 一個 skill 同時有 anthropic global + codex project → row 顯示 `<claude><Globe>` 與 `<codex><Folder>` 兩組，兩組間 gap 較大
  - (f) Skill 有一個 disabled global anthropic + 一個 enabled project anthropic → row 只顯示 `<claude><Folder>`，無 Globe
