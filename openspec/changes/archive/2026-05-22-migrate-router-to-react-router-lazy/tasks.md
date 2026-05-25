## 1. 安裝依賴

- [x] 1.1 在 `package.json` 中安裝 `react-router`（v7）：執行 `npm install react-router`

## 2. 建立 PageLoader 元件

- [x] 2.1 在 `src/lib/components/shared/PageLoader.tsx` 建立「suspense fallback：全頁 spinner」元件，作為所有 lazy 頁面的 Suspense fallback

## 3. 建立 router 設定（Memory Router）

- [x] 3.1 新增 `src/router.tsx`，使用 `createMemoryRouter` from react-router，實作「Router uses Memory Router」規格（符合「使用 Memory Router 而非 Browser Router」設計決策）
- [x] 3.2 在 `src/router.tsx` 中，以 `React.lazy()` 動態匯入全部 18 個頁面元件，確保「All pages are lazy-loaded」規格達成
- [x] 3.3 在 `src/router.tsx` 中，按照「路由路徑設計：使用 `/<page-id>` 扁平結構」定義所有 18 條路由（`/dashboard`、`/settings`、`/hooks`、`/instructions`、`/memory`、`/mcp`、`/skills`、`/rules`、`/plugins`、`/git`、`/terminal`、`/analytics`、`/templates`、`/sessions`、`/pipelines`、`/token-savings`、`/context-engine`、`/keybindings`），確保「Routes defined for all 18 pages」規格達成
- [x] 3.4 在根路徑 `/` 加入 redirect 至 `/dashboard`，確保「Root path redirects to dashboard」場景達成
- [x] 3.5 設定初始路由為 `/dashboard`，確保「Application starts on dashboard」場景達成
- [x] 3.6 以 `<Suspense fallback={<PageLoader />}>` 包裹每個 lazy 元件，確保「Suspense fallback shown during load」場景達成

## 4. 改寫 App.tsx（RouterProvider wraps the application）

- [x] 4.1 在 `src/App.tsx` 中移除所有頁面元件的靜態 import 與 `PAGE_MAP` 物件
- [x] 4.2 在 `src/App.tsx` 中以 `<RouterProvider router={router}>` 取代原本的 `{PageComponent ? <PageComponent /> : null}` 渲染邏輯，確保「RouterProvider wraps the application」規格達成
- [x] 4.3 確認 `<CommandPalette>`、`<OnboardingWelcome>`、`<Sidebar>`、`<Header>`、`<UpdateBanner>` 等 layout 元件仍正確渲染

## 5. 更新 Sidebar（Link-based navigation）

- [x] 5.1 全域搜尋 `useNavigationStore` 的所有使用點，確認哪些元件依賴 `currentPage` 或 `navigateTo`
- [x] 5.2 在 `src/lib/components/layout/Sidebar.tsx` 中，以 `<Link to={`/${item.id}`}>` 取代 `navigateTo(item.id)` 呼叫，確保「Sidebar uses Link-based navigation」規格達成
- [x] 5.3 在 `src/lib/components/layout/Sidebar.tsx` 中，使用 `useMatch` 或 `useLocation` 判斷當前路由，取代從 Zustand store 讀取 `currentPage`，確保「Active route item is highlighted」場景達成

## 6. 清理 navigation store（移除 `navigateTo`）

- [x] 6.1 在 `src/lib/stores/navigation.ts` 中移除 `navigateTo` action 與 `currentPage` state（符合「保留 `NAV_ITEMS` 與 `Page` 型別，移除 `navigateTo`」設計決策）
- [x] 6.2 保留 `NAV_ITEMS` 與 `Page` type，供 Sidebar 元件渲染使用
- [x] 6.3 確認無任何殘留的 `navigateTo` 呼叫（TypeScript 編譯無錯誤）

## 7. 驗證

- [x] 7.1 執行 `npm run build`，確認所有頁面產生獨立 chunk（程式碼分割生效）
- [x] 7.2 在 Tauri 開發模式下（`npm run tauri dev`）測試全部 18 個頁面的導航功能正常
- [x] 7.3 確認 Sidebar active item highlight 在各頁面切換時正確顯示
