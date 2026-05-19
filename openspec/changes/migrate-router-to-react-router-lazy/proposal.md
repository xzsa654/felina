## Why

目前應用程式以 Zustand store（`navigation.ts`）搭配 `App.tsx` 的 `PAGE_MAP` 靜態物件實作導航，啟動時同步載入全部 18 個頁面元件，導致初始 bundle 偏大。採用 react-router 搭配 `React.lazy()` 可實現程式碼分割，讓每個頁面在首次導航時才載入，並標準化路由架構以利未來擴充。

## What Changes

- 安裝 `react-router`（v7）作為路由依賴
- 新增 `src/router.tsx`：定義所有頁面路由，每個頁面以 `React.lazy()` 動態匯入
- 改寫 `src/App.tsx`：以 `<RouterProvider>` 取代 `PAGE_MAP` 渲染邏輯，加入 `<Suspense>` fallback
- 更新 `src/lib/components/layout/Sidebar.tsx`：以 `<Link>` 或 `useNavigate` 取代 `navigateTo()` 呼叫
- 調整 `src/lib/stores/navigation.ts`：保留 `NAV_ITEMS` 導航元資料，移除或調整 `navigateTo` action

## Non-Goals

- 不引入伺服器端渲染（SSR）或 file-based routing
- 不更改任何頁面元件的實作邏輯
- 不移除 Zustand（其他 store 仍正常使用）
- 不實作路由層級的存取控制（auth guard）

## Capabilities

### New Capabilities

- `app-routing`: 定義應用程式的路由結構，涵蓋所有頁面路徑對應、lazy loading 設定及 Suspense fallback 行為

### Modified Capabilities

（無）

## Impact

- Affected specs: `app-routing`（新建）
- Affected code:
  - New: `src/router.tsx`
  - Modified: `src/App.tsx`
  - Modified: `src/lib/components/layout/Sidebar.tsx`
  - Modified: `src/lib/stores/navigation.ts`
  - Modified: `package.json`
