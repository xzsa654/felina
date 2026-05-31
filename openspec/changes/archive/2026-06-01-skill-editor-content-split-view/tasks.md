## 1. Baseline

- [x] 1.1 執行 `npm run check` 記錄現有 TypeScript errors/warnings。驗證：記錄輸出結果。

## 2. ResizeObserver hook（Markdown Preview Toggle requirement）

- [x] 2.1 在 SkillEditor 中新增 `useRef` 引用 Content 區域容器 DOM 元素，搭配 `ResizeObserver` 監測容器寬度，將結果存入 `containerWidth` state。當元件 unmount 時 disconnect observer。驗證：`npm run check` 通過。

## 3. 三模式切換（Markdown Preview Toggle requirement）

- [x] 3.1 將現有 `bodyMode` state 從 `"edit" | "preview"` 擴展為 `"edit" | "preview" | "split"`。更新模式切換按鈕組，新增 Split 按鈕。Split 按鈕在 `containerWidth < 768` 時設為 `disabled`（`opacity-50 cursor-not-allowed`），Edit 和 Preview 按鈕永遠可用。當 `containerWidth` 從 ≥ 768 縮小至 < 768 且當前為 split 模式時，自動回退為 edit。驗證：`npm run check` 通過。

## 4. Split 版面渲染（Markdown Preview Toggle requirement）

- [x] 4.1 `bodyMode === "split"` 時渲染左右並排版面：外層 `flex gap-0`，左側 `w-1/2` 放 textarea，右側 `w-1/2 border-l border-border` 放 MarkdownPreview。兩側各自 `overflow-y-auto`，高度繼承父容器。驗證：`npm run check` 通過。

## 5. i18n

- [x] [P] 5.1 在 `src/lib/i18n/locales/en.ts` 與 `src/lib/i18n/locales/zh-TW.ts` 新增 `skills.editor.bodySplit`（"Split" / "並排"）。驗證：`npm run check` 通過。

## 6. 驗證

- [x] 6.1 執行 `npm run check`，確認零 error。驗證：與 baseline 相比無新增。
- [x] 6.2 `npm run tauri dev` 手動驗證：(1) Edit/Preview/Split 三個按鈕可見；(2) 視窗縮小至面板窄時 Split 按鈕 disabled；(3) Split 模式左右並排顯示正常；(4) Split 模式下縮小視窗自動回退 Edit；(5) Edit/Preview 切換不受寬度影響。驗證：五項行為皆符合預期。
