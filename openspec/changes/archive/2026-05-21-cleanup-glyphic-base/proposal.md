## Why

本 repo fork 自 Glyphic(Claude Code 視覺化 GUI),目標改造成「多 agent skill 管理器」(管 Anthropic / Codex / Gemini 共用的 skill 主檔)。改造前需要先把與目標無關的頁面、副產品、與舊框架(Svelte)殘留清掉,讓後續功能在乾淨基礎上開發,避免 dead code 與誤導性註記(README 仍標示 Svelte,但實際是 React)。

BillyXu 已透過 `migrate-router-to-react-router-lazy` 完成 PAGE_MAP → react-router(`src/router.tsx`)+ lazy loading 遷移,本 change 在新架構上執行 cleanup。

## What Changes

- **BREAKING** 從 `src/router.tsx` 的 routes 陣列、`src/lib/stores/navigation.ts` 的 `Page` type union 與 `NAV_ITEMS` 陣列、`src/lib/components/layout/Header.tsx` 的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` map 移除 10 個頁面對應條目:dashboard、plugins、git、pipelines、sessions、terminal、analytics、token-savings、context-engine、keybindings。並刪除對應 frontend components 目錄。
- **BREAKING** 刪除 Rust 副產品:`glyphic-filter` binary(token-savings)、`glyphic-ctx` binary(context-engine)、`src-tauri/src/pty.rs`(embedded terminal)、`src-tauri/src/filter/`、`src-tauri/src/ctx/`。對應的 `[[bin]]` 條目從 `src-tauri/Cargo.toml` 移除。
- **BREAKING** 刪除完全不再使用的 Rust commands 模組:pipelines、scheduler、git、sessions、plugins、context_engine、token_savings、keybindings,並從 `src-tauri/src/commands/mod.rs` 與 `src-tauri/src/lib.rs` 的 `invoke_handler!` 巨集移除註冊。
- 留作參考(從 router routes、`NAV_ITEMS`、`Page` type、Header maps 移除,但 frontend 元件與 Rust commands 模組留在 repo):hooks、instructions、mcp、rules。Rust commands 從 `invoke_handler!` 移除註冊(避免編譯出未使用的 command),但檔案保留。
- 保留(本 change 不動):skills、settings、templates、memory。
- 移除 Svelte 殘留:`svelte.config.js`、`src/App.svelte`、所有 `src/lib/stores/*.svelte.ts` 配對檔(navigation / pipeline-execution / project-context / terminal / theme)。其中 pipeline-execution / terminal 兩支隨頁面一起刪;另外三支(navigation / project-context / theme)刪除 `.svelte.ts` 配對檔,保留 `.ts` 版本。
- 更新 `README.md`:Svelte badge 改為 React,移除已砍頁面的 Features / Screenshots 區段,Project Structure 反映瘦身後結構。
- 更新 `CLAUDE.md`:Architecture 章節改寫,反映砍除的子系統(token-savings / context-engine / terminal / pipelines)、留作參考頁面、與新增的 `~/.glyphic/skills/` 主檔目錄結構。

## Non-Goals

- 不實作任何多 agent skill 管理功能(canonical 主檔、agent 設定、初始化匯入、CRUD、匯出)——屬於後續 `multi-agent-skills-foundation` change。
- 不研究 Anthropic / Codex / Gemini 的 skill schema——屬於後續 `agent-skills-schema-reference` change。
- 不重寫 skills / settings / templates / memory 頁面——屬於後續 change 範圍。
- 不引入新依賴(包含 HeroUI 等元件庫)。
- 不修改保留頁面對應的 Rust commands(hooks / instructions / mcp / rules 的 commands.rs 檔案僅取消 invoke 註冊,內部邏輯不動)。
- **不處理 `src/lib/components/tokens/` 孤兒程式碼**(TokensPage 與 13 個子元件)。此為 BillyXu 在 `feature/token-i18n` / `token-dev` 分支的 WIP,目前 main 上未接 router 也未入 NAV_ITEMS;後續由 BillyXu 自己的 change 收尾,本 cleanup 不動 `src/lib/components/tokens/` 目錄。

## Capabilities

### New Capabilities

- `app-pages`: 定義 desktop app 在 cleanup 後對外提供的頁面集合與 nav 註冊規則。本 capability 確立瘦身後的 app shell 契約(skills / settings / templates / memory 四個註冊頁面,並列出留作參考但不註冊的元件),供後續 change 在此基礎上延伸。

### Modified Capabilities

(none — 本 repo 尚無既有 capability spec)

## Impact

Affected code:

- Removed:
  - src/lib/components/dashboard/
  - src/lib/components/plugins/
  - src/lib/components/git/
  - src/lib/components/pipelines/
  - src/lib/components/sessions/
  - src/lib/components/terminal/
  - src/lib/components/analytics/
  - src/lib/components/token-savings/
  - src/lib/components/context-engine/
  - src/lib/components/keybindings/
  - src/lib/stores/pipeline-execution.ts
  - src/lib/stores/pipeline-execution.svelte.ts
  - src/lib/stores/terminal.ts
  - src/lib/stores/terminal.svelte.ts
  - src/lib/stores/navigation.svelte.ts
  - src/lib/stores/project-context.svelte.ts
  - src/lib/stores/theme.svelte.ts
  - src/App.svelte
  - svelte.config.js
  - src-tauri/src/bin/glyphic_filter.rs
  - src-tauri/src/bin/glyphic_ctx.rs
  - src-tauri/src/filter/
  - src-tauri/src/ctx/
  - src-tauri/src/pty.rs
  - src-tauri/src/commands/pipelines.rs
  - src-tauri/src/commands/scheduler.rs
  - src-tauri/src/commands/git.rs
  - src-tauri/src/commands/sessions.rs
  - src-tauri/src/commands/plugins.rs
  - src-tauri/src/commands/context_engine.rs
  - src-tauri/src/commands/token_savings.rs
  - src-tauri/src/commands/keybindings.rs
- Modified:
  - src/router.tsx
  - src/lib/stores/navigation.ts
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/components/layout/Header.tsx
  - src/lib/components/shared/CommandPalette.tsx
  - src/lib/tauri/commands.ts
  - src-tauri/src/lib.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/Cargo.toml
  - package.json
  - README.md
  - CLAUDE.md
- Untouched(明確 out of scope):
  - src/lib/components/tokens/(BillyXu 的孤兒程式碼)
  - src/App.tsx(router migration 後已極簡,僅 RouterProvider,無 cleanup 範圍內的變動)

Dependency 變動:

- `src-tauri/Cargo.toml` 移除:portable-pty、fastembed。保留 rusqlite(暫不移除,未來 phase 引入 skill index 時可能使用)。
- `package.json` 移除:@xterm/xterm、@xterm/addon-fit、@xyflow/react。保留 @codemirror/*(SKILL.md 編輯使用)。
- 不新增任何 dependency。

風險評估:

- **破壞性變更**:對既有 Glyphic 使用者(若有)所有移除頁面與 PTY terminal 不再可用。本 repo 為內部 fork,實際使用者僅本組,評估可接受。
- **跨 change 依賴**:後續 `agent-skills-schema-reference` 與 `multi-agent-skills-foundation` 兩個 change 依賴本 change 完成的乾淨基礎;本 change 不依賴其他 change。
- **backward compatibility**:無——本 change 不修改任何對外介面(無 server、無對外協定),僅影響 desktop app UI 與本機檔案讀寫範圍。
- **編譯風險**:保留模組(hooks / instructions / mcp / rules / budget / stats)從 `invoke_handler!` 取消註冊後,若該模組仍 `pub use` 於 `mod.rs` 會留下未使用 warning。本 change 同時調整 `mod.rs` 使保留模組改為非 `pub use`(僅 `mod` 宣告)以消除 warning,同時保有原始檔案內容方便日後恢復。
- **Page type 收斂連帶風險**:`navigation.ts` 的 `Page` type union 從 18 個成員縮到 4 個後,引用該 type 的其他檔案(尤其 `Header.tsx` 的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS`)若仍含被砍頁面 key,TypeScript 會報 excess property 或 missing 錯誤。本 change 同步調整這些 map。
- **孤兒程式碼存在風險**:`src/lib/components/tokens/` 目錄在本 change 完成後仍存在但不被 router / nav 引用。屬於既知狀態,由 BillyXu 後續 change 處理,本 change 不修正。
