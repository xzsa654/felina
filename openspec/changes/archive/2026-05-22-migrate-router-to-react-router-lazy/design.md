## Context

Glyphic 是一個 Tauri + React + TypeScript 桌面應用程式。目前導航機制由 `src/lib/stores/navigation.ts` 的 Zustand store 管理，`src/App.tsx` 維護一個 `PAGE_MAP` 靜態物件，將頁面 ID 映射到 React 元件。全部 18 個頁面元件在應用程式啟動時同步匯入，無法進行程式碼分割。

Sidebar 元件直接呼叫 `useNavigationStore().navigateTo(page)` 切換頁面，當前頁面狀態儲存在 Zustand store 中。

## Goals / Non-Goals

**Goals:**

- 以 react-router（v7）取代 Zustand 狀態路由
- 所有 18 個頁面元件改用 `React.lazy()` 動態匯入
- 以 `<Suspense>` 包裹頁面，提供載入狀態 fallback
- Sidebar 導航改用 react-router 的 `<Link>` 元件
- 保留 `NAV_ITEMS` 作為側邊欄渲染的元資料來源

**Non-Goals:**

- 不引入 SSR 或 file-based routing（Vite Router / Remix）
- 不更改頁面元件內部邏輯
- 不實作路由守衛或需要認證的路由

## Decisions

### 使用 Memory Router 而非 Browser Router

Tauri 桌面應用程式以 `tauri://` 協定提供資源，Browser Router 依賴 History API 且需要伺服器支援 URL rewrite，在 Tauri WebView 環境下會有相容性問題。Memory Router（`createMemoryRouter`）將路由狀態保存在記憶體中，不依賴瀏覽器 URL，適合桌面應用情境。

替代方案：`createHashRouter`（Hash Router）同樣可在 Tauri 中運作，但 URL 含 `#` 符號，視覺上較不整潔。Memory Router 更純粹，無副作用。

### 路由路徑設計：使用 `/<page-id>` 扁平結構

所有頁面以 `/<page-id>` 格式定義（例如 `/dashboard`、`/settings`），與現有 `Page` union type 的 ID 一一對應。根路徑 `/` redirect 至 `/dashboard`。

替代方案：使用數字索引或 hash，但語意性較差，不利於未來擴充巢狀路由。

### 保留 `NAV_ITEMS` 與 `Page` 型別，移除 `navigateTo`

`NAV_ITEMS` 陣列提供 Sidebar 的渲染元資料（label、icon），保留不動。`Page` union type 繼續用於型別安全。移除 `navigateTo` action 與 `currentPage` state，因為路由狀態改由 react-router 管理，Zustand store 不再需要維護導航狀態。

### Suspense Fallback：全頁 spinner

每個 lazy 頁面包裹於 `<Suspense fallback={<PageLoader />}>`，`PageLoader` 為一個置中顯示的 loading spinner，放置於 `src/lib/components/shared/PageLoader.tsx`。

## Risks / Trade-offs

- **Tauri WebView 相容性** → 使用 Memory Router 規避 URL 協定問題，已有社群驗證可行
- **移除 `currentPage` Zustand state** → 若其他元件讀取 `currentPage`（例如 Header 顯示當前頁面標題），需改用 `useMatch` 或 `useLocation` 取得當前路由資訊。遷移前須全域搜尋 `useNavigationStore` 的使用點。
- **Bundle 分析** → lazy loading 效果需以 `vite build --report` 驗證各 chunk 大小是否合理分割

## Migration Plan

1. 安裝 `react-router`
2. 建立 `src/router.tsx`（Memory Router + lazy routes）
3. 改寫 `src/App.tsx` 使用 `<RouterProvider>`
4. 更新 `src/lib/components/layout/Sidebar.tsx` 使用 `<Link>`
5. 清理 `src/lib/stores/navigation.ts`（移除 `navigateTo`、`currentPage`）
6. 全域確認無殘留的 `navigateTo` 呼叫

## Open Questions

- Header 元件是否使用 `currentPage` 顯示頁面標題？若有，需一併更新為 `useMatch`。
