## Context

本 repo fork 自 Glyphic(`package.json` 名稱仍為 `glyphic`,version `0.20.0`)。Glyphic 是 Claude Code 的視覺化 GUI,提供 18 個頁面管理 Claude Code 的 settings / hooks / memory / skills / MCP 等等。本專案改造目標是把它變成多 agent skill 管理器,不再綁定 Claude Code。

當前 repo 狀態混合了三個時期的痕跡:

- 上游 Glyphic React 重構(`f60c66c`,BillyXu)
- BillyXu 後續工作:`migrate-router-to-react-router-lazy`(已 done,未 archive)將頁面註冊從 `src/App.tsx` 的 `PAGE_MAP` 遷移到 `src/router.tsx`(react-router v7 + lazy loading);`add-token-i18n`(已 done,未 archive)加入 en / zh-TW i18n
- 早期 Svelte 殘留(`src/App.svelte` 仍在、`svelte.config.js` 仍在、`src/lib/stores/*.svelte.ts` 五支配對檔仍在、README badge 仍寫 Svelte)
- Claude-Code-專屬子系統仍在(PTY terminal、token-savings filter、context-engine semantic index、pipelines workflow、git/sessions/plugins/keybindings 等頁面)

直接在這個基礎上加多 agent skill 管理會踩到「Svelte 痕跡誤導實作」與「Claude-Code-專屬模組沒人維護」兩個風險。本 change 先清掉這些,讓後續 skill 管理改造從乾淨的基礎開始。

額外觀察:`src/lib/components/tokens/`(TokensPage + 13 個子元件)為 BillyXu 在 `feature/token-i18n` / `token-dev` 分支的 WIP,當前 main 已含元件檔但**未接 router 也未入 `NAV_ITEMS`**,屬於孤兒程式碼。**本 change 不處理**,由 BillyXu 後續 change 收尾。

## Goals / Non-Goals

**Goals:**

- 移除所有與「多 agent skill 管理」無關的頁面、Rust modules、binaries、dependencies。
- 移除 Svelte 殘留(配置檔、舊 `.svelte` / `.svelte.ts` 檔、README badge)。
- 保留四個「未來會擴成多 agent 版本」的頁面對應元件(hooks / instructions / mcp / rules)做為日後重啟用的種子,但從 router routes / NAV_ITEMS / Page type 拿掉。
- 結果:`npm run check` 通過、`cargo build` 在 `src-tauri/` 通過、`npm run tauri dev` 可開出剩餘的 skills / settings / templates / memory 四個頁面。

**Non-Goals:**

- 不實作任何 multi-agent skill 管理功能(留給 `multi-agent-skills-foundation`)。
- 不研究 Anthropic / OpenAI / Google skill schema(留給 `agent-skills-schema-reference`)。
- 不重寫保留頁面內部邏輯(skills / settings / templates / memory 維持現狀)。
- 不改 Tauri capability 或更新流程相關設定(`tauri.conf.json` 僅在移除 PTY capability 範圍內動,且若 router migration 已順手清過 PTY 設定則本 change 無動)。
- 不處理 `src/lib/components/tokens/` 孤兒程式碼(BillyXu 後續 change 負責)。

## In Scope

- Frontend pages:dashboard、plugins、git、pipelines、sessions、terminal、analytics、token-savings、context-engine、keybindings 整個元件目錄刪除。
- Nav 註冊三處同步更新(保留 skills / settings / templates / memory 四項):
  - `src/router.tsx` 的 routes 陣列
  - `src/lib/stores/navigation.ts` 的 `Page` type union 與 `NAV_ITEMS` 陣列
  - `src/lib/components/layout/Header.tsx` 的 `PAGE_TITLES` 與 `PAGE_DESCRIPTIONS` map
