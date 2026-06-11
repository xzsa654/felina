## 1. 前端行為實作

- [x] 1.1 實作 **Daily tab auto-syncs current-day data on entry**:在 `TokensPage` 新增進入 daily 分頁的邊緣偵測 effect(沿用 `prevTodayRef` 式 ref),當 `activeTab` 由非 daily 變為 daily 時觸發一次 `refreshMutation.mutate()`,完成後沿用既有 `invalidateQueries(tokenKeys.all)`;daily 持續 active 期間的 re-render 不得重複觸發(`TokensPage.tsx`)。驗證:手動操作切到 daily 觀察僅發出一次 refresh、daily 圖表更新為當天最新資料;停留在 daily 重新渲染不再額外觸發。
- [x] 1.2 [P] 實作 **Daily analytics refetches on window refocus**:確認 daily 分析查詢(現已合併為 `analyticsPairQuery` / `useAnalyticsPair`,內含 daily 區段)未以區域設定關閉 `refetchOnWindowFocus`,使其沿用全域 `refetchOnWindowFocus: true`(`hooks/useTokenQueries.ts`,參照 `src/lib/queryClient.ts`)。驗證:在 daily 分頁切換到其他視窗再切回,觀察 daily 查詢自動 refetch(React Query devtools 或網路/IPC 呼叫可見)。

## 2. UI 規範審查與驗證

- [x] 2.1 對 daily 分頁進入同步與重新聚焦 refetch 的呈現執行 `/felina-ui-guidelines` review,記錄命中的 guideline、是否有 deviation 與理由(供 archive notes 使用)。驗證:review 結論已記錄,無未說明的 deviation。
- [x] 2.2 端對端驗證:`pnpm tsc` 通過;進入 daily 觸發一次同步且顯示當天最新資料;停留 daily 不重複觸發;切換視窗回來自動 refetch;overview / models 分頁載入與刷新行為不受影響。驗證:依上述各項手動逐條確認通過。
