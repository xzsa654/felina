## Context

HistoryPage（src/lib/components/history/HistoryPage.tsx）以手動狀態機管理兩類伺服器資料：session 列表（PAGE_SIZE=50、offset/total 分頁、agentFilter 與 query 變更時重置重查、首次載入前先呼叫 api.tokenAnalytics.refresh() 忽略失敗）與 transcript（選取 session 時以 agent + session_id 載入）。兩者各有一段帶 cancellation flag 的 useEffect。專案的 React Query 模式已在 tokens 頁確立（src/lib/components/tokens/hooks/useTokenQueries.ts：key factory + 專用 hooks）。本 change 將 history 資料層對齊該模式，UI 與互動不變。

## Goals / Non-Goals

Goals:
- session 列表與 transcript 的載入、分頁、錯誤、快取全部交給 React Query
- 移除手動 cancellation flag、offset/total/loading/error useState
- 同 session 內重訪同一 transcript 命中快取（不重新閃 loading）

Non-Goals:
- 不改 UI 呈現、filter pills、deep-link 範圍（仍只有 agent + session）
- 不動後端 commands 介面；不引入輪詢/背景 refetch；不遷移其他頁

## Decisions

### Decision: useInfiniteQuery 承載 load-more 分頁

session 列表用 useInfiniteQuery，queryKey = historyKeys.sessions({ agentFilter, query })，pageParam = offset（初始 0）。getNextPageParam 以「已載入筆數 < page.total ? 已載入筆數 : undefined」推導。列表 UI 以 data.pages.flatMap(p => p.sessions) 取得累積列表，total 取最後一頁的 total。為何不用 useQuery + 手動累積：offset 累計與重置正是 useInfiniteQuery 的原生職責，手動累積只搬走一半複雜度。agentFilter/query 變更時 key 改變，React Query 自動丟棄舊頁面重新從 offset 0 查起，等價於現狀的重置行為。

### Decision: refresh-on-mount 移入第一頁 queryFn

現狀是 useEffect 內先 api.tokenAnalytics.refresh().catch(() => {}) 再查列表。遷移後放進 queryFn：當 pageParam === 0 時先 await refresh()（失敗吞掉），再呼叫 listHistorySessions。為何不獨立成 mutation：refresh 是列表資料新鮮度的前置條件，與第一頁查詢同生命週期；獨立 mutation 需要額外的順序協調，回到手動狀態機老路。代價是換 filter 也會觸發一次 refresh（現狀其實相同——現狀 effect 依賴 agentFilter/query，行為一致）。

### Decision: transcript 用 useQuery 以 agent + sessionId 為 key

useSessionTranscript(selected)：queryKey = historyKeys.transcript(agent, sessionId)，enabled = selected != null。選取切換時 React Query 自動處理競態（舊查詢結果不會覆寫新 key 的資料），手動 cancellation flag 可整段刪除。重訪已看過的 session 直接命中快取。revealSessionTranscript 維持命令式 try/catch（一次性副作用，不是資料查詢），其錯誤沿用 transcript 區的 ErrorNotice 呈現，但獨立 useState（revealError）承載，不與 query error 混用。

### Decision: deep-link 選取 effect 維持現狀語意

選取邏輯（無選取時取 deep-link 命中或第一筆）依賴「列表已載入」事件，維持現有 useEffect，但資料來源改為 infinite query 的 flatten 結果。不重寫該 effect 的依賴結構——它與資料層遷移正交，動它會擴大回歸面。

## Implementation Contract

- 新檔 src/lib/components/history/hooks/useHistoryQueries.ts 匯出：historyKeys（key factory）、useHistorySessions({ agentFilter, query })（useInfiniteQuery，回傳含 sessions flatten 前的 pages）、useSessionTranscript(selected)（useQuery）。PAGE_SIZE 常數移入此檔。
- 可觀察行為（驗收條件）：
  1. 首次進入 History 頁顯示 loading，列表出現第一頁（≤50 筆）與正確 total 計數的 Load more 按鈕；total ≤ 50 時不顯示 Load more
  2. 按 Load more 追加下一頁、計數 (loaded/total) 正確；載入中按鈕 disabled
  3. 切換 agent filter 或輸入搜尋字串：列表重置為新條件的第一頁
  4. 選取 session 載入 transcript；快速連續切換 session 不出現舊 session 的 transcript（競態由 query key 隔離）
  5. 切到別的 session 再切回：transcript 直接顯示（快取命中，無 loading 閃爍）
  6. 列表或 transcript 載入失敗：ErrorNotice 顯示 i18n 標題 + 錯誤原文（沿用 history.listLoadFailed / history.transcriptLoadFailed keys）
  7. deep-link ?agent=&session= 進入時選取對應 session；無命中時選第一筆
- 失敗模式：refresh() 失敗不阻斷列表查詢（吞掉，與現狀一致）；listHistorySessions / readSessionTranscript 失敗由 query error 承載
- 範圍邊界：in scope = HistoryPage 資料層 + 新 hooks 檔；out of scope = UI 結構、i18n keys（沿用既有）、後端、URL 參數擴充

## Risks / Trade-offs

- [useInfiniteQuery 的 total 邊界推導錯誤 → load-more 多按或少顯示] → getNextPageParam 以累計筆數對 total 比較，驗收條件 1/2 逐項手動驗證
- [refresh-on-mount 進 queryFn 後，React Query 重試/重新整理會多打 refresh] → 本頁未設 refetchInterval、staleTime 用預設，重打頻率與現狀 effect 相當；refresh 後端為增量掃描，成本可接受
- [deep-link effect 與 query 載入時序變化 → 選取閃跳] → effect 語意不動、僅換資料來源；驗收條件 7 驗證

## Migration Plan

單一 change 內完成：新增 hooks 檔 → HistoryPage 換接 → 手動驗證行為不變契約。無資料遷移；回滾 = revert merge commit。

## Open Questions

(none)
