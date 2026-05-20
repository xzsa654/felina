## 1. Build Baseline

- [x] 1.1 [P] 為 Build Baseline 契約建立基線檔案:跑 `npm run check` 與 `cd src-tauri && cargo build`,將完整 stdout / stderr 與 exit code 寫入 `openspec/changes/cleanup-glyphic-base/baseline.txt`,供後續驗證階段 diff 比對,明確區分本 change 新引入 vs pre-existing issues。Verify: 該檔案存在且包含兩段紀錄(npm 段與 cargo 段),各自 exit code 可讀。

## 2. Removed Pages and Subsystems — Frontend

- [x] 2.1 刪除 10 個已砍頁面元件目錄達成 Removed Pages and Subsystems 第一段契約:`src/lib/components/{dashboard,plugins,git,pipelines,sessions,terminal,analytics,token-savings,context-engine,keybindings}/` 整目錄刪除;以及 `src/lib/stores/{pipeline-execution,terminal}.ts` 與兩支對應 `.svelte.ts` 共 4 檔。Verify: `git ls-files src/lib/components/ src/lib/stores/ | grep -E '(dashboard|plugins|git|pipelines|sessions|terminal|analytics|token-savings|context-engine|keybindings|pipeline-execution)'` 結果為空。
- [x] 2.2 更新三處 nav 註冊來源落實 Registered Pages 與 Removed Pages and Subsystems 的「absent from navigation」契約,使三者只含 skills / settings / templates / memory:(1) `src/router.tsx` 的 routes 陣列移除 14 個非保留頁面 route 與對應 lazy import;(2) `src/lib/stores/navigation.ts` 的 `Page` type union 與 `NAV_ITEMS` 陣列收斂為四項;(3) `src/lib/components/layout/Header.tsx` 的 `PAGE_TITLES` 與 `PAGE_DESCRIPTIONS` 兩個 `Record<Page, string>` map 只保留四個 key。Verify: `npm run check` exit 0;三處來源各自只含四個 page id;`grep -E '(dashboard|plugins|git|terminal|analytics|pipelines|sessions|keybindings|context-engine|token-savings)' src/router.tsx src/lib/stores/navigation.ts src/lib/components/layout/Header.tsx` 結果為空。
- [x] 2.3 驗證 Sidebar 與 CommandPalette 對齊 Registered Pages:`src/lib/components/layout/Sidebar.tsx` 與 `src/lib/components/shared/CommandPalette.tsx` 皆 iterate `NAV_ITEMS`,確認收斂後渲染正確、無殘留對已刪頁面元件的直接 import。Verify: `npm run check` exit 0;grep 兩檔無已砍頁面元件名稱的 import。

## 3. Removed Pages and Subsystems — Rust

- [x] 3.1 [P] 移除 Rust 副產品完成 Removed Pages and Subsystems 第二段契約:刪除 `src-tauri/src/filter/`、`src-tauri/src/ctx/`、`src-tauri/src/pty.rs`、`src-tauri/src/bin/glyphic_filter.rs`、`src-tauri/src/bin/glyphic_ctx.rs`;刪除已砍命令 `src-tauri/src/commands/{pipelines,scheduler,git,sessions,plugins,context_engine,token_savings,keybindings}.rs`;從 `src-tauri/Cargo.toml` 的 `[[bin]]` 移除兩個條目並從 dependencies 移除 `portable-pty` 與 `fastembed`。Verify: 上述路徑於 `git ls-files` 中不存在;`cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1` 的 targets 不含 glyphic-filter / glyphic-ctx。
- [x] 3.2 更新 Rust 入口與 module 註冊以反映 Removed Pages and Subsystems:`src-tauri/src/lib.rs` 移除 `mod pty` / `pub mod ctx` / `pub mod filter` 宣告與 `manage(pty::PtyState::default())` 呼叫,並從 `invoke_handler!` 巨集移除已刪 commands 對應名稱;`src-tauri/src/commands/mod.rs` 移除已刪模組的 `mod` 與 `pub use`。Verify: `cd src-tauri && cargo build` exit 0,輸出無 unused warning 涉及 pty/filter/ctx/已刪 commands。

## 4. Retained-for-Reference Components

- [x] 4.1 落實 Retained-for-Reference Components 契約(取消註冊但保留檔案):`src-tauri/src/lib.rs` 的 `invoke_handler!` 移除 hooks / instructions / mcp / rules / budget / stats 對應 command 名;`src-tauri/src/commands/mod.rs` 將這六個模組宣告改為僅 `mod`(不 `pub use`),檔案本身保留。Verify: `cd src-tauri && cargo build` exit 0 且輸出無 unused warning 涉及這六個模組;`ls src-tauri/src/commands/{hooks,instructions,mcp,rules,budget,stats}.rs` 全部存在。
- [x] 4.2 同步 frontend invoke wrapper 對齊 Retained-for-Reference Components:`src/lib/tauri/commands.ts` 移除已刪 commands(pipelines / scheduler / git / sessions / plugins / context_engine / token_savings / keybindings)與取消註冊 commands(hooks / instructions / mcp / rules / budget / stats)對應的 invoke wrapper 函數;保留 skills / settings / templates / memory / maintenance 等仍註冊的 commands 對應 wrapper。Verify: `npm run check` exit 0。

