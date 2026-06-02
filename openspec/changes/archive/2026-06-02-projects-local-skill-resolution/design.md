## Context

Projects inventory 衝突 row 目前只能在「同一個 skill」假設下動作（Link / Overwrite）。當 project 磁碟那份其實是不同 skill 只是同名時，沒有 rename 路徑；當 Felina 全域已備援（`canonicalGlobalOnly`）使用者想清理 project 冗餘副本時，沒有 discard 路徑。Multi-source 情境（同名 skill 在多個 agent 目錄都掃到）目前只在 canonical 不存在時允許處理；canonical 存在時連 Overwrite 都不顯示。

Link 與 Overwrite 兩條路徑在「寫入方向」上相反：Link 是 Felina 主檔覆寫 project local（Felina 是 incoming），Overwrite 是 project local 覆寫 Felina 主檔（project 是 incoming）。現行 Link dialog 的 diff 把 canonical 當 old、source 當 new，render 出來等同「project 是 incoming」— 與語意相反。

本 change 把這些路徑收進單一「處理同名 dialog」入口，補齊 Rename / Discard，並對齊 Multi-source 行為與 diff 方向。

## Goals / Non-Goals

**Goals:**

- 衝突 row 的解析路徑收斂到單一入口 dialog，動態依 relationship 顯示可用選項。
- 新增 Rename project-local：folder + frontmatter 同步改名，duplicate / traversal 防護。
- 新增 Discard project-local：刪 folder，canonical 不動；只在 `canonicalGlobalOnly` 顯示。
- Multi-source + canonical 存在情境補上 Overwrite，與 Multi-source + localOnly 流程對稱。
- 後端 hunks 方向中性化，前端 Link / Overwrite dialog 各自決定 base / incoming 視角。
- Overwrite confirm 也顯示 inline hunks。

**Non-Goals:**

- 不處理「已 Link row 想從 project 移除」的流程；屬另一條獨立路徑，不混入「同名衝突」入口。
- 不改 canonical sync-meta schema 與 `.agents/skills` shared-directory invariant。
- 不改後端 import attribution side effects。
- 不新增第三方依賴。
- 不改 i18n key 名（key rename 屬獨立工程）。
- 不 rename canonical 主檔（既有 `canonical_skill_rename` 不變）。

## Decisions

### Single-entry dialog, options vary by relationship

Row 主按鈕（取代現行 Link / Overwrite 雙按鈕）統一改為「選擇處理方式…」，點開「處理同名 dialog」。Dialog 內顯示的選項依 row 的 `relationship`：

- `canonicalGlobalOnly`：Link / Overwrite / Rename / Discard
- `canonicalExistsUnlinked`：Link / Overwrite / Rename

Discard 在 `canonicalExistsUnlinked` 不顯示，因為該情境 canonical 沒有 global target（使用者層 agent 目錄沒備援），Discard 後 Claude 在此 project 完全失去此 skill — 沒有安全的 fallback。剔除 destructive 變體後，Discard 永遠是「安全的」（global fallback 保底），不需 destructive 樣式或雙模式分支。

替代方案是 row 上保留 Link / Overwrite 兩按鈕 + secondary menu 收 rename / discard。拒絕原因：兩種 relationship 選項數量不同（4 vs 3），`canonicalExistsUnlinked` 的 menu 只有單條 Rename，做成 menu 浪費；單一入口 dialog 隨 relationship 動態變內容更乾淨。

### Diff direction neutralized at backend, flipped at frontend

後端 `ConflictInfo.hunks` 固定 old=project source / new=canonical（語意中性，純粹兩個檔案的行級比對）。前端依 dialog 語境決定 base / incoming：

- **Link dialog**：base = 本專案、incoming = Felina 主檔。Render 時把後端的 add / delete 對調顯示（後端 add = canonical 多出來的，從 Link 視角看就是 incoming）。
- **Overwrite dialog**：base = Felina 主檔、incoming = 本專案。Render 時依後端 add / delete 原方向顯示。

Legend 文字也對應切換。此設計避免後端為兩個 dialog 各算一次 hunks，前端只是反轉視覺呈現。

### Rename project-local — folder + frontmatter, duplicate / traversal guard

