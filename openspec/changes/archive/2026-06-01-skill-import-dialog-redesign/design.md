## Context

目前的 Skill 匯入對話框 (Import Dialog) 依賴傳統的點擊匯入、出現衝突時跳出 Alert 視窗中斷流程，不符合 Felina 去線條化、任務導向的設計精神。我們將重構為雙區塊 (Split View) 拖曳介面，左側顯示偵測到的檔案，右側作為準備匯入的佇列，並在右側即時處理同名衝突。

## Goals / Non-Goals

**Goals:**

- 實作雙區塊 (Left: Discovered, Right: To Import) 的無邊框卡片化介面。
- 支援原生的 HTML5 Drag and Drop 與雙擊快速移動。
- 實作行內衝突處理 (Inline Conflict Resolution)，遇到同名 Skill 時，在卡片下方展開 Overwrite / Rename 選項。
- 整合 Tauri 的系統檔案選擇器 (Browser Dialog) 作為左側偵測池的資料來源之一。

**Non-Goals:**

- 不實作多餘或過度浮誇的動畫（如拖曳時放大、物理陰影等）。
- 不實作右側佇列中直接編輯 Skill 內容的功能。
- 不改變後端的匯入邏輯或 `agent-native` skill 讀取機制，純前端 UI/UX 重構。

## Decisions

**1. 雙區塊佈局與拖曳機制**
- **Decision**: 採用左右各 50% 的 Flex 佈局，中間留適當間距 (Gap) 代替分隔線。拖曳使用原生 HTML5 Drag and Drop (`draggable={true}` 與 `onDrop` 等事件)，不引入 `dnd-kit` 或 `framer-motion`。
- **Rationale**: 保持系統操作的快速與俐落感，避免過度依賴外部套件造成的 bundle size 增加與效能拖累。

**2. 狀態顏色與視覺回饋**
- **Decision**: 狀態辨識依賴極簡設計：無衝突為綠色標籤 (`Ready`)；衝突時展開警告區塊並顯示按鈕 (`[Overwrite]`, `[Rename]`)。
- **Rationale**: 去除多餘動畫後，顏色與版面位置是最直接的資訊傳遞方式。

**3. 系統檔案選擇器 (Browser Dialog) 整合**
- **Decision**: 檔案選擇器不再直接觸發匯入，而是透過 `@tauri-apps/plugin-dialog` 讀取檔案後，將結果（Skill 內容與名稱）塞入左側的偵測池陣列。
- **Rationale**: 統一匯入流程，讓所有要匯入的項目都必須經過左側到右側的決策過程。

## Implementation Contract

- **Behavior**:
  - 開啟 Import Dialog 後，顯示左右兩區塊。
  - 左側可透過點擊文字連結觸發系統選檔視窗，選取的檔案會顯示為左側卡片。
  - 使用者可拖曳（或雙擊）卡片至右側佇列。
  - 右側佇列若偵測到名稱與現有 Canonical skill 重複，卡片下方展開衝突選單，並鎖定底部的 `Import` 大按鈕，直到使用者為該卡片選擇 Overwrite 或 Rename 並完成修改。
- **Interface / Data Shape**:
  - `ImportStagingDialog.tsx` 接收現有 skill 清單作為衝突檢查依據。
  - 內部狀態維護 `discoveredSkills` 與 `stagingSkills` 陣列。
- **Acceptance Criteria**:
  - 確認可以從左側拖拉至右側，並能雙擊移動。
  - 確認選取外部檔案後，檔案出現在左側。
  - 確認右側遇到同名 Skill 時能正確展開衝突處理介面。
  - 確認衝突未解決前，Import 按鈕為 disabled。
- **Scope boundaries**:
  - In scope: 前端 Import Dialog UI 重構與內部狀態管理。
  - Out of scope: 後端 `import_skill` 指令邏輯修改（直接沿用現有指令，前端透過迴圈或 API 呼叫完成 batch）。

## Risks / Trade-offs

- [Risk] 拖拉功能在某些特定 OS 上的預設行為不一致 → [Mitigation] 確保同時實作「雙擊 (Double Click)」作為可靠的替代操作方式。
- [Risk] 大量檔案一次匯入時的效能瓶頸 → [Mitigation] 此為邊界情境，維持現有後端指令的呼叫方式，必要時在前端加入 Loading 狀態。
