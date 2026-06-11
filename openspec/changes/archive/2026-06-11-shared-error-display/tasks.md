## 1. Baseline

- [x] 1.1 跑 npm run check 記錄現有 TypeScript errors / warnings 作為 baseline，並用 grep 列出 src/lib/components/ 下所有 window.alert 呼叫站點清單寫入工作筆記。驗證：baseline 清單可與後續驗證階段逐項比對，明確區分本 change 新引入 vs pre-existing。

## 2. 共用元件與 i18n keys

- [x] 2.1 建立 src/lib/components/shared/ErrorNotice.tsx，滿足 spec「Shared error notice component renders i18n title with verbatim detail」：props 接受已本地化的 title 字串與可選的 detail 字串；title 永遠顯示；detail 以 monospace、可選取（user-select 可複製）區域原文呈現，無 detail 時不渲染空 detail 區。同時滿足「Error notice uses semantic theme colors」：僅使用 text-danger / bg-danger-dim / border-danger/30 等語意色，不用原生 Tailwind 色。驗證：npm run check 通過；元件原始碼 grep 不到 red- / amber- 等原生色 class。
- [x] 2.2 在 ErrorNotice 實作「Long detail is collapsible」：detail 超過收合顯示範圍（多行或超過固定高度）時顯示展開/收合控制，展開顯示完整原文、再次觸發收合；控制文字走 i18n。驗證：npm run check 通過；後續 4.3 手動驗證含長 detail 展開/收合行為。
- [x] 2.3 [P] 在 src/lib/i18n/locales/en.ts 與 zh-TW.ts 新增 common.error.* namespace keys（至少：載入失敗、操作失敗、展開/收合 detail 控制文字）以及各遷移站點所需的標題 keys（skills push 失敗、fork 預覽失敗、開啟資料夾失敗、hub 登入失敗、hub 刪除失敗、tokens 查詢失敗、settings 載入/儲存失敗）。en 與 zh-TW 結構對齊。驗證：npm run check 通過（TranslationDict 缺 key 會 compile error）。

## 3. 遷移既有錯誤呈現

- [x] 3.1 Skills 頁遷移，滿足「Component code does not use window.alert for errors」：src/lib/components/skills/SkillsPage.tsx 的 push preview / push confirm / delete 失敗改為 ErrorNotice inline 呈現（i18n 標題 + 後端錯誤 verbatim detail），src/lib/components/skills/TargetPopover.tsx 與 src/lib/components/skills/TargetEditor.tsx 的 pull 失敗 window.alert、fork preview 與 open folder 的裸 String(e) 一併改為「Migrated error sites pair localized titles with verbatim detail」模式。驗證：npm run check 通過；grep 確認此三檔無 window.alert。
- [x] 3.2 [P] Projects 頁遷移：src/lib/components/projects/ProjectsList.tsx 移除專案失敗改為 ErrorNotice inline 呈現（i18n 標題 + verbatim detail），不再使用 window.alert。驗證：npm run check 通過；grep 確認該檔無 window.alert。
- [x] 3.3 [P] Settings 頁遷移：src/lib/components/settings/AgentPathsSection.tsx 與 src/lib/components/settings/SkillLibrarySection.tsx 的裸 String(e) 顯示改為 i18n 標題 + verbatim detail（沿用 ErrorNotice 或既有錯誤區塊加上 i18n 標題）。驗證：npm run check 通過；兩檔中不再有「僅裸 String(e) 直接渲染」的錯誤顯示。
- [x] 3.4 [P] Hub 頁遷移：src/lib/components/hub/LoginDialog.tsx 登入錯誤與 src/lib/components/hub/HubPage.tsx 刪除錯誤改為 i18n 標題 + 底層錯誤 verbatim 的呈現。驗證：npm run check 通過；兩處錯誤訊息皆含本地化標題。
- [x] 3.5 [P] Tokens 頁遷移：src/lib/components/tokens/TokensPage.tsx 的 String(queryError) 錯誤橫幅改用 ErrorNotice（i18n 標題 + query error verbatim detail）。驗證：npm run check 通過。

## 4. 驗證

- [x] 4.1 全域確認「Component code does not use window.alert for errors」：grep src/lib/components/ 確認 window.alert 歸零；npm run check 結果與 1.1 baseline 比對，無本 change 新引入的 error/warning。
- [x] 4.2 跑 /felina-ui-guidelines 評估本 change 的 UI 改動（ErrorNotice 元件與各遷移站點），輸出命中的 guideline 與 deviation 清單。驗證：清單產出且 deviation 已處理或明確記錄為接受。
- [x] 4.3 npm run tauri dev 手動驗證：(a) Skills push 失敗（例如 target 路徑不存在）顯示 inline ErrorNotice 含本地化標題與後端錯誤原文，無 alert 彈窗；(b) Hub 登入填錯誤伺服器觸發失敗，LoginDialog 顯示本地化標題 + 錯誤原文；(c) Tokens 頁模擬查詢失敗（或檢視錯誤狀態）顯示 ErrorNotice；(d) 長 detail 可展開/收合且文字可選取複製；(e) 切換 en / zh-TW 標題隨 locale 變化、detail 維持原文；(f) 亮/暗主題下 ErrorNotice 顏色皆來自 danger 語意色。
