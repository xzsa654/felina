## Context

Phase 1.5 (a) `known-projects-and-multi-target`（已 archived）建立了 per-skill target editor（Tracked / Disabled 兩態 + Detached/Forked disabled 佔位）、Known Projects 三來源模型（L1 cwd / L2 auto-detect / L3 explicit JSON）、以及 fan-out push 由 target 清單驅動的架構。但 AddTargetDialog 將非當前 project 的 entry disabled，fan-out 的 `resolve_pair` 雖然已能根據 `target.project` 路由到任意 project 路徑，前端不允許建立這樣的 target。

技術棧：Tauri v2 + React 19 / TS + Rust；後端 cargo test 守 regression。Tauri 的 `@tauri-apps/plugin-dialog` 提供 `open({ directory: true })` 可供 folder picker。

## Goals / Non-Goals

**Goals:**

- 解除 AddTargetDialog 的 cross-project 限制，讓所有 Known Projects 項目可選為 target。
- 提供 manual project path entry（Tauri folder dialog），寫入 L3 讓路徑即時出現在下拉。
- 新增 Skills 頁 Summary view-mode（coverage matrix），顯示 skill × target grid 與 sync state。
- origin-project 消失時優雅降級（disabled + "project not found"）。

**Non-Goals:**

- Push dry-run、push-time drift、cascade-delete prompt（留 (c)）。
- Forked overlay rendering（Phase 2）。
- Coverage matrix 虛擬滾動（Phase 2 capability registry 擴展時再考慮）。

## Decisions

### Cross-project target：前端解鎖 + 後端已就緒

AddTargetDialog 移除 `disabled={!isCurrent}` 限制，所有 Known Projects 項目均可選。後端 `skill_sync_one` 已用 `target.project.as_deref()` 傳入 `resolve_target_dir`，不需要改動——cross-project target 的 `project` 欄位指向目標路徑，`resolve_pair` 自然將其與 `pair.project_relative` 拼接。

Canonical 只存在於 origin project 的 `.felina/skills/`；cross-project push 只寫 rendered SKILL.md 到目標 project 的 agent 目錄，不複製 canonical 或 sync-meta。

理由：最小改動原則——後端路由已正確，只需前端解鎖。

### Manual project path entry：Tauri folder dialog + known_projects_add

AddTargetDialog 的 project 選擇器旁新增「Browse...」按鈕。點擊呼叫 `dialog.open({ directory: true })`，選中後呼叫 `api.knownProjects.add(path)` 寫入 L3，然後重新 `api.knownProjects.list()` 刷新下拉清單並自動選中新路徑。

需要在 `src-tauri/Cargo.toml` 加入 `tauri-plugin-dialog` dependency（若尚未安裝）並在 `lib.rs` 註冊 plugin。前端 import `@tauri-apps/plugin-dialog`。

理由：folder dialog 比手打路徑自然；寫入 L3 確保路徑持久化，下次開 app 仍可見。

### Coverage summary view-mode：SkillsPage 內 List / Summary toggle

SkillsPage header 區新增 view-mode toggle（兩個 icon button：list view / grid view），與現有 scope toggle 並排。

- **List mode**（現有）：左側 SkillList + 右側 SkillEditor/TargetEditor。
- **Summary mode**（新）：全寬 grid。行 = skill（按 name 排序），列 = 去重的 target 組合（agent × scope × project）。Cell 顯示 sync state icon：
  - `✓` synced（lastSync entry 存在且 dirty=false）
  - `●` dirty（有 lastSync 但 dirty=true）
  - `—` not synced（target 存在但無 lastSync entry）
  - `○` disabled（target enabled=false）
  - 空白 = 該 skill 無此 target

列 header 顯示 `agent / scope`（global 時）或 `agent / project-name`（project 時，顯示最後一段路徑作為短名）。

初期列數由實際 target 組合決定（3 agents × 2 scopes = max ~6 per project），CSS grid + 垂直滾動。不需要 filter/sort 功能（初期 skill 數量有限）。

理由：Summary 是 Skills 的子關注點，不值得開獨立 route。toggle 模式讓使用者在「逐 skill 編輯」和「全局覆蓋檢視」間快速切換。

