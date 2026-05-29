## Why

針對具有複雜操作邏輯的區塊 (如 Skills 頁面的 Targets 管理、Projects 頁面的 Managed Inventory)，直接在操作按鈕旁加入 tooltip 會造成畫面擁擠並干擾點擊操作。為了解決初學者的學習門檻，又不損害畫面的簡潔度，我們需要在區塊級別 (Section Header) 旁提供一個專屬的說明彈出按鈕。

## What Changes

- 在共用元件中新增一個 `InfoDialog` (或擴充既有 Dialog 機制)，專門用於顯示純資訊說明的彈出視窗。
- 在 `TargetEditor.tsx` 的 `TARGETS` 標題旁邊加入 `?` 說明按鈕。
  - 點擊後解釋：`Auto/Manual/Disabled` (同步模式差異)、`Pull` (drift 時覆寫主檔) 與 `重新指向` (變更目標專案資料夾) 的定義。
- 在 `ManagedInventory.tsx` 的標題旁邊加入 `?` 說明按鈕。
  - 點擊後解釋：`多來源` (Multi Source) 的意義與處理方式。
- 擴充 i18n 語系檔，加入對應的說明文案。

## Non-Goals (optional)

- 不實作整頁式的互動導覽 (Guided Tour)。
- 不改變任何按鈕原有的功能或底層同步邏輯。

## Capabilities

### New Capabilities

- `section-help-dialogs`: 定義區塊標題旁說明按鈕的互動行為與文案範圍。

### Modified Capabilities

(none)

## Impact

- Affected specs: `section-help-dialogs` (新增)
- Affected code:
  - New: `src/lib/components/shared/InfoDialog.tsx`
  - Modified: `src/lib/components/skills/TargetEditor.tsx`
  - Modified: `src/lib/components/projects/ManagedInventory.tsx`
  - Modified: `src/lib/i18n/locales/en.ts`
  - Modified: `src/lib/i18n/locales/zh-TW.ts`
