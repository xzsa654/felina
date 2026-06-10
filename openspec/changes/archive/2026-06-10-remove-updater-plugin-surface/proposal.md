## Problem

在 dev 分支上的 commit 301fd7a 移除了 src-tauri/tauri.conf.json 的 plugins.updater 設定區塊與 bundle.createUpdaterArtifacts，但 Rust 端仍在 src-tauri/src/lib.rs 註冊 tauri_plugin_updater plugin。此後從 dev 建出的 Windows release 版（windows_subsystem = "windows"，無 console）在啟動時 panic：

PluginInitialization("updater", "Error deserializing 'plugins.updater' within your Tauri configuration: invalid type: null, expected struct Config")

使用者點擊 exe 完全沒反應、無任何錯誤訊息（ExitCode=101）。v1.1.0 tag（main）仍含 updater config 故不受影響；受影響的是 301fd7a 之後從 dev 建置的安裝檔。

## Root Cause

Tauri v2 的 updater plugin 在初始化時要求 plugins.updater 設定必須存在且可反序列化為其 Config struct。301fd7a 只刪了 config（因為 endpoint/pubkey 是 glyphic 上游模板殘留），未同步移除 lib.rs 的 plugin 註冊、前端 UpdateBanner、capability permission 與相依套件 — config 與 plugin 註冊不一致導致視窗建立前 panic。

依照 .knowledge/ideas-backlog.md 的 enable-tauri-updater 條目，內部散發走手動安裝 .msi/.exe，自動更新暫不啟用，因此正確修法是把 updater surface 全部正式移除，而非補回指向他人 release 的模板 config。

## Proposed Solution

正式移除整個 updater surface，使 config 與程式碼一致：

- 後端：移除 src-tauri/src/lib.rs 的 tauri_plugin_updater plugin 註冊；移除 src-tauri/Cargo.toml 的 tauri-plugin-updater 依賴。
- Capability：移除 src-tauri/capabilities/default.json 中的 updater:default permission。
- 前端：刪除 src/lib/components/layout/UpdateBanner.tsx；移除 src/router.tsx 中的 UpdateBanner import 與 <UpdateBanner /> 渲染；移除 package.json 的 @tauri-apps/plugin-updater 依賴（package-lock.json 由 npm install 同步）。
- 知識庫：更新 .knowledge/ideas-backlog.md 的 enable-tauri-updater 條目 — 修正「UpdateBanner.tsx 與 plugin 註冊均保留中、無需改動」的錯誤假設，改記載 surface 已全移除，未來啟用時需把 plugin 註冊 / UpdateBanner / permission / 依賴一併加回。

不需新增任何依賴；本 change 只移除既有依賴（npm 1 個、Cargo 1 個）。

## Non-Goals

- 不啟用自動更新（enable-tauri-updater 維持 parked-idea，留待未來獨立 change）。
- 不補回 plugins.updater config — glyphic 模板的 endpoint/pubkey 指向上游 release，補回只是讓 app 能啟動但行為不正確。
- 不重建受影響的安裝檔、不處理 release/tag 流程（修復 merge 後由既有 git release 流程出新版）。
- 不清理 openspec/specs/ 中過時的 UpdateBanner.svelte boilerplate 檔案清單（Svelte 時代殘留，與本修復無關）。

## Success Criteria

- 從 dev 以 npm run tauri build 建出的 Windows 安裝檔安裝後，點擊 exe 可正常開啟主視窗，不再無聲退出（ExitCode 不為 101）。
- 全 repo 搜尋 tauri-plugin-updater、@tauri-apps/plugin-updater、UpdateBanner、updater:default 在 src/、src-tauri/src/、src-tauri/capabilities/、src-tauri/Cargo.toml、package.json 中零命中（lock 檔與 gen/schemas 產物經 npm install / build 後同步消失）。
- npm run check 通過；cargo build 無 unused dependency / unresolved crate 錯誤。
- .knowledge/ideas-backlog.md 的 enable-tauri-updater 條目反映 surface 已移除的事實。

## Capabilities

### New Capabilities

- `manual-update-distribution`: Felina 以手動安裝檔（.msi/.exe/.dmg）散發，app 不得包含未設定的 auto-updater surface；啟動流程不依賴 plugins.updater config。

### Modified Capabilities

(none)

## Impact

- Affected code:
  - Modified: src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/capabilities/default.json, src/router.tsx, package.json, package-lock.json, src-tauri/Cargo.lock, .knowledge/ideas-backlog.md
  - New: (none)
  - Removed: src/lib/components/layout/UpdateBanner.tsx
- 破壞性變更：無（updater 功能因 config 缺失本就無法運作；移除後行為與 v1.0.0 使用者感知一致，僅少了從未啟用的更新檢查）。
- 跨 change 依賴：未來的 enable-tauri-updater（parked-idea）啟用時需重新加回完整 surface，已記載於 backlog 條目。
