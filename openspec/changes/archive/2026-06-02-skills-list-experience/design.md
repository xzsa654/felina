## Context

Skills page 左欄 `SkillList` 目前以 `sortRank` 將 entries 分成 0 (Action Required) 與 1 (All Skills) 兩段，無 search input。Row 內顯示 distinct agent icon set 但不帶 target scope 資訊；scope（global / project）只能透過點選後在 SkillEditor 的 fat `TargetChips` 看到。

UI 受 Felina 設計語彙約束（文件中心化、去線條化、狀態資訊融入元素），search input 與 scope marker 都不能以「外掛 toolbar / 獨立 badge」方式存在。

## Goals / Non-Goals

**Goals**

- 加入 borderless list search input，即時 filter 名字與描述
- 將 `sortRank` 從兩段擴成四段，讓「需要處理 / 待推送 / 未配置 / 已就緒」訊號分離
- 在 list row 的 agent icon 旁加 lucide Globe / Folder scope marker，使用者不點開就能看 scope

**Non-Goals**

- 不引入 fuzzy match lib
- 不抽 `<AgentScopeBadge>` 共用元件（標記為未來候選）
- 不調整 SkillEditor 內的 fat `TargetChips`
- 不做 group 摺疊 / by-scope filter button / 拖曳排序
- 不動後端

## Decisions

### Borderless Search Input above SkillList

Search input 放在 `SkillList` 容器頂部、與 list header 同 padding，視覺上屬於 list 區塊的一部分而非獨立 toolbar。樣式：`bg-transparent` + leading `<Search size=14>` icon + `placeholder:text-text-muted` + `focus:bg-bg-secondary/40` 取代 border。Filter 邏輯純前端 client-side、case-insensitive substring match 對 `name + description`。

替代方案：boxed input 或獨立 toolbar — 違反 Felina UI Guideline「文件中心化」與「狀態資訊不獨立成塊」，拒絕。

### Four-Group SortRank Schema

`sortRank(entry, drifted)` 改回 0/1/2/3 四段：

- rank 0：`broken` 或 `drifted`（需要處理）
- rank 1：`dirty`（待推送）
- rank 2：無 enabled target（`targets` 為空，或全部 `enabled === false`）（未配置）
- rank 3：以上皆非（已就緒）

群 header 沿用現有 `<li>` 的 uppercase tracking-wider 樣式，i18n 新增四個 key：`groupNeedsAttention`、`groupNeedsPush`、`groupNotConfigured`、`groupReady`。

替代方案：三段（未配置歸入已就緒） — 拒絕，因為「我有未完成 setup」本身是一個需要顯眼的訊號。

### Per-Agent Inline Scope Marker

List row 內，原本 `distinct agents` 的 icon set 改為「per-agent 一組標記」：每個 agent icon 後緊跟 lucide `Globe`（該 agent 至少有一個 enabled global target）/ `Folder`（該 agent 至少有一個 enabled project target）icon。聚合規則：

- 同 agent 跨多個 project target → 只顯示一個 `Folder`
- 同 agent 同時有 G + P → `Globe` 與 `Folder` 兩個都出現，緊跟在該 agent icon 之後
- 無 target 的 agent → 不會出現在 row（這條 row 會落到 rank 2「未配置」）

視覺：`<img claude/> <Globe size=12 muted/> <Folder size=12 muted/>` 為一個 unit，unit 之間用較大 gap 區隔。scope icon 統一 `text-text-muted` 避免搶眼。資料來源沿用 `skill.targets`，filter 條件 `isTargetAvailable`（excluding detached / forked / disabled）。

替代方案：
- 文字 `(G)(P)` — 語意辨識較慢
- emoji 🌐📁 — 跨平台渲染不一致
- 獨立 badge `(G)(P)` 分塊 — 違反「狀態資訊不獨立成塊」
都拒絕。

_Follow-up note (not in scope for this change): 長期上，list 用 icon-only 表示與 SkillEditor 用 fat `TargetChips` 是同一個 metadata（agent + scope + status）的兩種表示。Felina UI Guideline II.2 暗示應抽共用元件 `<AgentScopeBadge>` 統一兩處。本次 change 不做（scope creep），但留下這條 follow-up 候選。_

