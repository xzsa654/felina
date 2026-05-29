## Context

Felina 的 canonical skill 同步機制已有 `pushed_hash`（semantic SHA-256）做 drift detection，以及 `base_snapshot: Option<String>` 欄位預留。但 `base_snapshot` 目前全為 `None`，無法在 pull 前比對「上次 push 的 canonical 內容」與「當前 canonical」和「target 端內容」的差異。使用者執行 pull 時，`skill_pull_from_target` 直接覆蓋 canonical SKILL.md，沒有任何 diff preview。

本 change 引入 `git2` crate，將 `~/.felina/skills/` 初始化為隱藏的 Git repo，在 push 成功時自動 commit，讓 `base_snapshot` 儲存 commit hash，供 pull diff preview 和未來 3-way merge 使用。

## Goals / Non-Goals

**Goals:**
- 在 `~/.felina/skills/` 建立並維護單一隱藏 Git repo。
- 提供高階 API 封裝 `git2` 的 init / add / commit / read-blob 操作。
- Push 成功時自動 commit 並將 commit hash 寫入 `base_snapshot`。
- 提供 `get_snapshot_content(commit_hash, path)` API，讓 pull 流程可取回 base 內容做 diff。

**Non-Goals:**
- 不向前端暴露 Git 底層歷史、分支或操作介面。
- 不實作 3-way merge（留待 `forked-target-overlay`）。
- 不實作前端 diff viewer UI（本 change 僅提供後端 diff data，前端顯示可由 `PullConfirmDialog` 或後續 change 處理）。

## Decisions

- **單一全域 Repo**：在 `~/.felina/skills/` 初始化唯一一個 git repo。比為每個 skill 建立獨立 repo 簡單、I/O 更低。
- **`git2` crate（vendored）**：使用 `git2` 的 `vendored` feature，自帶 `libgit2` + `libssh2`，不依賴系統安裝的 Git。避免 Windows 上外部工具鏈問題。
- **Commit 粒度**：每次 push 成功後，針對該 skill 的檔案建立一次 commit。Commit message 格式 `push: <skill-name> → <target-key>`。
- **Snapshot 讀取 API**：`get_snapshot_content(commit_hash, relative_path) -> Option<String>` 從 git object store 讀回指定 commit 下的檔案內容，不需 checkout。Pull 流程用此 API 取回 base 內容。
- **失敗不中斷**：若 `git2` 操作失敗（權限、corrupt repo），記錄 warning log，`base_snapshot` 維持原值，push/pull 主流程不受影響。
- **Migration**：舊的 `base_snapshot: None` 不需轉換。下次 push 會自動寫入 commit hash。Pull 時若 `base_snapshot` 為 `None`，跳過 diff preview，行為與現在相同。

## Implementation Contract

- **Behavior**: 
  - Push 成功時，`snapshot.rs` 自動對該 skill 目錄下的檔案做 `git add` + `git commit`，將 40 碼 commit hash 寫入對應 target 的 `base_snapshot`。
  - Pull 時，若 `base_snapshot` 有值，後端可透過 `get_snapshot_content` 取回 base 內容，與現行 canonical 和 target 內容做 diff。
- **Interface / data shape**:
  - `snapshot::ensure_repo() -> Result<Repository, String>` — 確保 repo 存在，不存在則 init。
  - `snapshot::commit_skill_changes(skill_name: &str) -> Result<String, String>` — stage + commit，回傳 40 碼 hex hash。
  - `snapshot::get_snapshot_content(commit_hash: &str, relative_path: &str) -> Result<Option<String>, String>` — 從 git object store 讀指定 commit 下的檔案內容。
- **Failure modes**: `git2` 操作失敗時記錄 `tracing::warn!`，回傳 `Err`。呼叫端（push/pull）捕獲 `Err` 後繼續執行，不中斷主流程。
- **Acceptance criteria**:
  - 修改 Skill 並 Push 後，`.felina-sync-meta.json` 對應 target 的 `base_snapshot` 更新為 40 碼 commit hash。
  - `~/.felina/skills/.git` 存在且 `git log` 可見 commit 記錄。
  - `cargo test` 通過。
  - `git2` 操作失敗時，push 仍成功完成，`base_snapshot` 維持原值。
- **Scope boundaries**: 僅後端 Rust 資料儲存層（`snapshot.rs` + `fan_out/mod.rs`），不涉及前端介面改動。

## Risks / Trade-offs

- **[Risk] `git2` 編譯成本**：`git2` vendored 模式會編譯 `libgit2` C 原始碼，首次 cargo build 可能增加 30-60 秒。後續增量編譯不受影響。Binary size 增加約 2-3 MB。
- **[Trade-off] Repo 空間增長**：長期使用下 Git history 會累積。Skill 檔案為純文字，Git 壓縮效率高，預估數百個 skill 使用數年後仍在數十 MB 以內。必要時可跑 `git gc`。
- **[Risk] 使用者手動操作 `~/.felina/skills/`**：若使用者在該目錄自行 `git init` 或操作 Git，可能與 Felina 的隱藏 repo 衝突。Mitigation：`ensure_repo` 檢測到既有 repo 時直接複用，不覆蓋。
