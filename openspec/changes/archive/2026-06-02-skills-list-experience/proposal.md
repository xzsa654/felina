## Summary

Skills page 左欄 list 加上 search、把現有兩段分組擴成四段、在 agent icon 旁加上 scope 標記，提升「快速找到 + 即時看出狀態 + 一眼看出 scope」的列表體驗。

## Motivation

目前 SkillList 有兩個體驗痛點：

1. **找不到** — list 沒有 search input，使用者只能靠目視滾找。Skills 數量增加後，定位特定 skill 的成本線性上升。
2. **「需要處理」群混雜** — 現行 `sortRank` 把 broken / dirty / targets.length===0 / drifted 全部塞進「Action Required」一群。其中 `targets.length === 0` 是「剛建還沒配置」，跟「broken / dirty / drifted」的「需要決定 / 動手修」性質完全不同，混在一起淡化了「需要處理」的訊號強度。
3. **list icon 看不出 scope** — 現行 list row 只顯示 distinct agent icon set，看不出該 skill 的 target 是全域、專案、或兩者皆有。使用者必須點進去看 TargetChips 才知道。

## Proposed Solution

**1. List search input**
在 `SkillList` 容器頂部加 borderless search input：transparent 背景、leading lucide `Search` icon、focus 時換 subtle 底色而不是加 border、placeholder「搜尋 skill」。Filter 規則：對 `name + description` 做 case-insensitive substring match，過濾後的 entries 才參與後續的分組與排序。

**2. 4 群分組**
把現有 `sortRank` 從 0/1 兩段擴成 0/1/2/3 四段：
- rank 0 = broken + drifted（**需要處理**）
- rank 1 = dirty（**待推送**）
- rank 2 = 無 enabled target（targets 為空，或全部 disabled）（**未配置**）
- rank 3 = 其餘（**已就緒**）

群 header 沿用現有的 uppercase tracking-wider small caps style，i18n 新增四個 key。

**3. Per-agent inline scope marker**
List row 的 agent icon set 視覺改成：每個 agent icon 後緊跟 lucide `Globe`（該 agent 有 global target）/ `Folder`（該 agent 有 project target）icon，size 12、`text-text-muted`。同 agent 跨多個 project 仍只一個 Folder icon；同 agent 跨 G+P 則 Globe + Folder 兩個都出現。`<img claude/> <Globe/> <Folder/>` 視為「一組標記」，符合「狀態資訊不獨立成塊」的 Felina UI Guideline。

## Non-Goals

- 不做 fuzzy match（之後若有需要再評估 fuse.js 等 lib）
- 不做 search input 之外的 filter（例如 by-agent、by-scope filter 按鈕）— scope creep
- 不做群組摺疊（collapsible section）
- 不做 list row 拖曳排序（Target chip 拖曳是另一條獨立 change）
- 不抽 `<AgentScopeBadge>` 共用元件（design.md 標記為未來候選；本次只在 list 內 inline 實作）
- 不修改後端 — 純前端 change
- 不調整 `TargetChips`（SkillEditor 那邊的 fat chip）

## Alternatives Considered

- **Search 做成獨立 toolbar 列**：違反 Felina UI Guideline「文件中心化」「狀態資訊不獨立成塊」；拒絕。
- **scope flag 做成獨立 badge `(G)`/`(P)`**：UI Guideline II.2 指 metadata 應「融入」既有元素，獨立 badge 形成資訊塊；拒絕，改 inline icon。
- **3 群分組（needsAttention + needsPush + ready，未配置歸入 ready）**：早期討論方案 X；最終使用者選 4 群（方案 Y），因為「未配置」應該獨立標示讓使用者知道「我有未完成的 setup」，混進 ready 反而會讓人忽略。
- **Globe/Folder 用 emoji `🌐📁`**：emoji 跨平台渲染不一致；改用 lucide icon 與專案 UI 風格一致。
- **(G)(P) 用文字字母**：可行但語意辨識比 icon 慢一拍；最終選 lucide icon。

## Impact

- Affected specs:
  - `skill-list-presentation`（MODIFIED — 分組從 2 段改 4 段，新增 search 與 scope marker）
- Affected code:
  - Modified:
    - `src/lib/components/skills/SkillList.tsx`
    - `src/lib/components/skills/SkillsPage.tsx`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
  - New: (none)
  - Removed: (none)