## Implementation Contract

**Behavior**

- 進入 Skills page，list 容器頂部 SHALL 出現一個 borderless search input。使用者在 input 中輸入字串時，list SHALL 即時 filter — 只顯示 `name` 或 `description` 包含該 substring（case-insensitive）的 entries；空字串時 SHALL 顯示所有 entries。
- Filter 後的 entries SHALL 依四段 `sortRank` 規則重新分組與排序，每段 SHALL 由一個 group header `<li>` 起頭（除非該段為空）。
- 每個 list row 內 SHALL 為每個 distinct agent（取自該 skill 的 enabled targets）渲染：一個 agent icon + 跟在後的 scope marker icon 集合（`Globe` if any global target with that agent；`Folder` if any project target with that agent）。
- Filter 與分組 / scope marker 計算 SHALL 不修改任何後端資料，純前端 derive。

**Interface / data shape**

- `SkillList` props 不變；新增受控 `searchQuery: string` 由 `SkillsPage` 傳入（input state 升到 page）。
- 既有 `sortRank` 函式簽章不變，回傳值從 `0|1` 變成 `0|1|2|3`。
- 群 header i18n key 替換：移除既有 `groupActionRequired` / `groupAllSkills` 的使用點（key 本身保留供向後相容，但 list 不再 reference）；新增四個 key。

**Failure modes**

- Search input 空字串：顯示所有 entries（不過濾）
- Filter 後 0 結果：顯示既有 `skills.list.empty` 文案
- skill 的 targets 全 disabled / detached / forked：該 agent 不會出現 scope marker（也不會出現 agent icon）
- broken entry：沒有 targets，直接落到 rank 0（broken）；不會 render agent icon group
- 多 source 同 agent + 同 scope：只顯示一個 scope icon（不重複）

**Acceptance criteria**

- 在 SkillsPage 開啟狀態下：
  - 輸入「foo」→ list 只剩名字或描述含「foo」的 row
  - 清空輸入 → list 還原
  - 切換 scope toggle（global / project） → search query 不被重置
- 有 4 種不同狀態的 skills 同時存在時，list 顯示 4 個 group header 且順序為：需要處理 → 待推送 → 未配置 → 已就緒
- 一個 skill 同時有 anthropic global + anthropic project + codex project 三個 target → list row 顯示：`<claude><Globe><Folder> <codex><Folder>`
- `npm run check` 無新增 TypeScript error
- 新增至少一個前端 vitest 覆蓋四段 sortRank 推導（per case：broken / drifted / dirty / no-target / clean）

**Scope boundaries**

- In scope：`SkillList.tsx` + `SkillsPage.tsx`（search input host） + en / zh-TW i18n 四個新 group key 與 placeholder
- Out of scope：SkillEditor `TargetChips`、後端任何修改、shared `AgentScopeBadge` 元件抽離、scope toggle 邏輯、coverage matrix、drift detection 行為

## Risks / Trade-offs

- [Risk] 四段分組讓 list 上方多兩個 header，畫面看起來「東西變多」。→ Mitigation：實際 user 場景多半只有兩三種狀態同時存在；空的 group 不顯示 header。
- [Risk] Search input 提升 list state 到 SkillsPage 增加 props 傳遞層級。→ Mitigation：SkillsPage 已是 search 與 scope toggle 的合理 host；接受。
- [Risk] Per-agent scope marker 在同 agent 多 target 時聚合成單一 icon，失去「N 個 project」的計數。→ Mitigation：使用者偏好簡潔；要看精確數量本來就要點進去 SkillEditor。
- [Risk] 未抽 `<AgentScopeBadge>` 導致同樣的 agent+scope 概念在 list / SkillEditor 各有一套渲染。→ Mitigation：design 留下 follow-up 候選；本次保持 scope 收斂。

## Migration Plan

純前端 UI 改動，無 data migration。

## Open Questions

無未決問題。
