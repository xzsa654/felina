## 1. 準備與基線

- [x] 1.1 Baseline: 執行 `npm run check` 紀錄現有 TypeScript 錯誤與警告作為後續驗證基準。
- [x] 1.2 新增依賴: 安裝 `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`。驗證: `package.json` 出現該依賴且 `npm run check` 通過。對應 Draggable Sidebar Ordering 底層需求。

## 2. 狀態與持久化實作

- [x] 2.1 修改 Store: 在 `src/lib/stores/navigation.ts` 中新增 `customOrder: string[] | null` 與 `setCustomOrder` action，並套用 Zustand `persist` middleware。撰寫合併邏輯 `getMergedNavItems`，負責將 `customOrder` 與 `NAV_ITEMS` 同步 (過濾不存在的項目、補上遺漏的新項目)。驗證: 該檔案無 TypeScript 錯誤。對應 Order Persistence and Merging 需求。

## 3. 重構 Sidebar 介面

- [x] 3.1 引入 Context: 在 `src/lib/components/layout/Sidebar.tsx` 引入 `DndContext` 與 `SortableContext` 包覆選單列表。實作 `onDragEnd` 事件處理：當拖曳結束時計算新的陣列順序並呼叫 `setCustomOrder`。驗證: 存檔編譯無錯誤。對應 Draggable Sidebar Ordering 需求。
- [x] 3.2 實作可拖曳元件: 建立 `SortableSidebarItem` 元件 (使用 `useSortable` hook)，並綁定 attributes 與 listeners 到選單按鈕上。設定拖曳時的 Tailwind 樣式回饋。驗證: 開發模式下，可用滑鼠拖曳 Sidebar 項目對調位置。對應 Draggable Sidebar Ordering。

## 4. 驗證與封裝

- [x] 4.1 執行 `npm run check`，確保沒有引入新的 TypeScript errors 或 warnings。
- [x] 4.2 執行 `npm run tauri dev` 進行端對端手動驗證：
  1. 拖曳 Sidebar 項目，確認能流暢交換位置。
  2. 隨意調整順序後重整網頁，確認新的排序成功被載入。
  3. (手動測試合併邏輯) 在 `navigation.ts` 暫時增加一個假 NAV_ITEM，確認重整後該項目會安靜地出現在自訂排序列表的最下方；移除假項目後，重整不會報錯。
