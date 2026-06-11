## Why

MemoryPage 的選取狀態（選中的專案、開啟的記憶檔）只存在元件 state：重新整理、從別頁返回、或重啟 app 後選取即丟失，也無法以連結指向特定專案的記憶視圖。Tokens（?tab=&date=）與 History（?agent=&session=）已建立「頁內選取進 URL 查詢參數」的慣例，Memory 是僅剩未跟上的選取型頁面。

## What Changes

- MemoryPage 選取狀態同步到 URL 查詢參數 ?project=<hash>&file=<filename>：
  - 進入頁面時依參數還原：project 參數命中已載入的專案清單（以既有 hash 比對）→ 選取該專案並載入其記憶檔；file 參數命中該專案的檔案 → 開啟編輯器
  - 使用者選取專案 → 更新 project 參數並清除 file；開啟檔案 → 設定 file；關閉編輯器 → 清除 file；切換專案 → 清除 file
  - 參數無命中（hash 不存在、檔名不存在）→ 靜默忽略該參數，維持未選取狀態，不報錯
- project 以後端 memory commands 既有的 hash 識別（非路徑），避免路徑編碼與跨平台正規化問題
- filename 經 encodeURIComponent 編碼寫入、讀取時解碼

## Non-Goals

- 搜尋字串（searchQuery）與編輯器內容草稿不進 URL
- 新建記憶（showCreate）流程不進 URL（暫態流程，重整即放棄合理）
- 不做跨頁導向入口（其他頁面連到 /memory?project= 的觸發點另議）
- 不改 MemoryPage 的資料載入方式（仍為現有 useState 模式；React Query 遷移另議）
- 不動後端 memory commands

## Capabilities

### New Capabilities

- `memory-page`: Memory 頁的 URL 深連結行為（查詢參數還原選取、互動時同步 URL、無效參數靜默忽略）

### Modified Capabilities

(none)

## Impact

- Affected specs: 新增 `memory-page`
- Affected code:
  - New: (none)
  - Modified: src/lib/components/memory/MemoryPage.tsx
  - Removed: (none)
- 無新增依賴；react-router useSearchParams 已在 Tokens/History 使用
- 風險：低。單檔變更；還原邏輯依賴「專案清單載入完成」時序，比照 History deep-link effect 的「列表就緒後比對一次」模式
