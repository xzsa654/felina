## Summary

HistoryPage 的資料層（session 列表分頁 + transcript 載入）從手動 useState/cancellation 遷移到 React Query hooks，對齊 tokens 頁既有模式，行為不變。

## Motivation

HistoryPage 目前以 14 個 useState、手動 cancellation flag 與 .then/.catch 鏈自行管理 session 列表（含 offset/total 分頁）與 transcript 載入，等於重造了 React Query 內建的請求取消、快取、去重與 loading/error 狀態。這與專案既有資料層慣例（tokens 頁 src/lib/components/tokens/hooks/useTokenQueries.ts 的 query key factory + hooks）不一致，是 7 頁 UI 審查歸納的「資料層三套並存」問題中最嚴重的站點：新增功能（如更多 filter、輪詢）都得在手寫狀態機上疊加。遷移後切換 session 再切回可直接命中快取，互動體感也會改善。

## Proposed Solution

- 新增 src/lib/components/history/hooks/useHistoryQueries.ts，比照 useTokenQueries.ts 結構：
  - historyKeys key factory：sessions 以（agentFilter、query）為 key、transcript 以（agent、sessionId）為 key
  - useHistorySessions：useInfiniteQuery，pageParam 為 offset、PAGE_SIZE 維持 50，getNextPageParam 由累計筆數與 total 推導；首頁查詢前沿用既有「先 api.tokenAnalytics.refresh() 再 list」的 refresh-on-mount 行為（refresh 失敗忽略，與現狀一致）
  - useSessionTranscript：useQuery，enabled 於有選取 session 時，以 readSessionTranscript 取得
- HistoryPage 改用上述 hooks：移除 sessions/historyOffset/historyTotal/loading/loadingMore/listError/transcript/transcriptLoading/transcriptError 等手動狀態與兩段 cancellation useEffect；load-more 改 fetchNextPage；保留 selected/agentFilter/query/transcriptFilter/transcriptQuery/revealing 等 UI 狀態
- 行為不變契約：filter 或搜尋字串變更觸發重新查詢並重置列表；deep-link（?agent=&session=）選取邏輯維持；錯誤仍以 ErrorNotice（i18n 標題 + verbatim detail）呈現；revealSessionTranscript 仍為命令式呼叫不進 query

## Non-Goals

- 不改 UI 呈現與互動（filter pills、列表卡片、transcript 泡泡、Reveal）
- 不把 agentFilter/query/transcriptFilter 寫入 URL（深連結範圍維持現狀：agent + session）
- 不動後端 commands（listHistorySessions / readSessionTranscript / revealSessionTranscript 介面不變）
- 不遷移其他頁（Memory/Projects/Settings/Hub 的資料層另議）
- 不引入輪詢或背景 refetch（staleTime/refetch 行為除快取命中外不主動增加）

## Alternatives Considered

- 普通 useQuery + 手動累積分頁列表：仍要自管 offset 與累積邏輯，等於只搬一半；useInfiniteQuery 是 React Query 對 load-more 的原生模型
- Zustand store（如 skills-store）：skills 是跨元件共享的領域狀態，history 是單頁的伺服器資料快取，React Query 語意更貼合

## Impact

- Affected specs: `history-page`（delta ADDED：快取與分頁的可觀察行為契約）
- Affected code:
  - New: src/lib/components/history/hooks/useHistoryQueries.ts
  - Modified: src/lib/components/history/HistoryPage.tsx
  - Removed: (none)
- 無新增依賴（@tanstack/react-query 已在用）；純前端
- 風險：中低。分頁語意（filter 變更重置、total 邊界）與 deep-link 選取 effect 是回歸熱點；以行為不變契約逐項驗證
