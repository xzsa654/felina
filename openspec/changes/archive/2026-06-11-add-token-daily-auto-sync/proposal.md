## Why

使用者點擊進入 /tokens 的 daily 分頁時,當天(today)的 token 資料應自動同步(refresh),讓使用者看到的是最新數字。這個進入即同步的行為先前存在,但在某次重構中被移除,導致進入 daily 後看到的是舊資料、必須手動按重新整理。此外,當使用者已在 daily 分頁、切到別的視窗再切回來時,資料也應自動 refetch(TanStack Query 內建 `refetchOnWindowFocus`,目前全域已開啟,但 daily 分析查詢需確認確實生效)。

## What Changes

- 進入 daily 分頁的同步事件:當使用者切換到 daily 分頁(`activeTab` 變為 `daily`)時,自動觸發一次 refresh 以同步當天資料;refresh 完成後沿用既有 `invalidateQueries(tokenKeys.all)` 重新載入,daily 圖表即顯示最新數字。
- 視窗重新聚焦時 refetch:daily 的分析查詢(`dailyQuery`)沿用 TanStack Query 全域 `refetchOnWindowFocus: true`,在使用者切回視窗時自動 refetch;確認 daily 查詢未以區域設定覆蓋關閉此行為。
- 避免重複觸發:進入 daily 的同步事件以「進入時觸發一次」為界,沿用既有 `prevTodayRef` 式的邊緣偵測模式,避免每次 re-render 重複 mutate。

## Non-Goals (optional)

- 不改動 token 數字的計算邏輯、來源選擇或後端 refresh 行為。
- 不更動 overview / models 分頁的載入或刷新行為。
- 不調整全域 `refetchOnWindowFocus` 預設值(維持 true);僅確保 daily 查詢生效。
- 不新增任何後端指令或 Tauri event。

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `token-analytics-dashboard`: 新增「進入 daily 分頁自動同步當天資料」與「daily 查詢於視窗重新聚焦時 refetch」兩項前端行為。

## Impact

- Affected specs: `token-analytics-dashboard`(修改)
- Affected code:
  - Modified:
    - src/lib/components/tokens/TokensPage.tsx
    - src/lib/components/tokens/hooks/useTokenQueries.ts
  - New: (none)
  - Removed: (none)
- 依賴變動:無新增 npm / Cargo 依賴(沿用既有 @tanstack/react-query)。
- 風險評估:純前端 UI 行為調整,無破壞性變更;需注意進入 daily 的同步事件不可造成重複 mutate 或無限 refetch 迴圈。屬 UI-related 變更。

## Archive Notes — UI Review（task 2.1)

`/felina-ui-guidelines` skill 不存在於本環境,改以人工審查記錄結論:

- **無新增視覺元件**:本 change 僅新增行為(進入 daily 自動同步、視窗重新聚焦 refetch),不引入任何新 UI 元素或版面。
- **既有視覺回饋已足夠**:進入 daily 觸發的 `refreshMutation` 沿用既有重新整理按鈕的 pending 狀態(`refreshMutation.isPending → RefreshCw animate-spin`),使用者在同步期間可見旋轉指示,符合既有載入回饋慣例。
- **無重複觸發**:`prevDailyTabRef` 初始化為「首次渲染是否已在 daily」,僅在 `activeTab` 由非 daily → daily 的轉換時觸發一次;停留在 daily 的 re-render 不再觸發(符合 spec scenario「Staying on the Daily tab does not re-trigger」)。直接深連結進入 daily(`?tab=daily`)不重複 mutate,交由查詢本身載入。
- **refocus 行為**:daily 分析查詢已合併入 `useAnalyticsPair`,未以區域設定覆蓋 `refetchOnWindowFocus`,沿用全域 `true`,無 deviation。

結論:無未說明的 UI deviation。

## Drift Note

本 change 提案時 daily 分析為獨立 `dailyQuery`(`useTokenAnalytics`);實作時程式碼已合併為 `analyticsPairQuery`(`useAnalyticsPair`,內含 monthly/daily/cache_efficiency)。tasks 1.2 已對應更新符號名稱,行為需求不變。

## TDD Note

`.spectra.yaml` 啟用 tdd,但前端無 React 元件測試框架(僅 `vitest` + 純邏輯 `.test.ts`,無 `@testing-library/react`/jsdom)。本 change 為 `TokensPage` 內的 effect 行為,task 自身驗證目標即為手動操作,故未新增自動化元件測試;為此單一 UI 行為引入元件測試堆疊屬過度設計。型別以 `tsc --noEmit`(exit 0)驗證。