## 5. No Svelte Residue

- [x] 5.1 [P] 落實 No Svelte Residue 第一段:刪除 `svelte.config.js`、`src/App.svelte`、`src/lib/stores/{navigation,project-context,theme}.svelte.ts` 三支配對檔(`pipeline-execution.svelte.ts` 與 `terminal.svelte.ts` 已於 task 2.1 隨頁刪除)。Verify: `git ls-files | grep -E '(\.svelte$|\.svelte\.ts$|svelte\.config)'` 結果為空。
- [x] 5.2 從 `package.json` dependencies 移除 `@xterm/xterm`、`@xterm/addon-fit`、`@xyflow/react`,執行 `npm install` 同步 `package-lock.json`,完成依賴清理對應 No Svelte Residue 與 Removed Pages and Subsystems 雙重契約。Verify: `node -e "const p=require('./package.json'); console.log(Object.keys(p.dependencies).filter(k=>k.startsWith('@xterm')||k==='@xyflow/react'))"` 輸出空陣列;`npm run check` exit 0。
- [x] 5.3 改寫 `README.md` 完成 No Svelte Residue 文件層面契約:Svelte badge → React badge、Tech Stack 表 Frontend 行改 React、Features 章節僅保留 skills / settings / templates / memory 段落並移除已砍 / 取消註冊頁面條目、移除對應 screenshots 引用、Project Structure 反映瘦身結構。Verify: `grep -i 'svelte' README.md` 結果為空(或僅明確標註的 history 段落)。

## 6. 文件同步

- [x] 6.1 改寫 `CLAUDE.md` 反映 cleanup 後新狀態:移除 Architecture 章節中 Embedded terminal / Context Engine / Token-savings filter / Pipelines 四個子系統段落;更新 navigation 說明為 router.tsx + react-router(取代 PAGE_MAP 描述);新增 Skill 主檔目錄結構說明(`~/.glyphic/skills/` 與 `<project>/.glyphic/skills/`);Gotchas 章節移除「Svelte badge stale」與「三個 Rust binaries」兩條(均已不適用);於 `src-tauri/Cargo.toml` 的 `rusqlite` 行上方加註解 `# kept for upcoming skill index work in agent-skills-schema-reference change`。Verify: `grep -E 'pty|filter|ctx|glyphic-filter|glyphic-ctx|PAGE_MAP' CLAUDE.md` 結果為空(或僅指 paths.rs 等保留模組);CLAUDE.md 含 `~/.glyphic/skills/` 字串;`src-tauri/Cargo.toml` rusqlite 上方有保留註解。

## 7. 最終驗證

- [x] 7.1 跑 `npm run check` 與 `cd src-tauri && cargo build`,分別 diff `openspec/changes/cleanup-glyphic-base/baseline.txt` 兩段;落實 Build Baseline 與 Page type consistency 契約:本 change 新引入 TypeScript errors / warnings 與 Rust warnings 皆為 0(特別確認 Header.tsx 無 Page type 相關錯誤),且 cargo build exit 0,target/debug/ 不存在 glyphic-filter 與 glyphic-ctx executable。Verify: 兩個 diff 無新增 error / warning;`ls src-tauri/target/debug/glyphic-filter* src-tauri/target/debug/glyphic-ctx*` 失敗(無對應檔)。
- [x] 7.2 跑 `npm run tauri dev` 手動驗證 Registered Pages 端對端契約:Sidebar 僅顯示 skills / settings / templates / memory 四項;依序點擊每個項目能正常渲染對應頁面(透過 react-router 導航)、瀏覽器 console 無 error;Cmd / Ctrl+K 打開 Command Palette 只列出四個頁面;Header 標題與描述正確對應當前頁面。Verify: 上述四項行為驗證人逐項確認;於本檔對應 task 勾選並於 PR description 記錄驗證細節。
- [x] 7.3 確認 Out of Scope 邊界未被破壞:`src/lib/components/tokens/` 目錄仍完整存在(BillyXu 孤兒程式碼未被本 change 動到);`src/App.tsx` 仍為僅含 `<RouterProvider>` 的極簡形式。Verify: `ls src/lib/components/tokens/TokensPage.tsx` 存在;`git diff --name-only` 不含 `src/App.tsx` 與 `src/lib/components/tokens/` 下任何檔案。
