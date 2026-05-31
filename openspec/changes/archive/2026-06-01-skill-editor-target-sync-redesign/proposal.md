## Why

SkillEditor 的 Target 區域目前有兩個問題：(1) 同步狀態資訊（SyncInfoBar）獨立於 Target Chips 之外，造成資訊分離與視覺割裂；(2) TargetEditor 展開態沿用傳統資料庫清單風格（硬邊框、橫向按鈕群組），與已完成的 Document Header 文件中心化設計語彙不一致。本次將同步狀態融入 Target Chips、並將 TargetEditor 展開態重構為 Notion Metadata 面板風格，統一整體視覺語言。

## What Changes

- **SyncInfoBar 融合**：移除獨立的 SyncInfoBar 元件渲染，將同步狀態（synced/pending/missing）直接顯示在每個 Target Chip 上
  - 收合態：每個 chip 帶狀態 icon（✓ 已同步、● 待同步、! 專案遺失）
  - 展開態：TargetEditor 每行融入同步時間
  - siblingsDirty 警告以區域級指示取代逐 chip 重複
- **TargetEditor 改為 Popover**：點擊單一 chip 開啟該 target 的 Popover 懸浮面板（錨定在 chip 附近），取代原本的 inline 展開
  - Popover 內容：agent/location/mode（下拉選單）、同步時間、drift 警告、操作按鈕（檢視/開資料夾/刪除，幽靈按鈕風格）
  - 去線條化：Popover 內部無硬邊框，使用微弱分隔與留白
  - 關閉方式：點擊 Popover 外部或按 Esc
  - 不擠壓 Content 區域，維持文件編輯的視覺穩定性
- **資料流調整**：SkillsPage → SkillEditor → TargetChips 透傳 lastSync 與 knownProjects

## Non-Goals

- 不修改後端 Rust 指令或同步邏輯（純前端 UI 改動）
- 不變更 .felina-sync-meta.json 的 schema 或儲存格式
- 不處理 CoverageMatrix 或 SkillList 的視覺翻新（各有獨立 change）
- 不實作新的 target CRUD 功能

## Capabilities

### New Capabilities

（無新增 capability）

### Modified Capabilities

- `sync-info-ui`：同步狀態呈現方式從獨立 SyncInfoBar 改為融入 Target Chips，移除獨立元件渲染，chip 收合態直接帶狀態 icon，展開態顯示同步時間

## Impact

- 受影響 specs：sync-info-ui（呈現方式變更）
- 受影響程式碼：
  - Modified: src/lib/components/skills/TargetChips.tsx（props 擴展 + 狀態 icon + Popover 開關）
  - New: src/lib/components/skills/TargetPopover.tsx（單一 target 的 Popover 懸浮面板）
  - Modified: src/lib/components/skills/TargetEditor.tsx（移除 inline 展開邏輯）
  - Modified: src/lib/components/skills/SkillEditor.tsx（透傳 lastSync、knownProjects）
  - Modified: src/lib/components/skills/SkillsPage.tsx（移除獨立 SyncInfoBar 渲染，傳 lastSync 給 SkillEditor）
  - Modified: src/lib/components/skills/SyncInfoBar.tsx（抽出共用邏輯後可能刪除或保留為 reference）
- 無新增依賴（npm / Cargo）
- 無破壞性變更、無跨 change 依賴
