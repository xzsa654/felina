## 1. Baseline

- [x] 1.1 跑 npm run check 記錄 TypeScript baseline；記錄 HistoryPage.tsx 現有手動資料層狀態清單（sessions/historyOffset/historyTotal/loading/loadingMore/listError/transcript/transcriptLoading/transcriptError 與兩段 cancellation useEffect），作為遷移後「應消失項」逐項比對依據。驗證：清單寫入工作筆記，可與 3.1 完成後 diff 比對。

## 2. Query hooks

- [x] 2.1 （TDD）抽出分頁推導純函式並先寫測試：在 src/lib/components/history/hooks/useHistoryQueries.ts 匯出 nextHistoryPageOffset(loadedCount, total)（loadedCount < total 回傳 loadedCount、否則 undefined），tests/ 下以 node:test 覆蓋：空列表+total 0、loadedCount<total、loadedCount===total、total 小於單頁。驗證：測試先紅後綠，node --test tests/ 通過。
- [x] 2.2 實作 useHistoryQueries.ts 其餘部分，落實 design「Decision: useInfiniteQuery 承載 load-more 分頁」與「Decision: refresh-on-mount 移入第一頁 queryFn」：historyKeys key factory（sessions 以 agentFilter+query、transcript 以 agent+sessionId）、useHistorySessions（useInfiniteQuery，PAGE_SIZE=50 移入本檔，getNextPageParam 用 2.1 純函式，pageParam===0 時先 await api.tokenAnalytics.refresh() 並吞錯）、useSessionTranscript（useQuery，enabled 於有選取時），落實 design「Decision: transcript 用 useQuery 以 agent + sessionId 為 key」。驗證：npm run check 通過。

## 3. 頁面換接

- [x] 3.1 HistoryPage.tsx 改用 useHistorySessions / useSessionTranscript：刪除 1.1 清單列出的手動狀態與兩段 cancellation useEffect；列表以 pages flatten 取得、total 取最後一頁；Load more 改 fetchNextPage 且 hasNextPage 為 false 時不顯示；錯誤沿用 ErrorNotice + history.listLoadFailed / history.transcriptLoadFailed keys；reveal 失敗改獨立 revealError state 承載；落實 design「Decision: deep-link 選取 effect 維持現狀語意」（effect 結構不動、僅換資料來源）。滿足 spec「Session list pagination resets on filter change」（filter/搜尋變更 → key 變更 → 列表重置）與「Transcript loads are race-safe and cached within a session」。驗證：npm run check 通過；grep HistoryPage.tsx 無 cancelled flag、無 historyOffset/historyTotal state。

## 4. 驗證

- [x] 4.1 全域確認：npm run check 與 1.1 baseline 比對無新引入 error/warning；node --test tests/ 全綠；1.1「應消失項」清單逐項確認已移除。
- [x] 4.2 跑 /felina-ui-guidelines 評估（本 change 預期零 UI 呈現變更，評估重點為未意外引入新樣式），輸出命中與 deviation 清單。驗證：清單產出且 deviation 已處理或記錄為接受。
- [x] 4.3 npm run tauri dev 手動驗證 design Implementation Contract 七項可觀察行為：(1) 首載第一頁與 Load more 顯示邏輯（total ≤ 50 時不顯示）；(2) Load more 追加與 (loaded/total) 計數、載入中 disabled；(3) 切 agent filter / 輸入搜尋 → 列表重置；(4) 快速連續切換 session 不出現舊 transcript；(5) 切回看過的 session 快取命中無 loading 閃爍；(6) 列表與 transcript 載入失敗顯示 ErrorNotice（i18n 標題 + 原文）；(7) deep-link ?agent=&session= 正確選取、無命中選第一筆。
