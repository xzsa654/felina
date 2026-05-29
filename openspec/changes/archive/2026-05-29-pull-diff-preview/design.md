## Context

目前的 pull 流程（`skill_pull_from_target`）直接用 target 端 SKILL.md body 覆蓋 canonical，使用者無法在覆蓋前看到差異。`local-versioning-and-snapshot-layer` 已完成，push 後 `base_snapshot` 會記錄 commit hash，`snapshot::get_snapshot_content` 可取回上次 push 時的 canonical 內容。

本 change 在 pull 前插入一個 diff preview 步驟：後端產出結構化 diff data，前端在 `PullConfirmDialog` 內渲染 inline diff，使用者看完後再決定是否執行覆蓋。

## Goals / Non-Goals

**Goals:**
- 提供後端 IPC `skill_pull_preview`，回傳 base / canonical / target 三份內容的行級 diff。
- 擴充前端 `PullConfirmDialog` 為 inline diff viewer。
- 支援 `base_snapshot` 為 `None` 的退化情境（two-way diff）。

**Non-Goals:**
- 不實作 3-way merge 自動合併（留待 `forked-target-overlay`）。
- 不實作 side-by-side diff viewer。
- 不改變 pull 的最終覆蓋行為。
- 不啟用 `TargetMode::Forked`。

## Decisions

### Diff 演算法選擇：行級文字 diff

使用 Rust `similar` crate 的 `TextDiff` 做行級 diff，產生 unified diff hunks。不使用 `git2::Merge::merge_file`，因為本 change 只需要顯示差異、不需要合併。`similar` 是純 Rust、零外部依賴、API 簡潔。

### Diff data 結構

後端回傳 `PullDiffPreview` struct，包含：
- `has_base: bool`（是否有 base snapshot，決定是 three-way 還是 two-way diff）
- `canonical_content: String`（現在的 canonical body）
- `target_content: String`（target 端 body）
- `base_content: Option<String>`（base snapshot body，可能為 None）
- `hunks: Vec<DiffHunk>`（結構化 diff hunks，每個 hunk 包含行號範圍 + 行內容 + change type）

前端直接渲染 `hunks`，不需要自己做 diff 計算。

### 前端渲染：inline unified diff

在 `PullConfirmDialog` 內以 monospace 字體渲染 diff hunks：
- 刪除行：`bg-danger-dim` 背景 + `-` 前綴
- 新增行：`bg-success-dim` 背景 + `+` 前綴
- 上下文行：無背景
- 無差異時顯示「內容相同」提示

Dialog 寬度從 `max-w-md` 擴大為 `max-w-2xl` 以容納 diff 內容，高度設 `max-h-[60vh]` 可捲動。

### Pull 流程改為兩步

1. 使用者點 Pull 按鈕 → 前端呼叫 `skill_pull_preview` → 等待 diff data
2. `PullConfirmDialog` 開啟並渲染 diff → 使用者按「確認 Pull」→ 呼叫既有 `skill_pull_from_target`

若 `skill_pull_preview` 失敗（如 target 檔案不存在），直接顯示錯誤、不開 dialog。

### base_snapshot 為 None 的退化

若 target 的 `base_snapshot` 為 `None`，後端跳過 base 讀取，回傳 `has_base: false`。前端照常顯示 canonical vs target 的 two-way diff，並在 dialog 頂部顯示提示「無基準版本，顯示完整差異」。

## Implementation Contract

- **Behavior**: 使用者點 Pull 按鈕後，先看到 canonical 與 target 之間的行級 diff，確認後才覆蓋。
- **Interface / data shape**:
  - `skill_pull_preview(canonical_id: String, target_key: String) -> Result<PullDiffPreview, String>`
  - `PullDiffPreview { has_base: bool, canonical_content: String, target_content: String, base_content: Option<String>, hunks: Vec<DiffHunk> }`
  - `DiffHunk { old_start: u32, old_count: u32, new_start: u32, new_count: u32, lines: Vec<DiffLine> }`
  - `DiffLine { kind: "context" | "add" | "delete", content: String }`
- **Failure modes**:
  - Target 檔案不存在 → `Err("cannot read target file ...")`，前端顯示 toast error。
  - `get_snapshot_content` 失敗或 `base_snapshot` 為 None → 退化為 two-way diff，不中斷。
- **Acceptance criteria**:
  - Pull 按鈕點擊後，`PullConfirmDialog` 顯示行級 diff。
  - 刪除行紅色背景、新增行綠色背景、上下文行無背景。
  - 確認後才執行覆蓋，取消則不改變任何檔案。
  - `base_snapshot` 為 None 時顯示 two-way diff + 提示文字。
  - `npm run check` 通過。
- **Scope boundaries**: 後端僅新增 preview IPC，不改變既有 `skill_pull_from_target` 的覆蓋邏輯。前端僅修改 `PullConfirmDialog` 和 `TargetEditor`（pull 觸發流程）。

## Risks / Trade-offs

- **[Risk] `similar` crate 新依賴**：純 Rust、無 C binding，編譯成本極低（< 1s），binary size 增加可忽略。
- **[Trade-off] Diff 只看 body 不看 frontmatter**：pull 時 canonical frontmatter 保留不動（既有行為），diff 只比較 body 部分。使用者看到的 diff 與實際寫入的內容一致。
- **[Risk] 大型 skill 的 diff 渲染效能**：skill 通常數百行以內，inline diff 不會有效能問題。若未來出現數千行的 skill，可加 hunk 折疊。
