## 1. 移除全域 Header（實作 Page Title Provision、對齊 Registered Pages）

- [x] 1.1 在 `src/router.tsx` 的 `AppLayout` 移除 `<Header />` 元素,並移除檔頂的 `import Header from "$lib/components/layout/Header"`。完成後 `AppLayout` 的 `<main>` 內只剩 `<UpdateBanner />` 與包住 `<Outlet />` 的容器,頁面內容區上方不再有共用標題列(滿足 Page Title Provision 的「無全域 header bar」契約)。
- [x] 1.2 刪除 `src/lib/components/layout/Header.tsx`(含其中的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map)。完成後該檔不存在(滿足 Registered Pages 中「不再有 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` 一致性來源」與 Page Title Provision 中「`Header.tsx` MUST NOT exist」)。
- [x] 1.3 全庫搜尋確認無殘留引用:grep `layout/Header`、`PAGE_TITLES`、`PAGE_DESCRIPTIONS` 在 `src/` 下應無任何 production code 命中(`openspec/` 內的 spec/trace 文字不算)。若有命中即清除。

## 2. 各頁面標題提供（實作 Page Title Provision）

- [x] [P] 2.1 在 `src/lib/components/settings/SettingsPage.tsx` 的頁面根容器最上方加入一個最小硬編碼標題(例如 `<h1 className="text-xl font-semibold text-text-primary">Settings</h1>`,沿用既有 Tailwind token)。刻意不接 i18n、不加 icon、不引入 `PageHeader`。完成後 Settings 頁在移除全域 Header 後仍顯示非空標題(滿足 Page Title Provision 的「legacy pages 顯示佔位標題」)。
- [x] [P] 2.2 在 `src/lib/components/memory/MemoryPage.tsx` 的頁面根容器最上方加入最小硬編碼標題 `Memory`,作法同 2.1。完成後 Memory 頁顯示非空標題。
- [x] [P] 2.3 在 `src/lib/components/history/HistoryPage.tsx` 的頁面根容器最上方加入最小硬編碼標題 `History`,作法同 2.1。完成後 History 頁顯示非空標題。

## 3. 驗證（驗證 Registered Pages 與 Page Title Provision）

- [x] 3.1 執行 `npm run check`,結果相對於本 change 開工前的 baseline 不得新增任何 TypeScript 錯誤(移除 `Header.tsx` 後不得遺留對它的 import 而報錯)。
- [x] 3.2 確認 Registered Pages 一致性:`src/router.tsx` 路由表與 `src/lib/stores/navigation.ts` 的 `NAV_ITEMS` 與 `Page` type 三者皆為 `{skills, projects, settings, templates, tokens, memory, history}`,且程式庫已無 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` 作為第三個一致性來源。
- [x] 3.3 執行 `npm run tauri dev`,逐一開啟全部 7 頁(skills / projects / settings / templates / tokens / memory / history):每頁只顯示單一頁面標題、不再出現上下兩個堆疊的標題(驗證 Page Title Provision 的「每頁恰好一個標題」);skills / projects 仍是 `PageHeader`(icon + 操作按鈕),tokens 仍是其 inline 標題 + tab 列,settings / memory / history 顯示最小佔位標題。確認原本被全域 Header 佔用的頂欄高度已釋放給主內容區。