新增 `project_local_skill_rename(project_path, agent, old_name, new_name)` Tauri command：

- Folder rename：將 project 端對應 agent 目錄下的 `old_name` directory 改名為 `new_name`。
- SKILL.md frontmatter `name` 欄位同步更新為 new_name。
- 拒絕條件：new_name 為空、含 path traversal 字元、new_name directory 已存在於同一 agent 目錄。
- 不寫 canonical、不寫 sync-meta（此 skill 不在 canonical 管轄）。

`.agents/skills` 共用目錄（Codex + Gemini）改名等同兩 agent 同時失去 old_name / 新增 new_name。UI 在 Rename dialog 顯示「此操作將同時影響 Codex 與 Gemini」警告，但不強制阻擋。

### Discard project-local — folder delete, canonical untouched

新增 `project_local_skill_delete(project_path, agent, skill_name)` Tauri command：

- 刪 project 端對應 agent 目錄下的 skill_name directory（整個 folder）。
- Path traversal 防護：skill_name 不得含 traversal 字元。
- 不動 canonical、不動 sync-meta。
- `.agents/skills` 共用情境刪除等同 Codex + Gemini 都失去，UI confirm 文案明示。

### Multi-source Overwrite uses existing drawer

Row 在 `relationship ∈ {canonicalGlobalOnly, canonicalExistsUnlinked}` 且 `deferred` 為 true 時，處理同名 dialog 內的 Overwrite 按鈕點下後：

- 開既有 multi-source drawer 選 attribution（與 Multi-source + localOnly Import 同流程）。
- 選定 source 後跳既有 Overwrite confirm（含 hunks，方向：Felina base / 本專案 incoming）。
- Confirm 後 apply `OverwriteCanonical` resolution，candidate 帶選定 source index。

Drawer 維持單一職責（只選 source）。Link 流程同樣處理 multi-source：dialog 內 Link 按鈕點下後也走 drawer → 既有 Link confirm。Rename / Discard 不走 drawer，因為是檔案級操作；但對 `.agents/skills` 共用目錄要顯示 attribution 警告。

### Overwrite confirm dialog gains hunks

現行 Overwrite confirm dialog 只有文字 message。改為與 Link confirm 同款的 inline diff 區塊，方向 Felina base / 本專案 incoming，使用同一份後端 hunks 資料反轉 render。

`importConflictDialog.message`（覆寫文字訊息）保留作為標題下方說明，hunks 區塊接在後面。

## Implementation Contract

**Behavior:**

- 衝突 row 主按鈕 SHALL 統一為「選擇處理方式…」，點擊後 SHALL 開啟處理同名 dialog。
- 處理同名 dialog 內可用路徑 SHALL 依 row.relationship 決定：`canonicalGlobalOnly` 顯示 Link / Overwrite / Rename / Discard；`canonicalExistsUnlinked` 顯示 Link / Overwrite / Rename。
- Rename 操作 SHALL 同步更新 folder 名稱與 SKILL.md frontmatter name；duplicate name 或 path traversal SHALL 被 reject 且不修改任何檔案。
- Discard 操作 SHALL 刪除 project 端對應 agent 目錄下整個 skill directory；canonical 與 sync-meta SHALL 不變。
- Multi-source row 在處理同名 dialog 內點 Link / Overwrite SHALL 先開既有 multi-source drawer 選 source，再走對應 confirm。
- Overwrite confirm dialog SHALL 顯示 inline hunks，方向為 Felina 主檔 base / 本專案 incoming。
- Link confirm dialog SHALL 顯示 inline hunks，方向為 本專案 base / Felina 主檔 incoming（與後端 hunks 原方向反轉 render）。
- 後端 `ConflictInfo.hunks` SHALL 為固定方向 old=project source / new=canonical，與 dialog 語境解耦。

**Interface / data shape:**

- 新 Tauri command 簽章：
  - `project_local_skill_rename(projectPath: String, agent: AgentId, oldName: String, newName: String) -> Result<(), String>`
  - `project_local_skill_delete(projectPath: String, agent: AgentId, skillName: String) -> Result<(), String>`
