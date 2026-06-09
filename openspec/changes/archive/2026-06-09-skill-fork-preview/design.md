## Context

Felina 的 canonical skill fan-out 目前支援 Auto/Manual/Detached 三種 target mode。TargetMode::Forked 與 LastSyncEntry.base_snapshot 已在 schema 中定義但標記為 Reserved for Phase 2。現行 push 邏輯已跳過 Forked target，pull 邏輯（skill_pull_preview、skill_pull_from_target）已使用 base_snapshot 做 3-way diff base。

前端 TargetPopover 是點擊 target chip 後的浮動面板（300-420px），包含 mode selector（auto/manual/disabled）、drift 警告、pull 按鈕、open folder、remove。PullConfirmDialog 已有 unified diff hunk 渲染元件。sync-status-utils.ts 定義 SyncStatus 與 isTargetDisabled，目前將 detached 視為 disabled 的同義。

此 change 屬 UI-related，驗收時須執行 /felina-ui-guidelines review。

此 change 涉及讀取使用者檔案系統（agent-side SKILL.md），標記為 security-sensitive，tasks 須包含 /spectra-audit 審查步驟。

## Goals / Non-Goals

**Goals:**

- 啟用 TargetMode::Forked，讓使用者可以將 target 從 Auto/Manual 切換為 Forked
- Fork 切換時自動記錄 base_snapshot，作為未來 3-way merge 的 common ancestor
- 提供後端 command 讀取 forked target 的 agent-side SKILL.md 內容
- 提供後端 command 計算 canonical vs forked 的 unified diff
- 在 TargetPopover 加入 Preview Fork 按鈕，開啟 ForkPreviewDialog modal
- 擴充 target chip 狀態，區分 forked-clean / forked-edited / canonical-ahead / diverged
- 從 Forked 切回 Auto/Manual 時顯示 destructive confirmation

**Non-Goals:**

- 3-way merge UI / merge back to canonical（Phase 2）
- Side-by-side diff view（Phase 2）
- Sibling files 的 fork 追蹤（Phase 2）
- Fork 層級的 conflict resolution
- Forked target 的自動 drift scan 排程（現有 drift scan 已跳過 Forked，本 change 改為分類但不觸發 pull）

## Decisions

### **Fork 切換寫入 base_snapshot**

當 target mode 從 Auto/Manual 切換為 Forked 時，後端在 skill_targets_set 內計算當下 canonical SKILL.md 的 SHA-256 並寫入該 target 的 last_sync[target_key].base_snapshot。如果該 target 尚無 last_sync entry（從未 push 過），則建立一個 entry，pushed_hash 設為當下 canonical 的 hash，at 設為當下時間。

替代方案：在 ForkPreviewDialog 開啟時才計算 — 但 base_snapshot 的語意是 fork 分叉點，應在切換瞬間固定。

### **新增 skill_fork_read_agent_content command**

在 fan_out/mod.rs 新增 tauri::command skill_fork_read_agent_content(canonical_id: String, target_key: String) -> Result<ForkAgentContent, String>。回傳結構 ForkAgentContent { body: String, raw: String } — body 是去除 frontmatter 的 Markdown body，raw 是完整檔案內容（含 frontmatter）。

此 command 僅在 target mode 為 Forked 時可用，其他 mode 回傳 error。讀取路徑透過現有 resolve_pair + pair_for 解析，與 skill_pull_preview 一致。

### **新增 skill_fork_diff_preview command**

在 fan_out/mod.rs 新增 tauri::command skill_fork_diff_preview(canonical_id: String, target_key: String) -> Result<ForkDiffPreview, String>。

回傳結構 ForkDiffPreview：canonical_body（String）、forked_body（String）、base_body（Option String）、has_base（bool）、hunks（Vec DiffHunk）、fork_status（ForkStatus enum）。

ForkStatus 是 enum：Clean / Edited / CanonicalAhead / Diverged。判定邏輯：
- Clean: canonical hash == base_snapshot AND forked hash == pushed_hash
- Edited: canonical hash == base_snapshot AND forked hash != pushed_hash
- CanonicalAhead: canonical hash != base_snapshot AND forked hash == pushed_hash
- Diverged: canonical hash != base_snapshot AND forked hash != pushed_hash

Diff 計算複用現有 build_diff_hunks，old 為 canonical body，new 為 forked body。

### **前端 mode selector 加入 Forked 選項**

TargetPopover 的 UIState type 從 auto/manual/disabled 擴充為 auto/manual/disabled/forked。toUIState 新增 mode === forked 判定。applyUIState 的 forked case 設定 enabled: true, mode: forked。

切換為 Forked 時不需額外 UI confirmation（fork 是非破壞性的）。從 Forked 切回 Auto/Manual 時，顯示 confirmation dialog 警告下次 push 會以 canonical 內容覆寫 agent-side 修改。

### **Preview Fork 按鈕入口**

在 TargetPopover 的 drift/status 區塊，當 target.mode === forked 時顯示 Preview Fork 按鈕（與現有 Pull 按鈕同級位置）。點擊後呼叫 skill_fork_diff_preview，取得資料後開啟 ForkPreviewDialog。

### **ForkPreviewDialog modal 設計**

新增 src/lib/components/skills/ForkPreviewDialog.tsx，使用現有 Modal 元件（size lg）。

