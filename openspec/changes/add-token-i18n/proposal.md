## Why

目前介面文字主要以英文硬編在 React components 中，使用者無法在中文與英文之間切換。先在 `/tokens` 引入 i18n 可驗證語系架構、翻譯資源組織與頁面整合方式，再逐步擴展到其他頁面。

## What Changes

- 新增前端 i18n 基礎能力，支援 English 與繁體中文兩種 locale。
- 新增語系狀態管理與切換入口，讓使用者可在 `/tokens` 頁面切換語言。
- 將 `/tokens` 及其直接子元件的使用者可見文字改為翻譯 key，包括標題、空狀態、載入狀態、表格欄位、圖表標籤、控制項與按鈕文字。
- 保留數值、日期與金額的現有資料來源；僅調整使用者可見文字與必要的 locale-aware formatting。

## Capabilities

### New Capabilities

- `frontend-i18n`: 前端應提供可切換的 English 與繁體中文翻譯能力，並先套用於 `/tokens` 使用者介面。

### Modified Capabilities

(none)

## Impact

- Affected specs: frontend-i18n
- Affected code:
  - New: src/lib/i18n/index.ts, src/lib/i18n/locales/en.ts, src/lib/i18n/locales/zh-TW.ts, src/lib/stores/locale.ts, src/lib/components/tokens/components/LanguageSwitcher.tsx
  - Modified: src/lib/components/tokens/TokensPage.tsx, src/lib/components/tokens/components/GranularityPicker.tsx, src/lib/components/tokens/components/DateRangeFilter.tsx, src/lib/components/tokens/components/TokenStatCards.tsx, src/lib/components/tokens/components/TokenTimeSeries.tsx, src/lib/components/tokens/components/TokenCostTimeSeries.tsx, src/lib/components/tokens/components/ModelBreakdownChart.tsx, src/lib/components/tokens/components/ModelBreakdownTable.tsx, src/lib/components/tokens/components/HourlyHeatmap.tsx, src/lib/components/tokens/components/CacheEfficiencyCard.tsx, src/lib/components/tokens/components/AgentDistribution.tsx, src/lib/components/tokens/components/AgentStatusPanel.tsx, src/lib/components/tokens/components/RefreshButton.tsx, src/lib/components/tokens/components/CostBudgetCard.tsx
  - Removed: (none)
