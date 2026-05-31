## Context

Canonical skill 的 identity key 是目錄名稱（`~/.felina/skills/<skill-name>/`）。目前沒有 rename 功能，使用者只能手動搬移。`snapshot.rs` 已透過 `git2` 管理 canonical storage 為 git repo，提供 `ensure_repo`、`commit_skill_changes` 等基礎設施。

## Goals / Non-Goals

**Goals:**

- 提供一個後端 command 完成 canonical skill rename 的完整流程
- 透過 git2 在 canonical repo 記錄 rename commit，保留版本歷史
- 清理所有 target 的舊 agent-side 目錄
- 前端 SkillEditor toolbar 提供 rename 入口

**Non-Goals:**

- 不在 agent-side 使用 git2（不碰使用者專案 repo 的 git 狀態）
- 不自動觸發 push（rename 後標記 dirty，由既有 push 機制處理）
- 不支援批次 rename

## Decisions

### 1. 後端 command 簽名

新增 `canonical_skill_rename(old_name: String, new_name: String) -> Result<RenameResult, String>`。

`RenameResult` 包含：
- `old_name: String`
- `new_name: String`
- `commit_hash: String`（git2 commit hash）
- `targets_cleaned: u32`（成功清除的舊 agent-side 目錄數）
- `targets_failed: Vec<String>`（清除失敗的路徑，非致命錯誤）

### 2. Rename 流程（在 `canonical_skills.rs` 實作）

依序執行，任一步驟失敗則整體 rollback：

1. **Validate**：新名稱不為空、不含 path traversal（`..`、`/`、`\`）、不與現有 skill 重名
2. **git2 index remove old**：透過 `snapshot::ensure_repo()` 取得 repo，遍歷 `old_name/` 下所有檔案，對每個呼叫 `index.remove_path(rel)`
3. **fs::rename**：將 `~/.felina/skills/old_name/` rename 為 `~/.felina/skills/new_name/`
4. **更新 frontmatter name**：讀取 `new_name/SKILL.md`，將 frontmatter 的 `name` 欄位更新為 `new_name`，寫回
5. **git2 index add new**：遍歷 `new_name/` 下所有檔案，對每個呼叫 `index.add_path(rel)`
6. **git2 commit**：commit message 為 `rename: old_name → new_name`
7. **清除 agent-side**：讀取 sync-meta 的 targets，對每個 target resolve 舊名稱的 agent-side 目錄路徑，執行 `fs::remove_dir_all`。失敗不中斷，記錄到 `targets_failed`
8. **更新 sync-meta**：設定 `dirty = true`，清除所有 `last_sync` entries

Rollback 策略：步驟 2-3 失敗時 fs::rename 回去；步驟 4-6 失敗時 fs::rename 回去並重建 git index。步驟 7-8 失敗為非致命（partial failure），不需 rollback canonical 端。

### 3. snapshot.rs 擴展

新增 `pub fn rename_skill(old_name: &str, new_name: &str) -> Result<String, String>` 封裝 git2 操作（index remove/add + commit），供 `canonical_skills.rs` 的 rename command 呼叫。此函式負責 git 層操作，不處理 frontmatter 更新或 agent-side 清理。

### 4. 前端 UI

- **RenameSkillDialog**：獨立元件，props 為 `open`、`currentName`、`onConfirm(newName)`、`onCancel`。包含文字輸入框與即時驗證（空值、與 currentName 相同、含非法字元）
- **SkillEditor toolbar**：在 Delete 按鈕左邊新增 Rename 按鈕（Lucide `Pencil` icon），僅在編輯既有 skill 時顯示（`!isNew`）
- **SkillsPage**：rename 成功後呼叫 `loadEntries()` 刷新列表，並將 selectedSkill 切換為新名稱

### 5. 前端 bridge

`commands.ts` 新增：
```
canonicalSkills.rename: (oldName, newName) => invoke("canonical_skill_rename", { oldName, newName })
```

## Implementation Contract

### Task scope: 後端 command（tasks 2.x）

- `canonical_skill_rename` 接受 `old_name` 和 `new_name`，回傳 `RenameResult`
- 新名稱驗證規則與 `canonical_skills_write` 的 `rejects_path_traversal_names` 一致
- Canonical 目錄實際被 rename，frontmatter name 被更新
- git2 commit 記錄 rename，commit message 包含新舊名稱
- 所有 target 的舊 agent-side 目錄被刪除（partial failure 不中斷）
- sync-meta dirty = true，last_sync 全部清除
- 驗證：`cargo test` 新增的 rename 相關測試全通過

### Task scope: snapshot.rs 擴展（tasks 3.x）

- `rename_skill` 封裝 git2 index remove + fs::rename + index add + commit
- 驗證：`cargo test` snapshot rename 測試通過

### Task scope: 前端 UI（tasks 4.x-5.x）

- Rename 按鈕出現在 SkillEditor toolbar，與 Delete/Save 同列
- RenameSkillDialog 提供輸入框和即時驗證
- rename 成功後列表刷新並選中新名稱
- 驗證：`npm run check` 通過，`npm run tauri dev` 手動驗證
