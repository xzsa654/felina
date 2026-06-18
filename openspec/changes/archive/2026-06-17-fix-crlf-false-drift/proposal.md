## Why

Windows 環境下 git 的 `core.autocrlf` 設定會在 checkout 時將 LF 轉為 CRLF。Felina fan-out push 產出的檔案是 LF 行尾（Rust `format!` 預設），但 agent-side 檔案被 git 管理後可能變成 CRLF。目前 `semantic_hash` 的 `normalize_skill_content` 只做 `trim()` 不處理行內 `\r`，導致同一內容因行尾不同產生不同 hash，被誤判為 drift。使用者點擊 Pull 查看差異時，`similar::TextDiff::from_lines` 天然忽略 `\r`，顯示 0 hunks——形成「有 drift 但 diff 空白」的矛盾體驗。

`compute_sibling_hashes` 使用 raw bytes hash，同樣受 CRLF/LF 差異影響，對 sibling 文字檔（如 `agents/openai.yaml`）也會產生 false drift。

## What Changes

- `normalize_skill_content` 在處理前先統一行尾 `\r\n` → `\n`、`\r` → `\n`
- `collect_sibling_hashes` 對 UTF-8 可解析的文字檔在 hash 前統一行尾；binary 檔維持 raw bytes hash
- 新增對應的單元測試覆蓋 CRLF 場景

## Non-Goals

- 不修改 fan-out write 路徑（`write_skill_md`）的行尾行為——Rust `format!` 已產出 LF，問題源自 git checkout 後的轉換，不在 Felina 控制範圍內
- 不做 sync-meta `pushed_hash` migration——既有 hash 是從 LF 內容算出，修正後 agent-side CRLF 內容 normalize 回 LF 會得到相同 hash，無需 re-push
- 不處理 `build_diff_hunks` 的行尾——`TextDiff::from_lines` 已天然處理，無此問題

## Capabilities

### New Capabilities

（無）

### Modified Capabilities

- `semantic-hash`：normalize 流程新增行尾正規化步驟，確保 CRLF 與 LF 內容產生相同 hash
- `drift-detection`：sibling hash 比對加入行尾正規化，消除文字檔的 CRLF false drift

## Impact

- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`（`normalize_skill_content`、`collect_sibling_hashes`、新增 `normalize_line_endings` helper、新增測試）
  - New: 無
  - Removed: 無
- 無新增依賴（npm / Cargo）
- 無破壞性變更：normalize 是純加法，既有 LF-only 內容 hash 不受影響
- 無跨 change 依賴
