## Summary

ProjectsPage 右側面板從傳統後台表格翻新為極簡現代風格，與 SkillEditor 重構後的設計語彙對齊。ManagedInventory 從 table 改為清單式佈局，加入 Project Summary Header，統一 Agent Chips Design System。

## Motivation

SkillEditor 已完成文件中心化重構（去格線化、pill toggle、Brand icon、Target Chips + Popover），但 ProjectsPage 的 ManagedInventory 仍是傳統 table + 生硬框線 + 文字標籤風格，造成頁面間視覺割裂。此外，使用者進入專案頁面時缺乏一眼可見的專案狀態摘要。

## Proposed Solution

1. **Project Summary Header**：右側面板頂部加入專案名稱（路徑末段大字體）+ 狀態數據摘要（`N Discovered · M Managed`）
2. **去表格化**：捨棄 ManagedInventory 的 table 結構，改為上下堆疊清單（Discovered 收件匣在上，Managed 盤點在下）。無 Discovered 時該區塊隱藏
3. **Agent Chips 統一**：從硬編碼 `AGENT_CHIP_LABEL` 文字改為與 SkillList 一致的 brand icon chip（claude.svg / codex.png / antigravity.png）
4. **狀態融入**：移除獨立 Status 欄位，以小型 Badge 或標題色深淺融入清單項目
5. **清單項目互動**：hover 整行背景色（與 CoverageMatrix 同風格），Managed 項目可點擊跳轉到 Skills 頁面對應 skill

## Non-Goals

- 不修改 Import 流程的互動方式（Inline Drawer 為後續獨立 change）
- 不修改左側 ProjectsList 的結構（僅右側面板翻新）
- 不修改後端指令或資料來源邏輯（純前端 UI 改動）
- 不修改 `managed-inventory.ts` 的 `buildInventoryRows` 資料邏輯（row 結構不變）

## Alternatives Considered

- **分頁形式（Tabbed Layout）**：Discovered / Managed 分頁。被排除因為分頁會把「待處理」藏起來，多一步切換成本，且 Discovered 數量通常少且短暫
- **卡片式佈局（Card Grid）**：每個 skill 一張獨立卡片。被排除因為資訊密度太低，skill 數量多時佔太多空間

## Impact

- Affected specs: `projects-view`（呈現方式變更）
- Affected code:
  - Modified: `src/lib/components/projects/ManagedInventory.tsx`（主要重構目標：table → 清單）
  - Modified: `src/lib/components/projects/ProjectsPage.tsx`（加入 Summary Header）
  - Modified: `src/lib/i18n/locales/en.ts`（新增 i18n keys）
  - Modified: `src/lib/i18n/locales/zh-TW.ts`（新增 i18n keys）
- 無新增檔案、無刪除檔案、無新增依賴