- Layout 元件:Sidebar.tsx 已用 `NAV_ITEMS` 渲染(自動跟著縮),CommandPalette.tsx 同理;但需驗證渲染結果與 Header 顯示正確。
- Stores:`pipeline-execution.ts` / `pipeline-execution.svelte.ts` / `terminal.ts` / `terminal.svelte.ts` 整支刪;`navigation.svelte.ts` / `project-context.svelte.ts` / `theme.svelte.ts` 三支 `.svelte.ts` 配對檔刪(`.ts` 保留)。
- Rust binaries:`glyphic-filter`、`glyphic-ctx` 從 `Cargo.toml` 的 `[[bin]]` 移除,對應 `src-tauri/src/bin/*.rs` 與 `src-tauri/src/filter/`、`src-tauri/src/ctx/` 整目錄刪除。
- Rust commands(整支刪除):pipelines、scheduler、git、sessions、plugins、context_engine、token_savings、keybindings。
- Rust commands(留檔但取消註冊):hooks、instructions、mcp、rules、budget、stats。
- Rust module:`src-tauri/src/pty.rs` 整支刪除,`src-tauri/src/lib.rs` 移除 `mod pty` 與 `manage(pty::PtyState::default())` 呼叫。
- `src/App.svelte`、`svelte.config.js` 刪除。
- Dependencies:Cargo.toml 移除 portable-pty 與 fastembed;package.json 移除 @xterm/xterm、@xterm/addon-fit、@xyflow/react。
- 文件:README.md(Svelte badge / 截圖列表 / Features / Tech Stack 表 / Project Structure)、CLAUDE.md(Architecture 章節)。
- TypeScript wrapper:`src/lib/tauri/commands.ts` 移除已刪除 Rust commands 對應的 invoke wrapper。

## Out of Scope

- 任何 multi-agent skill 邏輯(canonical 目錄、agents frontmatter、匯入匯出、CRUD)。
- 保留頁面(skills、settings、templates、memory)的元件內部重構。
- 留作參考頁面(hooks、instructions、mcp、rules)的元件內部變動——僅取消 router / nav / Page type 註冊與 Rust commands `invoke_handler!` 註冊。
- `src/App.tsx`(router migration 後已極簡至 `<RouterProvider>`,本 change 不需動)。
- `src/lib/components/tokens/` 與相關元件(BillyXu WIP 孤兒程式碼)。
- `tauri.conf.json` 大幅 capability 重構(若 PTY 相關設定已被 router migration 清理,本 change 不再動)。
- 圖標 / 應用程式名稱(`glyphic` → 未來新名稱)變更。
- 依賴版本升級(僅做移除,不做升版)。

## Decisions

**決策 1:留作參考的處理採「取消註冊但保留檔案」而非「完全刪除」**

選擇:hooks、instructions、mcp、rules 四個頁面對應的 frontend components 與 Rust commands 模組保留在 repo,但從 `src/router.tsx` 的 routes、`src/lib/stores/navigation.ts` 的 `NAV_ITEMS` / `Page` type、`Header.tsx` 的 PAGE_TITLES / PAGE_DESCRIPTIONS、`invoke_handler!` 巨集移除註冊。

理由:這四個概念在多 agent 管理器情境下都會回來(hooks → 各 agent 都有 hook 概念、instructions → CLAUDE.md / AGENTS.md / GEMINI.md 多檔管理、mcp → 跨 agent 標準、rules → 各 agent 的 rules 對應 instruction)。重新從 git history 撈檔的成本(找 commit、cherry-pick、解 import path 衝突)高於保留檔案的成本(目錄佔空間幾百 KB、不執行也不影響運行)。

替代方案:完全刪除,日後從 git history 還原。捨棄理由:還原時還要重對 `mod.rs` 與 invoke_handler 註冊,容易遺漏依賴(例如 `paths.rs` 的 import)。

**決策 2:`budget.rs` 與 `stats.rs` 留檔但取消註冊,而非完全刪除**

選擇:即使 dashboard / analytics 全砍,`commands/budget.rs` 與 `commands/stats.rs` 兩支 Rust 檔案保留,僅從 `invoke_handler!` 取消註冊。

理由:Settings 頁面引用了部分 budget / stats 函數(`commands/budget.rs` 內定義的 alert threshold 結構在 SettingsPage 中也使用)。Settings 在本 change 不重寫,直接刪 budget/stats 會連帶要改 Settings,擴大 change 範圍。等到 Settings 在後續 change 重寫時再決定是否完全刪除。

替代方案:刪 budget/stats 並同步改 Settings。捨棄理由:增加本 change 的 scope 與審查負擔,且 Settings 重寫是另一個 change 的 scope。

**決策 3:Cargo.toml 保留 `rusqlite` 即使 phase 1 不使用**

選擇:移除 portable-pty 與 fastembed,但保留 rusqlite。

理由:`agent-skills-schema-reference` 與 `multi-agent-skills-foundation` 在後續 change 中可能需要 SQLite 做 skill 索引或 drift 狀態快取。`rusqlite` 啟用 `bundled` feature 時體積不算大且依賴穩定,移除後再加回的成本高於暫時保留的成本。

替代方案:全砍,需要時再加。捨棄理由:cargo build 對 rusqlite 的 bundled SQLite 第一次編譯時間長(數分鐘),反覆移除與加回浪費編譯時間。