### Origin-project 消失時的降級

判定方式以**檔案系統實際存在性**為準，而非「是否仍在 Known Projects 清單」。後端 `known_projects_list` 對每筆 project 以 `std::path::Path::exists()` 填一個 `exists: bool` 欄位（不新增 command，只擴充既有回傳形狀）；TS `KnownProject` type 同步加 `exists`。

前端降級判定（Sync info bar 與 Coverage matrix）：對 project-scope target，
- 在清單且 `exists === true` → 正常；
- 在清單但 `exists === false`（資料夾被刪 / 改名 / 磁碟卸載）→ 顯示 "project not found"（紅色），而非 "Not synced"；
- 不在清單（被移出 Known Projects）→ 同樣視為 "project not found"。

Push 仍跳過解析失敗的 target（`skill_sync_one` 在 `resolve_target_dir` 失敗時產生 `SyncResult { success: false, error }`，行為不變）。

**為何不用「清單成員」當判定**：L3 saved 項目存在 `~/.felina/known-projects.json`，改名 / 刪除資料夾不會更動 JSON，清單成員永遠通過 → 偵測失效（smoke 實測確認）。必須做實際 stat。

**為何不用 bash stat**：後端是 Rust，`Path::exists()` 直接 stat、跨平台、不開 shell、無路徑注入風險；bash 在 Windows 預設不可用，會造成反向的平台特化。

**刷新時機**：`exists` 是 snapshot，於 `known_projects_list` 被呼叫時更新——時機為 (1) Skills 頁掛載、(2) 手動 Reload、(3) 視窗重新取得焦點（window focus / visibilitychange）、(4) 加 target / push 後 `entries` 變動。不做 file watcher / 輪詢。已卸載的網路磁碟 stat 可能延遲，但跑在後端 command（前端 await），不凍 UI。

不自動將 target 切 disabled 或刪除——使用者可能只是暫時 unmount 或重命名，修正後 target 自然恢復。passive degradation 比 auto-delete 安全。

### 跨平台路徑比對：統一 normalizeProjectPath，禁止無條件 casefold

所有專案路徑的 identity 比對統一走 `src/lib/utils/path.ts` 的 `normalizeProjectPath`，行為對齊後端 `known_projects::normalize_path`：反斜線→正斜線、去尾斜線、**僅在 Windows casefold**（case-insensitive FS），macOS / Linux 保留原大小寫。前端禁止對路徑無條件 `.toLowerCase()`。Windows 判定用 `navigator.userAgent`。

理由：桌面 app 同時 for Windows / macOS；前端若無條件 casefold 會與後端 platform-aware 正規化分歧，在 case-sensitive 卷宗誤判（「Windows 可、macOS 不可」）。此規則同步寫入 `openspec/config.yaml` 平台限制,約束未來所有 change。

## Implementation Contract

**Behavior（可觀察）**：

- AddTargetDialog 的 project 下拉中，所有 Known Projects 項目均可選（不再 disabled）。選中非當前 project 後加入 target，Push 將 rendered SKILL.md 寫入該 project 的 agent skill 目錄。
- AddTargetDialog 有「Browse...」按鈕，點擊開啟 OS folder dialog，選中後路徑寫入 L3 並出現在下拉。
- SkillsPage header 有 List / Summary toggle。Summary mode 顯示 skill × target grid，cell 為 sync state icon；Summary mode 不顯示 List mode 的 Sync info bar。
- target 的 destination project 資料夾不存在（刪除 / 改名 / 卸載）時，於 Reload / Skills 頁掛載 / 視窗 focus 重查時，Sync info bar、Coverage matrix 與 **TargetEditor 該 target row** 皆顯示 "project not found"；TargetEditor 的標示附恢復指引（還原資料夾，或刪除此 target 重新指向）。Push 跳過該 target。就地 repoint（改 target 路徑）屬恢復操作，留 (c) `skill-sync-lifecycle`。

**Interface / data shape**：

