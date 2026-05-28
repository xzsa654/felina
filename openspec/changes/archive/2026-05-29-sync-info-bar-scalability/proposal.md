## Summary

將 `SkillsPage` 頂部的 Target 同步資訊重構為獨立元件，並採用「依狀態分組的摘要 Chip」設計，以解決 Agent 數量擴增時的 UI 縮放與版面佔用問題。

## Motivation

隨著使用者配置的 target 數量增加，目前在 `SkillsPage.tsx` 頂部使用直列 `<ul>` 顯示所有 target 狀態的方式會導致版面垂直空間過度消耗。透過將同步資訊改為依狀態分組的摘要 Chip（例如：`[✓ 8 Synced] [— 1 Pending] [! 1 Missing]`），並僅在需要時展開詳細清單，能在維持高資訊密度的同時，大幅提升介面的擴充性與易讀性。

## Proposed Solution

- 將目前的 Target 列表抽出為獨立的 `<SyncInfoBar>` 元件。
- 將同步資料依據狀態分類，預設只顯示摘要 Chip。
- 將需要關注的狀態（如尚未同步、路徑遺失）預設展開，成功的狀態預設摺疊。
- 點擊摘要 Chip 後可展開對應的完整 target 清單。

## Capabilities

### New Capabilities

- `sync-info-ui`: 規範多 target 同步資訊區塊的 UI 縮放與狀態呈現邏輯。

### Modified Capabilities

(none)

## Impact

- Affected specs: `sync-info-ui`
- Affected code:
  - Modified: `src/lib/components/skills/SkillsPage.tsx`
  - New: `src/lib/components/skills/SyncInfoBar.tsx`