**決策 4:`.svelte.ts` 配對檔的處理分兩類**

選擇:跟著頁面一起刪除的:`pipeline-execution.svelte.ts`、`terminal.svelte.ts`(對應頁面已砍)。獨立刪除的:`navigation.svelte.ts`、`project-context.svelte.ts`、`theme.svelte.ts`(對應 `.ts` 版本還在使用,只刪 `.svelte.ts` 配對)。

理由:對應頁面已不存在的 store(pipeline-execution、terminal)沒有保留價值,連同頁面一起刪。另外三支的 `.ts` 版本仍是 active store(`navigation` 提供 `Page` type / NavItem / NAV_ITEMS、`project-context` 與 `theme` 是全域狀態),只刪 `.svelte.ts` 配對檔即可消除 README badge 與整體 Svelte 痕跡。

替代方案:全保留 `.svelte.ts` 配對檔。捨棄理由:留下死碼會持續誤導(尤其新人會以為兩個版本可能要同步)。

**決策 5:Nav 註冊三處同步更新而非僅改 `NAV_ITEMS`**

選擇:cleanup 必須同時修改三個檔案——`src/router.tsx`(routes 陣列)、`src/lib/stores/navigation.ts`(`Page` type 與 `NAV_ITEMS`)、`src/lib/components/layout/Header.tsx`(`PAGE_TITLES` 與 `PAGE_DESCRIPTIONS`)——三者必須對齊。

理由:router migration 後,頁面註冊資訊散落在三個檔案而非單一 PAGE_MAP。`Page` type 從 18 收到 4 後,Header.tsx 的兩個 `Record<Page, string>` map 若未同步刪除被砍頁面 key,會被 TypeScript 報 excess property 錯。Sidebar.tsx / CommandPalette.tsx 因為都 iterate `NAV_ITEMS`,改 `NAV_ITEMS` 即自動跟上,不需直接編輯。

替代方案 A:僅修改 `NAV_ITEMS`,讓 router.tsx 與 Header maps 留含被砍頁面條目。捨棄理由:router routes 留下後仍可被 deep-link 進入已刪頁面元件(會編譯失敗或 runtime crash);Header 的 `Record<Page, ...>` map 在 Page type 收窄後會出現 TypeScript 錯誤。
替代方案 B:把 `Page` type 維持 18 成員,只改 `NAV_ITEMS`。捨棄理由:留下 type 中不再存在的 page id 會誤導未來實作,失去 cleanup 的意義。

**決策 6:`src/lib/components/tokens/` 孤兒程式碼維持原狀**

選擇:即使 TokensPage 與 13 個子元件目前未接 router、未入 NAV_ITEMS,本 change 不刪除、不接線、不重新註冊。

理由:這是 BillyXu 在 `feature/token-i18n` / `token-dev` 分支的 WIP,可能即將透過下一個 PR / change 接到 router 與 NAV_ITEMS。本 cleanup 動到只會踩到 BillyXu 的進行中工作,造成 merge conflict。在 design.md 與 proposal.md 中明確標記為 OOS,讓未來 reviewer 理解此目錄殘留為已知狀態。

替代方案:當作孤兒砍掉。捨棄理由:會與 BillyXu 進行中工作衝突。

## Implementation Contract

**Behavior(本 change 完成後的可觀察結果):**

- `npm run check` 退出碼 0,輸出無 TypeScript error(允許 pre-existing warning,需與 baseline 比對)。特別注意 Header.tsx 的 `PAGE_TITLES` / `PAGE_DESCRIPTIONS` 必須只含保留的 4 個 key,不能有 missing 或 excess。
- `cargo build` 在 `src-tauri/` 目錄退出碼 0(僅 default binary `glyphic`,不再有 `glyphic-filter` / `glyphic-ctx`)。
- `npm run tauri dev` 啟動後,Sidebar nav 僅顯示 skills、settings、templates、memory 四個項目,點擊各項目能正常渲染對應頁面,無 console error。
- Command palette(Cmd+K)只列出對應四個頁面與 theme toggle,不再顯示已砍頁面選項。
- `glyphic-filter` 與 `glyphic-ctx` binary 在 `target/debug/` 不再產出。
- `src/App.svelte` 與 `svelte.config.js` 不存在於 repo;`grep -r "Svelte" README.md` 僅匹配 history 段落(若有)。
- `src/lib/components/tokens/` 目錄仍存在(out of scope)。

**Interface / 檔案路徑契約:**

