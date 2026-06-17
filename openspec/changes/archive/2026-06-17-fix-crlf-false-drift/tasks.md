## 1. Baseline

- [x] 1.1 執行 `cargo test --lib` 於 `src-tauri/`，記錄現有測試結果作為 baseline。驗證：測試全數通過，無 pre-existing failure

## 2. 核心實作

- [x] [P] 2.1 在 `src-tauri/src/commands/fan_out/mod.rs` 新增 `normalize_line_endings` helper function，將 `\r\n` 和獨立 `\r` 替換為 `\n`。對應 spec「Semantic Normalization」的行尾正規化步驟。驗證：函式存在且 `cargo check` 通過（在 `src-tauri/` 下執行）
- [x] [P] 2.2 修改 `normalize_skill_content` 使其在處理前先呼叫 `normalize_line_endings`，確保 CRLF 與 LF 內容產生相同 semantic hash。對應 spec「Semantic Normalization」scenario「CRLF and LF produce identical hash」。驗證：新增單元測試 `test_semantic_hash_crlf_vs_lf`，斷言 CRLF 和 LF 版本的 SKILL.md 內容產生相同 `semantic_hash` 輸出
- [x] [P] 2.3 修改 `collect_sibling_hashes` 使其對 UTF-8 可解析的檔案先 normalize 行尾再 hash，binary 檔維持 raw bytes。對應 spec「Sibling Hash Line Ending Normalization」。驗證：新增單元測試 `test_sibling_hash_crlf_normalization`，斷言文字 sibling 的 CRLF/LF 版本產生相同 hash，以及 binary 內容保持 raw hash

## 3. 驗證

- [x] 3.1 執行 `cargo test --lib` 於 `src-tauri/`，確認所有既有測試 + 新增測試全數通過，無 regression。驗證：exit code 0，無 failure
- [x] 3.2 執行 `cargo build` 於 `src-tauri/`，確認編譯通過。驗證：exit code 0
