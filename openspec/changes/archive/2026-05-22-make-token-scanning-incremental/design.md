## Context

目前 token 掃描層已經有 `AgentParser`、`ParserRegistry`、`TokenScanner`、SQLite `token_events` 與 `refresh_token_data`。實作雖然使用 `INSERT OR IGNORE` 防止重複，但掃描範圍固定取每個資料目錄最近 50 個檔案，沒有保存每個 agent 的掃描 cursor，也沒有把檔案層級錯誤回傳給前端。

## Goals / Non-Goals

**Goals:**

- 為每個 agent 與資料來源保存可持久化 scan cursor，讓 refresh 能從上次成功位置繼續。
- 讓 refresh 結果包含 scanned agents、skipped sources、parsed files、failed files、inserted events 與 parse errors。
- 保留 SQLite unique constraint 作為最後防線，但讓掃描策略本身具備防遺漏能力。
- 在不改變費用公式的前提下，提高 token ingestion 的可預期性。

**Non-Goals:**

- 不修改 pricing、cache savings 或 reasoning token 計價。
- 不新增 Cursor、Windsurf 或其他 agent parser。
- 不重建既有資料庫內容；既有 `token_events` 只作為目前已收集資料使用。

## Decisions

### Persist per-agent scan cursors

新增 scan state 儲存，記錄 agent、source path、last successful mtime、last successful scan timestamp、last error summary。這比只依賴 SQLite 去重更能表達「哪些檔案已經安全處理」。替代方案是繼續掃最近 50 個檔案，但它無法保證大量活躍檔案或舊檔追加內容時不遺漏。

### Use file mtime and source identity as scan boundaries

掃描器以檔案路徑與 mtime 判斷是否需要處理，mtime 大於 cursor 的檔案必須被掃描；mtime 等於 cursor 但 source 未記錄成功時也必須被掃描。替代方案是對所有檔案建立內容 hash，但初次掃描成本較高，且本階段主要要消除固定 50 檔限制。

### Surface refresh errors without failing the whole scan

單一檔案 parse 失敗時，refresh 結果必須包含該檔案的 agent、path 類型、錯誤訊息與是否影響 cursor。其他 agent 與檔案仍可完成。替代方案是第一個錯誤即中止，這會讓一個壞檔阻止所有 agent 更新。

### Keep duplicate prevention in SQLite

`token_events` 的 unique constraint 繼續保留，因為 parser 可能產生重複事件或使用者可能手動重掃資料來源。增量 cursor 是掃描效率與完整性的主要控制，SQLite 去重是資料一致性的防線。

## Audit Discussion Outcome

**Decision:** 目前實作不能視為完成；cursor、scan state error propagation、refresh coverage 與 status contract 必須先修正後才能 archive。

**Rationale:** 此 change 的核心價值是防遺漏與可觀測性。若 parse failure 之後 cursor 仍前進、scan state 寫入錯誤被吞掉，或 refresh 回傳硬寫的 coverage，使用者會得到「掃描成功」的錯覺，但實際資料可能已遺漏。

**Interface depth check:**

- Seam location: scan cursor contract 屬於 `src-tauri/src/tokens/scanner.rs` 與 `src-tauri/src/tokens/scan_state.rs`，refresh response contract 屬於 `src-tauri/src/commands/tokens.rs` / `src-tauri/src/tokens/aggregator.rs` 與 `src/lib/types/token-analytics.ts`。
- Adapter count: refresh path 應只有 scanner -> storage/scan_state -> command response 這一條 contract，不應在 command 與 aggregator 各自硬寫同一份 coverage 數字。
- Depth: `scan_state` 不是單純 pass-through；它必須明確區分 successful cursor advance、last scan attempt、last error summary 與 storage failure。
- Deletion test: 若刪除 `scan_state`，incremental scan 會退回 full/recent-file scan 或只能依賴 SQLite 去重，會破壞本 change 的防遺漏目標。

### Do not advance cursor past failed files

cursor 只能代表「該 agent/source path 下，mtime 小於或等於 cursor 的檔案都已成功處理或可安全跳過」。如果某個較舊檔案 parse 失敗，即使較新檔案成功，cursor 也不得前進到會讓失敗檔案在下一次 refresh 被跳過的位置。可接受的實作包括：只前進到第一個失敗檔案之前的最大 successful mtime、保存 per-file failure state，或對含錯誤的 source 不前進 cursor。

### Fail loudly on scan state storage errors

scan state 讀寫錯誤是 refresh contract 的系統錯誤，不是 parse error。讀 cursor 失敗、寫 cursor 失敗、寫 last error 失敗都必須讓 refresh 回傳錯誤，不能被轉成 `None` 或用 `let _ = ...` 靜默忽略。

### Report actual scan coverage

`agents_scanned` 必須反映實際被掃描的 available parser 數量，不得硬寫目前 registry 中的 agent 總數。若 agent 不可用或資料來源不存在，response 應透過 scanned/skipped coverage 表達真實結果。

### Keep status fields semantically aligned

`AgentStatus.last_scanned` 應代表 scan state 的 last scan timestamp，而不是 `token_events.timestamp` 的最大事件時間。若 UI 要顯示最後錯誤摘要，Rust 與 TypeScript 型別也必須暴露對應欄位，避免前端只能顯示最近一次 refresh response 而無法反映 persisted status。

## Implementation Contract

`refresh_token_data` 完成後，呼叫者能觀察到下列行為：每個 available agent 都會依 scan cursor 處理所有新增或更新過的資料檔；固定最近 50 個檔案的限制不再決定資料完整性；parse 錯誤會被收集到 refresh response，且不會讓其他 agent 的掃描結果消失。

資料形狀上，Rust 與 TypeScript 的 `RefreshResult` 必須包含 agents scanned、files scanned、files skipped、events parsed、events inserted、errors。`AgentStatus` 必須能反映 last scanned timestamp 與 event count；若有最後錯誤，UI 可顯示簡短狀態而不需要讀取 log。

失敗模式上，scan state 寫入失敗必須讓 refresh 回傳錯誤；單檔 parse 失敗必須列入 errors 並繼續處理其他檔案；缺少資料目錄仍是正常 skipped source。

驗收標準是：新增或修改測試可建立多個假資料檔，先掃描一次後只修改一個舊檔，再次 refresh 必須處理該舊檔；超過 50 個檔案時，新舊檔案不因排序截斷而遺漏；壞檔錯誤出現在 `RefreshResult.errors`。

## Risks / Trade-offs

- [Risk] mtime 精度在不同檔案系統上可能不足 → Mitigation: cursor 同時保存 source path 與成功狀態，mtime 相同但未成功的來源仍會被掃描。
- [Risk] scan state schema 需要 migration → Mitigation: 新增獨立 table，缺表時建立，不變更 `token_events` 既有欄位語意。
- [Risk] refresh response 欄位增加會影響前端型別 → Mitigation: 同步更新 TypeScript 型別並保持既有欄位相容。
