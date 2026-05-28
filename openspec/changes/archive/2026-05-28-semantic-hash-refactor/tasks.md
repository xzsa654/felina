<!--
Each task description MUST state:
- the behavior or contract being delivered (what is observably true when the
  task is complete), and
- the verification target that proves completion (test, CLI invocation,
  analyzer check, manual assertion, or content review).

File paths are supporting context for locating the work, never the task
itself. "Edit file X" is not a valid task — it is missing both behavior and
verification.
-->

## 1. 準備階段 (Preparation)

- [x] 1.1 執行 `cargo check --lib` 在 `src-tauri/` 確保現有專案可正常編譯，建立基準。

## 2. 實作 Semantic Hash (Implementation)

- [x] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs`（或獨立工具模組）中實作語意正規化函數。該函數必須解析 YAML frontmatter，將 keys 排序並重新序列化，再接上去除前後空白 (`trim`) 的 Body 內容，最後產生 SHA-256 Hash。驗證：撰寫 Rust 單元測試 (`#[test]`)，傳入格式不同但語意相同的字串，斷言產生的 Hash 必須一致 (Requirement: Semantic Normalization)。
- [x] 2.2 修改 `src-tauri/src/commands/fan_out/mod.rs`，將原本針對原始字串計算 SHA-256 的邏輯全部替換為新的 Semantic Hash 函數，並確保回傳型態一致。驗證：執行 `cargo check --lib` 確認所有函數呼叫皆符合型別與編譯要求。

## 3. 驗證與測試 (Verification)

- [x] 3.1 執行 `npm run tauri dev` 進行手動驗證。選擇一個帶有舊版 Raw Hash 的 target，確認系統在預覽 (Preview) 階段會因為 Lazy Migration 特性將其判定為 `BlockedDrift`。執行一次 Push 後，再次檢查該 target 狀態，確認其恢復為正常 Synced 且 metadata 中寫入新的 Semantic Hash 值 (Requirement: Lazy Migration of Legacy Hashes)。
