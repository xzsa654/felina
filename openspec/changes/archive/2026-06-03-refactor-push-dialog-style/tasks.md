## 1. 基準線與準備工作 (Baseline & Preparation)

- [x] 1.1 執行靜態檢查 `npm run check` 作為 baseline，記錄現有的 TypeScript 錯誤與警告以作為驗證階段比對差異的基準。
- [x] 1.2 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 中新增或對齊推送預覽彈窗目標所需的語系欄位，並確認編譯不報錯。

## 2. 推送預覽彈窗重構實作 (Sync Preview Dialog Refactoring)

- [x] 2.1 實作 `Intuitive Target Visual Representation` 需求：在 `src/lib/components/skills/SyncPreviewDialog.tsx` 中導入 Agent 彩色圖示（Claude / Codex / Antigravity），解析 `item.agent`、`item.scope` 與 `item.project` 來顯示直觀的目標徽章及專案標籤（如 `Claude · felina`），並將長文件路徑作為次要字級在下方做截斷處理。驗證方式：確認 `npm run check` 靜態編譯通過。
- [x] 2.2 實作 `Layout Shift Protection` 需求：在 `src/lib/components/skills/SyncPreviewDialog.tsx` 中將傳統表格框線改為帶有微幅 Gap 與 Hover 效果的圓角懸浮卡片列表，鎖定 CSS Grid 寬度，限制 `<select>` 決策下拉選單的最大寬度 `max-w-[12rem] truncate` 並指定每一行有靜態固定的行高 `h-14`，以完全防止選取操作時所產生的任何版面跳動跑版。驗證方式：確認 `npm run check` 靜態編譯通過且無跑版。

## 3. 整合與手動驗證 (Integration & Manual Verification)

- [ ] 3.1 執行本地開發伺服器 `npm run tauri dev` 進行手動 UI 驗證，打開彈窗確認：
  - 遮罩呈現美麗的 `bg-black/45 backdrop-blur-[2px]` 毛玻璃質感。
  - 彈窗主體擁有現代圓潤 of `rounded-2xl` 大圓角外框。
  - 每個同步目標的前端渲染都包含正確對應的彩色 Agent 圖示與標籤，且底下的檔案實體路徑有正確 truncate 截斷。
  - 當點擊或切換決策選單時，列表寬度與列高完全靜態鎖定，無任何版面跑版、抖動或位置偏移。
- [x] 3.2 重新執行靜態檢查 `npm run check`，驗證並確認在此變更後沒有引入任何新的 TypeScript 錯誤與警告。