- Removed file paths(完全刪除):見 proposal Impact 章節 Removed 列表。
- Modified file paths(內容修改):見 proposal Impact 章節 Modified 列表。
- `src/router.tsx` 的 routes 必須與 `NAV_ITEMS`、Header `PAGE_TITLES` / `PAGE_DESCRIPTIONS` keys 一一對應(無漏無多,全部限制在 4 個保留頁面)。
- `src-tauri/src/lib.rs` 的 `invoke_handler!` 巨集列出的 command 與 `commands/mod.rs` 的 `pub use` 必須一致(無孤兒、無未註冊)。

**Failure modes:**

- 若編譯時出現 unused import / unused module warning,屬於本 change 的清理疏漏,需在 verify 階段修正。
- 若 `npm run tauri dev` 啟動後 Sidebar 仍出現已砍頁面項目,屬於 `NAV_ITEMS` 未同步,需修正 navigation.ts。
- 若 TypeScript 報 `Page` type 相關錯誤,屬於 Header.tsx 兩個 maps 未同步收斂,需修正 Header.tsx。

**Acceptance criteria:**

- 跑 `npm run check`,輸出與 baseline(本 change tasks 第一個 baseline task 記錄的)比對,新引入 errors / warnings 為 0。
- 跑 `cd src-tauri && cargo build`,exit code 0,無 unused import / unused module warning。
- 跑 `npm run tauri dev`,人工驗證四個保留頁面可正常開啟、無 console error、Sidebar nav 項目正確。
- `grep -l "svelte" src/ src-tauri/ package.json Cargo.toml` 只匹配可接受的 history 段落(若有)。
- `git ls-files | grep -E '\.svelte(\.ts)?$|svelte\.config'` 結果為空。

**Scope boundaries:**

- 在 scope:上述 In Scope 章節列出的所有檔案的刪除 / 修改 / 取消註冊。
- 出 scope:任何保留頁面(skills / settings / templates / memory)的內部邏輯變更、任何留作參考頁面(hooks / instructions / mcp / rules)的內部邏輯變更、任何 multi-agent skill 功能實作、任何 Tauri capability 重整、`src/App.tsx`、`src/lib/components/tokens/` 整目錄。

## Risks / Trade-offs

- [Risk] 留作參考的 Rust commands 雖然取消註冊,但若其內部 `use crate::xxx` 仍引用已刪除模組(例如某個 hook 內部用了 `ctx::` 或 `pty::`),會直接編譯失敗 → Mitigation:tasks 階段於刪除每個模組後立即跑 `cargo build`,出 error 就在當下解決,不累積到最後。
- [Risk] React 元件殘留 import 已刪頁面元件導致 `npm run check` failed → Mitigation:tasks 階段以 router.tsx 與 NAV_ITEMS 為驅動,先改這兩處,跑 `npm run check` 找出剩餘斷裂的 import,逐一修正。
- [Risk] `Page` type 收斂後 Header.tsx 的 `Record<Page, string>` maps 未同步,TypeScript 報錯 → Mitigation:任務序列明確要求三處(router routes、NAV_ITEMS、Header maps)同步更新,並在驗證階段檢查。
- [Risk] `rusqlite` 保留但無使用方,Cargo 可能報 unused dependency warning → Mitigation:`Cargo.toml` 加註解標明「kept for upcoming skill index work in agent-skills-schema-reference change」。
- [Risk] 與 BillyXu `feature/token-i18n` / `token-dev` 分支的 merge conflict → Mitigation:tokens 目錄明確 OOS,不動;若 BillyXu 在本 change 進行期間 push 新工作到 dev,本 change 須在 verify 階段重新 fast-forward dev 並驗證 tokens 接線狀態未變(避免本 change unintended 影響 tokens 接線)。
- [Trade-off] 留作參考方案會留下不被執行的程式碼,違反「YAGNI」原則。接受理由見決策 1。
- [Trade-off] 三處 nav 註冊分離(routes / NAV_ITEMS / Header maps)增加 cleanup 複雜度。接受理由:這是 router migration 既成事實,本 change 配合而非重新整合。

**安全敏感性評估:** 本 change 為純移除/重構,不引入新的檔案系統存取、外部命令執行、或外部輸入處理。**不需要** `/spectra-audit`。

**第三方依賴變動:** 僅移除(portable-pty、fastembed、@xterm/*、@xyflow/react),不新增。對 bundle size 預期為**減少**(@xterm + @xyflow 約 200KB+ minified;fastembed binary embedding model 數十 MB)。**不需要** license-audit(僅移除)。
