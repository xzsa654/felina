# Felina UI 設計與管理規範 (UI Design Guidelines)

本規範基於 2026-06-01 的 UI 重構討論，旨在確立 Felina 專案現代化、沉浸式的介面風格，並作為未來所有前端開發與 Agent 實作的最高指導原則。

---

## 一、 核心 UI 風格 (The Felina Style)

### 1. 文件中心化 (Document-Centric & Immersive)
* **理念**：讓使用者感覺是在「編寫一份高質感的筆記」，而不是在「填寫資料庫表單」。
* **體現**：
  - 標題大字體且無邊框（Notion 風格）。
  - Action Bar (Save/Rename/Delete) 整合進文件頭部。
  - 極大化文字編輯器的留白空間。

### 2. 去線條化與留白引導 (Borderless & Padding-driven)
* **理念**：拒絕生硬的邊框與死板的網格，利用空間本身來引導視覺。
* **體現**：
  - 清單放棄 `border-l-2` 等生硬線條，改用懸浮圓角卡片。
  - 資料表（如 CoverageMatrix）放棄 `gap-px` 與實線 `<table>`，改用適當的 Padding 與微弱的 Hover 背景色（`bg-bg-secondary/20`）來對齊資料。

### 3. 任務導向的資訊分層 (Task-Oriented Grouping)
* **理念**：介面不該只是把資料全部印出來，必須主動引導使用者「下一步要做什麼」。
* **體現**：
  - 將清單明確分組（如 `Action Required` vs `All Skills`）。
  - 將專案頁面分為 `Discovered (收件匣)` 與 `Managed (已盤點)`。
  - 利用標籤上的紅點或狀態燈號提供即時的防呆（Dirty State）提醒。

---

## 二、 規範與管理 (Standardization & Management)

為了讓這套風格在程式碼庫中落地生根，實作時必須遵守以下規範：

1. **強制使用 Page Scaffold (頁面骨架)**
   - 所有頂層頁面（包含未來的擴充）**必須**使用 `<PageHeader>` 與 `<PageBody>` 進行包裝，嚴禁使用 raw `<div className="p-6">` 手刻版面，以確保切換頁面時的視覺高度與排版完美對齊。

2. **單一資訊來源的元件化 (Single Source of Truth for Badges)**
   - Agent 標籤與 Target 標籤是全站最重要的 metadata，必須抽離成獨立的共用元件（如 `TargetChip`）。
   - 確保不管在 Editor、Projects 還是 List 裡，這些標籤的顏色、Typography、圓角與狀態燈號（✓、●、!）永遠保持全域一致。

3. **設定項的卡片化 (Card-based Configuration)**
   - 只要是「設定、表單、進階選項」，一律打包進圓角卡片（如 `bg-bg-secondary/30` 搭配極淺邊框）內，並視情況支援摺疊（Accordion），以保持主畫面的乾淨。

---

## 三、 嚴格禁止的設計 (Prohibited Anti-Patterns)

**任何違反以下紅線的 PR、Proposal 或 Code 修改，應予以退回或重新修正：**

1. **🚫 禁止「傳統填表感與死板表格」**
   - 除非是真正的財務數據報表，否則不准使用帶有硬邊框的 HTML `<table>`。所有的資料列表都應該使用 List View、Cards 或是 Flex 佈局來呈現。

2. **🚫 禁止「外掛式資訊列」**
   - 狀態資訊不准獨立成一塊擋在畫面中間（例如舊版的 `SyncInfoBar`）。必須將「狀態（如是否同步、是否修改）」優雅地融入現有的「元素（如 Target Chip 或 Save 按鈕）」中。

3. **🚫 禁止「發明與專案不符的新風格」**
   - 不准為了酷炫而引入違反現有 Tailwind Design System 的元件（例如突兀的 iOS 膠囊按鈕）。全站一致性永遠大於單一元件的特殊性。

4. **🚫 禁止「使用或參考舊有殘留頁面」**
   - 嚴禁參考舊專案 Glyphic 殘留的 `/settings` 與 `/template` 頁面的排版邏輯，切勿使用這些舊頁面的後端邏輯進行重構。
