## 1. 準備與基線

- [x] 1.1 Baseline: 執行 `npm run check` 紀錄現有 TypeScript 錯誤與警告作為後續驗證基準。
- [x] 1.2 新增依賴: 安裝套件 `react-resizable-panels`。驗證方式: `package.json` 出現該依賴且 `npm run check` 不報錯。對應 Resizable Skills Workspace 底層需求。

## 2. 實作把手元件

- [x] 2.1 實作拖曳把手 (新增 `ResizableHandle.tsx`)。需渲染為一個分隔區塊，並在 hovering 狀態下呈現視覺回饋。驗證方式: 元件能正確被 React 渲染且無 TypeScript 錯誤。對應 Resizable Skills Workspace 的拖曳介面需求。

## 3. 重構 SkillsPage 版面

- [x] 3.1 引入 `PanelGroup` 取代 `SkillsPage.tsx` 的 Flexbox 容器。將原有的 Skill List 與 Editor 分別包入 `<Panel>`，並設定左側清單的 `minSize`, `maxSize` 與 `collapsible`，中間插入 `ResizableHandle`。驗證方式: 開發模式下可透過滑鼠拖曳中間把手來即時改變左右寬度。滿足 Resizable Skills Workspace 與 Collapsible Skill List。
- [x] 3.2 啟用狀態保存: 在 `<PanelGroup>` 設定 `autoSaveId` 綁定 LocalStorage。驗證方式: 拖曳寬度後，重整網頁能恢復剛才的比例。滿足 Persistent Layout Preferences。

## 4. 驗證與封裝

- [x] 4.1 執行 `npm run check`，確保沒有引入新的 TypeScript errors 或 warnings。
- [x] 4.2 執行 `npm run tauri dev` 進行端對端手動驗證：
  1. 拖曳邊界確認左側面板會動態縮放。
  2. 將邊界往極左推，確認面板會自動收合。
  3. 隨意調整一個寬度後重整畫面，確認寬度偏好成功保留。
