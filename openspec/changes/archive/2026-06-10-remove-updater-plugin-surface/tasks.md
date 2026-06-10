## 1. Baseline

- [x] 1.1 跑 npm run check 記錄現有 TypeScript errors / warnings 作為 baseline；同時在 src-tauri/ 跑 cargo build 確認現況可編譯。驗證:輸出記錄於本 session,後續 task 以此區分新引入 vs pre-existing 問題。

## 2. 移除 updater surface

- [x] 2.1 [P] 後端移除:刪除 src-tauri/src/lib.rs 中 tauri_plugin_updater::Builder 的 .plugin(...) 註冊,並從 src-tauri/Cargo.toml 移除 tauri-plugin-updater 依賴。完成條件:src-tauri/ 內 cargo build 通過,且 grep tauri-plugin-updater 在 src-tauri/src/ 與 src-tauri/Cargo.toml 零命中(Cargo.lock 由 build 自動同步)。
- [x] 2.2 [P] Capability 移除:從 src-tauri/capabilities/default.json 移除 "updater:default" permission。完成條件:該檔不含 updater 字樣,且 task 2.1 後的 cargo build 不因 unknown permission 失敗。
- [x] 2.3 [P] 前端移除:刪除 src/lib/components/layout/UpdateBanner.tsx;移除 src/router.tsx 的 UpdateBanner import 與 AppLayout 中的 <UpdateBanner /> 渲染;從 package.json 移除 @tauri-apps/plugin-updater 並跑 npm install 同步 package-lock.json。完成條件:Test-Path 該 tsx 檔為 False,npm run check 通過,grep plugin-updater 在 src/ 與 package.json 零命中。
- [x] 2.4 [P] 知識庫更新:修改 .knowledge/ideas-backlog.md 的 enable-tauri-updater 條目 — 移除「UpdateBanner.tsx 與 tauri-plugin-updater 註冊均保留中,無需改動」的錯誤敘述,改記載 updater surface 已於本 change 全數移除,未來啟用時需加回 plugin 註冊、plugins.updater config、UpdateBanner 元件、updater:default permission 與 npm/Cargo 依賴。完成條件:條目內容反映移除後事實,不再宣稱任何 updater 程式碼保留中。

## 3. 驗證

- [x] 3.1 靜態驗證:npm run check 通過且無相對 baseline 新增的錯誤;src-tauri/ 內 cargo build 通過;全 repo(排除 node_modules、target、openspec/changes/archive)grep tauri-plugin-updater、@tauri-apps/plugin-updater、UpdateBanner、updater:default 在 src/、src-tauri/src/、src-tauri/capabilities/、src-tauri/Cargo.toml、package.json 零命中。
- [x] 3.2 啟動行為驗證(覆蓋 requirement: Application starts without updater configuration):npm run tauri dev 啟動,確認主視窗正常開啟、AppLayout(sidebar + 頁面內容)正常渲染、console 無 updater 相關錯誤、頂部不再出現 update banner 區塊。
- [x] 3.3 跑 /felina-ui-guidelines 評估本 change 的 UI 改動(UpdateBanner 移除與 router.tsx layout 調整),輸出命中的 guideline 與 deviation 清單。完成條件:清單已輸出且無未處理的 deviation。
- [x] 3.4 Release build 驗證(覆蓋 requirement: Distribution is manual installer based):npm run tauri build 產出 Windows 安裝檔,安裝後點擊 exe 確認主視窗開啟、不再無聲退出(process 不以 ExitCode 101 結束)。