- 前端 `api.projectLocalSkills.rename` 與 `api.projectLocalSkills.delete` wrapper 加入 src/lib/tauri/commands.ts。
- `ConflictInfo` schema 不變；hunks 欄位方向定義變更（藉 design 與 i18n legend 雙重宣告，避免使用者誤判方向）。
- `InventoryRow` 與 `buildInventoryRows` 不需新增欄位；relationship 與 deferred 已足以推導 dialog 內容。

**Failure modes:**

- Rename：new_name 為空 / 含 traversal 字元 / directory 已存在 → 回 Err；UI 顯示 inline error，不修改檔案。
- Rename：folder rename 成功但 frontmatter 寫入失敗 → 回 Err 並嘗試 rollback folder（best-effort）；UI 顯示錯誤、提示使用者驗證 disk 狀態。
- Discard：directory 不存在（race condition）→ 回 Ok（idempotent）；UI reload inventory。
- Discard：權限不足無法刪除 → 回 Err；UI 顯示錯誤、不變 row 狀態。
- Multi-source Overwrite：選定 source 後 canonical 已被外部刪除 → 回 Err；UI 顯示「Felina 主檔已不存在」與既有 `canonicalMissing` 文案一致；reload inventory。
- 處理同名 dialog 在 row 的 candidate 為 null 或 canonical 不存在時 → dialog 不開啟（按鈕應已 disabled），如意外觸發則 silently no-op + 寫入 console warning。

**Acceptance criteria:**

- `npm run check` 無新增 TypeScript error（≤ baseline）。
- `cargo check` 通過；新增單元測試覆蓋 rename / delete 的 happy path 與 traversal / duplicate / missing folder 邊界。
- 新增 frontend 純函式測試覆蓋處理同名 dialog 的選項推導（per relationship）與 multi-source 路由（rename / discard 不走 drawer，link / overwrite 走 drawer）。
- 手動驗證六情境：
  - (a) `canonicalGlobalOnly` row 開 dialog 顯示四選項。
  - (b) `canonicalExistsUnlinked` row 開 dialog 顯示三選項（無 Discard）。
  - (c) Rename single-source 成功，row 從 inventory 消失（已改名）。
  - (d) Discard 成功後 row 從 inventory 消失，canonical 不動。
  - (e) Multi-source row 的 Link / Overwrite 都先走 drawer。
  - (f) Link / Overwrite dialog 的 hunks 方向與 legend 一致（Link 顯示 Felina incoming，Overwrite 顯示 Felina base）。

**Scope boundaries:**

- In scope：Projects inventory 衝突 row 主按鈕、處理同名 dialog、Rename / Discard UI 與後端 command、Multi-source Overwrite 路由、diff 方向中性化、Overwrite hunks 顯示、相關 i18n（en / zh-TW）、frontend / backend 單元測試。
- Out of scope：已 Link row 的移除流程、canonical rename、sync-meta schema、agent path 設定、`importToGlobal` 等 i18n key 正名、staging area（`inline-conflict-resolution`）相關 UI。

## Risks / Trade-offs

- [Risk] 處理同名 dialog 替換 row 上兩個按鈕，常用 Link / Overwrite 都多一次點擊 → Mitigation: 衝突情境本就需要 user 思考，多一次點擊換來四條路徑語意一致；高頻 import / push 動作不受影響。
- [Risk] Diff 方向反轉只在前端做 → Mitigation: legend 文字與 add / delete 顏色由 dialog 元件統一控制，後端資料保持中性；單一資料源避免兩邊算 hunks 不一致。
- [Risk] Rename folder 成功但 frontmatter 寫入失敗 → Mitigation: best-effort rollback + 錯誤回報；前端不假設成功，reload inventory 後以實際 disk 狀態為準。
- [Risk] `.agents/skills` 共用目錄 rename / discard 同時影響 Codex + Gemini → Mitigation: dialog 顯式警告「此操作將同時影響 Codex 與 Gemini」，但不強制阻擋（user 多半理解 shared invariant，強制阻擋會反過來礙事）。
- [Risk] Discard 在 `canonicalExistsUnlinked` 沒有 fallback 但 user 可能直覺以為 Felina 會接手 → Mitigation: dialog 內根本不顯示 Discard 選項，從 UI 層消除踩雷路徑。
