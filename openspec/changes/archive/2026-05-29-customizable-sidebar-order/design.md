## Context

目前 `Sidebar` 左側主導覽列的順序是由 `src/lib/stores/navigation.ts` 內的靜態陣列 (`NAV_ITEMS`) 所決定。為了允許使用者自訂順序，我們需要將這個靜態陣列轉化為一個可被使用者操作並儲存的狀態 (State)。

## Goals / Non-Goals

**Goals:**
- 在 `navigation.ts` 中引入持久化的狀態，用以記錄使用者偏好的選單順序。
- 讓 `Sidebar.tsx` 的導覽項目能透過滑鼠拖曳來重新排序。
- 確保當應用程式更新並加入新導覽項目時，新項目能夠正確出現，不會被舊的自訂排序蓋掉。

**Non-Goals:**
- 不支援將項目拖曳到隱藏區域 (隱藏功能不在本次範圍)。
- 不改變 `Command Palette` 搜尋或顯示的邏輯與順序。

## Decisions

- **選擇 `@dnd-kit` 套件**：這是無樣式的現代 React 拖曳套件。我們使用 `@dnd-kit/core` 作為拖曳引擎，並用 `@dnd-kit/sortable` 來處理清單排序的動畫與邏輯。它符合不使用外部 UI 庫的規範。
- **Zustand Persist Middleware**：使用 Zustand 內建的 `persist` 來將使用者的排序陣列存入 LocalStorage。
- **陣列合併邏輯 (Merge strategy)**：當從 LocalStorage 讀取自訂順序時，我們必須與目前的 `NAV_ITEMS` 進行比對。如果 `NAV_ITEMS` 增加了新項目，我們將其補在自訂順序的最後面；如果自訂順序包含已移除的項目，則將其剔除。這能確保應用程式升級時導覽列不會壞掉。

## Implementation Contract

- **Behavior**: 使用者可以在左側選單上按住任一導覽項目並上下拖曳。放開後，選單會重新排序，且重新整理畫面後排序結果仍會保留。
- **Interface / data shape**:
  - `useNavigationStore` 新增 `customOrder: string[] | null` 狀態與對應的 action。
  - Sidebar 的渲染邏輯改為依據 `customOrder` 與 `NAV_ITEMS` 合併後的陣列進行映射。
- **Failure modes**: 若 LocalStorage 存取失敗，則預設回退至靜態的 `NAV_ITEMS` 順序。
- **Acceptance criteria**:
  - `npm run check` 通過。
  - 在開發模式下，可順暢拖曳 Sidebar 項目並對調位置。
  - 重新整理網頁後，自訂的順序維持不變。
  - 若在程式碼中人為新增一個虛擬的 NAV_ITEM，重整後該項目會正確出現在列表最下方。
- **Scope boundaries**: 僅涉及 `Sidebar.tsx`、`SidebarItem.tsx` 結構與 `navigation.ts` 狀態，無後端修改。

## Risks / Trade-offs

- **[Risk] State Hydration Mismatch**：Zustand persist 在 SSR 框架中常會有 hydration 錯誤，但由於 Felina 是 Tauri SPA (純 CSR)，因此不存在此風險，可以直接使用 persist。
