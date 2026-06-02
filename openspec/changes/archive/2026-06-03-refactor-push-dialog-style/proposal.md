## Why

在多 Agent 技能推送預覽彈窗（SyncPreviewDialog）中，目前的排版使用傳統格線表格顯示目標實體路徑，使用者無法直觀識別同步的 Agent 及專案目標。同時，當使用者切換異動決策下拉選單時，因為寬度不固定且選項文字過長，導致選單與行高劇烈晃動，產生不佳的排版跑版現象（Layout Shifting）。

## What Changes

- **直觀的目標呈現**：解析同步目標的 `agent`、`scope` 與 `project`，整合官方彩色 Agent Icon 圖示（Claude / Codex / Antigravity）與專案/全域標籤（如 `Claude · felina`），使推向目標一目了然。
- **去除傳統表格線條**：拋棄生硬的表格框線，改用帶有微幅 Gap 與 Hover 效果的圓角懸浮卡片列表，符合 Felina 的「去線條化與留白引導」設計語彙。
- **徹底防跑版與抖動**：
  - 固定 CSS Grid 欄位寬度，Path 欄位加上自適應截斷 `min-w-0 truncate`。
  - 下拉選單限制最大寬度 `w-full max-w-[12rem] truncate`，防止被超長選項字體撐爆。
  - 每行鎖定為固定高度（`h-14`），確保切換選項時高度完全靜態一致，杜絕任何版面抖動跑版。
- **毛玻璃與大圓角**：升級彈窗遮罩為 `bg-black/45 backdrop-blur-[2px]`，彈窗主體升級為 `rounded-2xl` 圓角，提升視覺質感。

## Capabilities

### New Capabilities

- `sync-preview-presentation`: 推送預覽彈窗的防跑版與直觀圖示設計規範，定義 Agent Icon、專案識別標籤的排版規則以及 Grid 寬高鎖定限制。

### Modified Capabilities

(none)

## Impact

- Affected specs:
  - New: `openspec/specs/sync-preview-presentation/spec.md`
- Affected code:
  - Modified:
    - `src/lib/components/skills/SyncPreviewDialog.tsx`
    - `src/lib/i18n/locales/en.ts`
    - `src/lib/i18n/locales/zh-TW.ts`
