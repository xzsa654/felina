## Summary

將 Skill 同步比對的機制從 Raw Bytes SHA-256 升級為 Semantic Hash (語意 Hash)，以解決因 YAML 格式微小差異導致的大量誤報 Drift 問題。

## Motivation

目前 Push 與 Drift Detection 採用 Raw Bytes 的 `sha256_hex(file_content)`。這意味著如果 Frontmatter 的 key 順序不同、或是文末有額外的空白/換行，即使語意上完全相同，也會產生不同的 Hash。這會導致 Target 被系統頻繁誤報為 `BlockedDrift`，影響使用者體驗。我們需要在進階的 Drift Scan 實作之前優先切換至 Semantic Hash，以避免未來發生更大規模的狀態混亂，並降低重構與遷移成本。

## Proposed Solution

- 新增 Semantic Hash 函數：在計算 Hash 前，先解析 Frontmatter 並將其 keys 按照字母順序排序、去除多餘空白，最後結合經過 `trim()` 處理的 Body 再進行 SHA-256 運算。
- 取代舊有實作：將後端模組中依賴字串比對與 Hash 計算的部分（如 `fan_out/mod.rs`）切換為呼叫新的 Semantic Hash 函數。
- Lazy Migration：現存的 `.felina-sync-meta.json` 中紀錄的舊 Hash 不主動遷移。待上線後首次比對時將標記為 Drift，使用者重新執行一次 Push 即可自動覆寫並升級為新的 Hash 值。

## Capabilities

### New Capabilities

- `semantic-hash`: 定義 Skill 內容在比對狀態時，必須透過正規化流程（排序屬性、修剪空白）來產生語意一致性 Hash 的規則。

### Modified Capabilities

(none)

## Impact

- Affected specs: `semantic-hash`
- Affected code:
  - Modified: `src-tauri/src/commands/fan_out/mod.rs`