- 不新增 Rust command——`known_projects_list` 擴充回傳 `KnownProject.exists: bool`（`Path::exists()`），TS `KnownProject` type 同步加 `exists`；`known_projects_add`、`skill_sync_one` 不變。
- 前端新增 `src/lib/utils/path.ts`（`normalizeProjectPath`，跨平台路徑正規化，對齊後端）。
- 前端新增 `CoverageMatrix.tsx`（接收 `entries: SkillListEntry[]` + `knownProjectPaths`，從中提取 skill × target grid；grid 用 `min-w-full` + `minmax(80px,1fr)` 少欄填滿、多欄水平捲動）。
- `AddTargetDialog.tsx` 新增「Browse...」按鈕（`@tauri-apps/plugin-dialog` 的 `open({directory:true})`）+ `matchOption` 把 `selectedProject` 對正到清單精確 `p.path`（受控 select 才能正確顯示 / 比對）。
- `SkillsPage.tsx` 新增 `viewMode` state（`"list" | "summary"`）+ toggle UI；known-projects 重載拆獨立 effect（依賴 `entries` + window focus）以反映新加 project 與磁碟現況。
- `Cargo.toml` 加 `tauri-plugin-dialog`、`lib.rs` 註冊、`capabilities/default.json` 加 `dialog:default`。

**Failure modes**：

- Folder dialog 取消 → no-op，不寫 L3。
- `known_projects_add` 重複路徑 → idempotent，no error。
- Cross-project push 目標路徑不存在 → `resolve_pair` 回 Err → `SyncResult.success = false`，dirty 保留，Push bar 顯示。
- 目標 project 資料夾改名 / 刪除 → 下次 `known_projects_list` 重查時 `exists=false` → 顯示 "project not found"（非「Not synced」）。
- 已卸載網路磁碟 stat 可能延遲 → 跑在後端 command、前端 await，不凍 UI，僅延遲指示燈更新。
- Summary mode 無任何 skill → 顯示 empty state「No skills to display」。

**Acceptance criteria**：

- `npm run check` exit 0；`cargo build` 無新 warning。
- `cargo test` 不退化（baseline 61 tests + 新增 exists test）。
- 路徑比對全走 `normalizeProjectPath`，無無條件 `.toLowerCase()`；行為對齊後端 platform-aware 正規化。
- 手動 smoke：(a) AddTargetDialog 選非當前 project → Push 寫入該 project 的 agent dir；(b) Browse 開 folder dialog、選中後路徑出現在下拉並自動選中；(c) Summary mode 顯示 grid、cell 正確反映 sync state、不殘留 Sync info；(d) 改名 / 刪除目標 project 資料夾 → Reload 或切回視窗 → 顯示 "project not found"、push 跳過。
- `spectra validate` / `analyze` 無 Critical / Warning。

**Scope boundaries**：

- In scope：cross-project target 解鎖、manual path entry、coverage matrix view-mode、origin-project 降級（以 `Path::exists()` 偵測）、跨平台路徑正規化統一。
- Out of scope：push dry-run、drift check、cascade prompt、刪 target 即時刪檔提示、import 自動回填來源 target、forked overlay、matrix 虛擬滾動 / filter / sort（後三者與前兩者留 (c) / Phase 2）。

## Risks / Trade-offs

- [Cross-project push 寫入使用者未預期的目錄] → AddTargetDialog 顯式選擇 + Push 前 target list 可見，使用者有完整控制。目標目錄不存在時 push 失敗而非 mkdir -p（現有 `resolve_pair` + `prepare_skill_subdir` 行為）。
- [Tauri dialog plugin 增加 bundle size] → dialog plugin 是 Tauri 官方 plugin，體積小（~50KB），且未來其他功能（file import、export）也需要。
- [Coverage matrix 列數爆炸] → 初期 max ~6 columns（3 agents × 2 scopes）。跨 project target 多時列數增加，但本 change 的 CSS grid 足以處理 ~20 列。真正的 scale 問題留 Phase 2。
- [origin-project 消失的 passive degradation] → 使用者可能不注意到 "project not found" 標示。但 auto-disable / auto-delete 風險更高（使用者可能暫時 unmount）。保守策略優先。