結構：
1. Header：skill name + target key + fork status badge
2. Tab bar：Preview（MarkdownPreview 渲染 forked body）/ Raw（monospace 原始內容）/ Diff（unified diff hunks）
3. Diff tab 複用 PullConfirmDialog 的 hunk line 渲染邏輯（提取為共用元件或直接 inline）
4. 無 base_snapshot 時 diff tab 顯示提示：無法判定 fork 分叉點，顯示 canonical vs forked 全文 diff
5. Footer：Close 按鈕；不包含 merge 操作（Phase 2）

### **Target chip fork 狀態擴充**

sync-status-utils.ts：
- SyncStatus 新增 forked-clean / forked-edited / forked-ahead / forked-diverged
- isTargetDisabled 不變（Forked 是 enabled 狀態）
- classifyTarget 新增 forked 判定：當 tgt.mode === forked 時，根據後端回傳的 ForkStatus 對應到 chip 狀態
- STATUS_CONFIG 新增四種 forked 狀態的 icon 與 chipClass，使用語意色：
  - forked-clean: ⑂ + info 色（text-info border-info/30 bg-info/5）
  - forked-edited: ⑂Δ + info 色
  - forked-ahead: ⑂⚠ + warning 色
  - forked-diverged: ⑂⚠ + warning 色（較深）

Fork 狀態的判定需要 base_snapshot 和 pushed_hash，這些資訊已透過 lastSync prop 傳入 chip 元件。Canonical hash 需要從 CanonicalSkill 或新增欄位取得 — 在 list_canonical_skills 回傳時一併計算 canonical SKILL.md 的 SHA-256 並放入 CanonicalSkill 結構。

### **i18n keys**

在 skills namespace 下新增：
- skills.fork.previewButton — Preview Fork 按鈕文字
- skills.fork.dialogTitle — ForkPreviewDialog 標題
- skills.fork.tabPreview / tabRaw / tabDiff — tab 標籤
- skills.fork.noBase — 無 base_snapshot 提示
- skills.fork.statusClean / statusEdited / statusAhead / statusDiverged — 狀態文字
- skills.fork.unforkConfirmTitle / unforkConfirmBody — 從 Forked 切回的 confirmation
- skills.targets.forked — mode selector 選項文字

## Implementation Contract

**行為：**
- 使用者在 TargetPopover 的 mode selector 選擇 Forked 後，該 target 的 .felina-sync-meta.json 寫入 mode: forked 並記錄 base_snapshot。後續 push 操作跳過此 target（現有行為不變）。
- 使用者點擊 Preview Fork 按鈕後，開啟 modal 可看到 agent-side 的 Markdown 內容渲染、原始內容、與 canonical 的 unified diff。
- Target chip 根據 base_snapshot、pushed_hash、canonical hash 顯示四種 fork 子狀態之一。

**IPC 介面：**
- skill_fork_read_agent_content(canonical_id: String, target_key: String) -> Result<ForkAgentContent, String>
  - ForkAgentContent: body（String）、raw（String）
- skill_fork_diff_preview(canonical_id: String, target_key: String) -> Result<ForkDiffPreview, String>
  - ForkDiffPreview: canonical_body（String）、forked_body（String）、base_body（Option String）、has_base（bool）、hunks（Vec DiffHunk）、fork_status（ForkStatus）
  - ForkStatus: clean / edited / canonicalAhead / diverged（serde rename_all camelCase）

**失敗模式：**
- Target mode 非 Forked 時呼叫上述 command 回傳 Err: target is not in forked mode
- Agent-side SKILL.md 不存在回傳 Err: agent-side file not found: {path}
- base_snapshot 缺失時 has_base: false，diff 降級為 canonical vs forked two-way diff

**驗收條件：**
- npm run check 通過
- cargo test --lib 通過（新增 fork 相關單元測試）
- 手動驗證：在 npm run tauri dev 中建立一個 skill + project target，切換為 Forked，在 agent-side 修改 SKILL.md，Preview Fork 可看到修改內容與 diff，切回 Auto 時顯示 confirmation
- /felina-ui-guidelines review 通過
- /spectra-audit 無 critical finding

**範圍邊界：**
- In scope: fork 切換、base_snapshot 記錄、agent-side 內容讀取、fork diff、fork 狀態 chip、ForkPreviewDialog、unfork confirmation
- Out of scope: merge back、3-way conflict resolution、sibling fork、side-by-side diff

## Risks / Trade-offs

- [Risk] Canonical hash 計算效能 — list_canonical_skills 每次列舉時計算所有 skill 的 SHA-256 可能增加啟動延遲。Mitigation: 只在有 forked target 的 skill 才計算（掃描 targets 判定）；或改為 lazy 計算（chip 渲染時才觸發後端查詢）
- [Risk] Drift scan regression — 修改 classifyTarget 邏輯可能影響現有 Auto/Manual target 的狀態判定。Mitigation: forked 判定是獨立的 early return，不影響後續 Auto/Manual 路徑；新增測試覆蓋
- [Risk] 檔案系統讀取安全 — skill_fork_read_agent_content 讀取 agent-side 路徑，需確保路徑解析不會 escape 到預期目錄之外。Mitigation: 路徑透過 resolve_pair 解析（與現有 push/pull 一致），不接受任意路徑輸入
