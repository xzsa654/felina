## Context

Felina 的 canonical skill store 採用 single-global-by-name flat namespace（`~/.felina/skills/<name>/`）。`skill_import_scan` 掃描各 agent-native directory 後，`group_by_name` 會把同名 skill 收攏：單一來源正常匯入，多來源（同名出現在 2+ agent directory）則標記 `deferred`，wizard 灰掉不允許匯入。現行 `ImportResolution` 有四種：`KeepCanonical`、`OverwriteCanonical`、`Skip`、`Rename`。其中 KeepCanonical 與 Skip 行為完全相同（都是 no-op），語意冗餘。

本 change 的前提決策：2026-05-25 discuss 定案維持 flat namespace，碰撞在 import 時由使用者選擇一個來源當 canonical 內容，其餘來源建立 disabled target。

相關 KB：`kb-ui-consistency-design` 要求確認流程走 shared ConfirmDialog，不用 browser-native confirm；`kb-frontend-identity-migration-display-vs-storage` 提醒 identity key 變更時 storage 先行、display 後行。

## Goals / Non-Goals

**Goals:**

- 解除 `deferred` multi-source 封鎖：多來源同名 skill 可匯入，使用者在 wizard 選擇一個來源當 canonical 內容。
- 未選中來源自動建立 disabled target，保留 Felina 對該 agent-side skill file 的 awareness。
- Import wizard 提供多來源 diff 預覽，使用者做選擇前能比較各來源的內容差異。
- Disabled target 提供查看 agent 端現有 SKILL.md 內容的入口。
- 釐清 KeepCanonical 與 Skip 的冗餘語意。

**Non-Goals:**

- 不引入 project namespace（`~/.felina/skills/<project-hash>/<name>/`）。
- 不改變 canonical identity key（維持 directory name）。
- 不實作 forked overlay、three-way merge、或 agent-side 內容反向匯入 canonical。
- 不處理 marketplace / versioning identity 擴展。
- 不改變非碰撞情境（單一來源無衝突）的 import 流程。
- 不重新設計 import wizard 的整體 UX（僅擴展 multi-source 選擇與 diff 預覽）。

## Decisions

### **Multi-source import unlocks with source selection**

現行 `group_by_name` 對多來源同名 skill 產生一個 `deferred` row，wizard 灰掉無法操作。本 change 保留 grouping 邏輯但移除 deferred 封鎖：wizard 改為讓使用者展開 grouped row、預覽各來源內容差異、選定一個來源當 canonical 寫入。

Backend 變更：`ImportCandidate` 的 `deferred` 欄位保留（用於 UI 判斷是否為 multi-source row），但 `skill_import_apply` 不再 skip deferred candidates。新增 `ImportResolution::SelectSource { source_index: usize, new_name: Option<String> }` variant，apply 時從 grouped candidates 中取指定 index 的來源寫入 canonical。當 canonical 已有同名 skill 時，wizard 不能因為使用者選了來源就直接覆蓋；仍必須讓使用者明確選 Skip / OverwriteCanonical / Rename。Rename 會把 selected source 寫到 `new_name` canonical identity，未選中來源的 disabled targets 也寫入該新 identity 的 sidecar。

替代方案：前端自行拆解 deferred row 變成多個獨立 candidate 再送 apply。拒絕原因：前端不持有 grouped candidates 的完整 source 資訊（目前 deferred row 只保留 representative 的 source_path），需要 backend 參與。

### **Non-selected sources become disabled targets**

使用者選定一個來源後，其餘同名來源各自建立一個 disabled target（`enabled: false`、`mode: tracked`）。Target 的 agent 與 scope 從各來源的 `source_agent` 與 scan scope 推導。這樣：
- prune scan 不會把未選中來源標為 orphan（有 target 對應）。
- 使用者後續可在 TargetEditor 啟用該 target，push 時 canonical 內容會 fan-out 覆寫。
- 未來 Phase 2 的 forked overlay 可以利用這些 disabled target 作為差異保留點。

Backend 變更：`write_canonical_from_source` 之後，對每個未選中的 source，呼叫既有 `write_sync_meta_v2` 追加 disabled target entry。

### **Import wizard multi-source diff preview**

Multi-source row 在 wizard 中展開後，顯示各來源的 body preview 並排比較。現行 `ImportCandidate` 已攜帶 `body_preview`（240 bytes），diff preview 使用這些既有欄位。若 canonical 已存在同名 skill，額外顯示 canonical 的 body preview（來自 `ConflictInfo.canonical_body_preview`）。

前端變更：wizard 的 multi-source row 改為可展開的 accordion，展開後列出各 source 的 agent label + body preview + radio select。選定後 row 收起，顯示「以 <agent> 為來源」摘要。Multi-source row 仍保留 resolution radio：無 conflict 時預設 Import，可改 Skip / Rename；有 canonical conflict 時預設 Skip，必須明確改為 OverwriteCanonical 或 Rename 才會寫檔。

若 multi-source row 有 canonical conflict，row 內固定顯示與單一來源相同語意的 conflict warning bar。未選 source 時，warning 顯示 canonical path 並提示「先選來源再比較 / 覆寫 / 重新命名」；選定 source 後，warning 顯示該 source 自己的 `ConflictInfo.diff_summary` 與 canonical path。這避免第二次匯入同名 multi-source skill 時，使用者只看到來源選擇而漏掉覆蓋 canonical 的風險。Backend 必須讓 grouped `DeferredMultiSource.candidates` 內每個 source candidate 保留自己的 `conflict`，UI 不可只拿 representative row 的 conflict 描述所有來源。

不做 full diff viewer（逐行 diff）——body preview 的 240 bytes 足夠讓使用者辨識是否為同一份 skill。Full diff 屬 Phase 2 drift-detection-and-conflict-ui scope。

### **Disabled target content viewing**

TargetEditor 的每個 target row 都常駐顯示「查看內容」按鈕。點擊後以 modal 顯示該 target 對應 agent-side SKILL.md 的 raw 內容（唯讀）。Backend 需要一個 resolve + read 路徑：根據 target 的 agent、scope、project 解析出 agent-side skill directory，讀取 SKILL.md 內容。

Backend 變更：新增 command `skill_target_read_content(skill_name, target_key)` → `Result<String, String>`。使用 fan-out 模組現有的 `resolve_pair` + `agent_paths_get` 解析目標路徑。file 不存在時回傳 error（UI 顯示「檔案不存在」）。

前端變更：TargetEditor 每個 row 新增 Eye icon 按鈕，觸發 invoke + modal 顯示。Modal 使用 `<pre>` 或 monospace textarea（唯讀），重用 `ConfirmDialog` 的 modal pattern（`fixed inset-0 z-50` + backdrop）。

替代方案：只做 open-in-folder。拒絕原因：使用者表示希望在 app 內直接瀏覽內容，不需要跳出到 file manager。

### **ImportResolution semantic cleanup**

`KeepCanonical` 與 `Skip` 行為完全相同（都 `continue`）。合併為單一 `Skip` variant，移除 `KeepCanonical`。語意：使用者明確跳過此 candidate，不改動 canonical。

前端對應調整：wizard 的 conflict resolution UI 移除 KeepCanonical 選項，只保留 Skip / OverwriteCanonical / Rename。

**BREAKING**: 前後端的 `ImportResolution` enum 移除 `KeepCanonical` variant。若有 persisted selection（目前沒有——selection 是 wizard 臨時 state），需要 migration。現行架構下無 breaking data，但 TypeScript 型別需同步更新。

## Implementation Contract

**Behavior:**

- Multi-source 同名 skill 在 wizard 中不再灰掉；使用者可展開 row、比較各來源 body preview、選定一個來源匯入。
- Canonical 已存在時，multi-source 匯入仍必須明確選 Skip / OverwriteCanonical / Rename；選來源本身不等於覆蓋。
- Canonical 已存在時，multi-source row 會顯示 inline conflict warning；未選來源時提示先選來源，選定後顯示 selected source 對 canonical 的 diff summary。
- 匯入後，選定來源寫入 canonical；若使用者選 Rename 則寫入新 canonical identity。其餘來源各自建立 disabled target（`enabled: false`、`mode: tracked`）。
- 每個 target 可在 TargetEditor 查看 agent-side SKILL.md 內容（app 內唯讀 modal）。
- `KeepCanonical` variant 被移除，wizard 只提供 Skip / OverwriteCanonical / Rename / SelectSource。

**Interface / data shape:**

- `ImportResolution` enum 移除 `KeepCanonical`，新增 `SelectSource { source_index: usize, new_name: Option<String> }`。
- `ImportCandidate` 的 `deferred` 欄位保留但不再阻擋 apply。
- `group_by_name` 回傳的 deferred row 攜帶完整的 per-source candidates（新增 `DeferredMultiSource.candidates: Vec<ImportCandidate>` 或平行結構），供 wizard 展開與 backend apply 取用。
- `DeferredMultiSource.candidates[*].conflict` SHALL preserve the per-source conflict info computed during scan so UI can render selected-source diff summaries.
- 新增 Tauri command `skill_target_read_content(skill_name: String, target_key: String) -> Result<String, String>`。
- 前端 `commands.ts` wrapper 與 `types/skills.ts` 型別同步更新。

**Failure modes:**

- `skill_target_read_content` 找不到 agent-side file 時回傳 error string，UI 以 inline message 顯示「檔案不存在或路徑無法解析」。
- `SelectSource` 的 `source_index` 超出 grouped candidates 範圍時 apply 回傳 error，不寫任何檔案。
- `SelectSource.new_name` 存在時使用新 canonical identity；若為空則使用原 source directory identity。
- multi-source 中某個 source 的 `validation_error` 不影響其他 source 的可選性。

**Acceptance criteria:**

- `npm run check` 無新增 TypeScript 錯誤。
- `cargo test --lib` 覆蓋：multi-source apply 寫入選定來源 + 建立 disabled targets 測試；`KeepCanonical` variant 不再存在。
- `npm run tauri dev` 手動驗證：multi-source wizard diff preview、canonical conflict warning 在未選來源時提示先選來源、切換來源後更新 selected source diff summary、選定來源匯入、disabled target 查看內容。

**In Scope:**

- `skill_import.rs`：`ImportResolution` 改動、`group_by_name` 攜帶完整 sources、apply 支援 SelectSource、disabled target 建立。
- `skill_import.rs` 或獨立 command：`skill_target_read_content`。
- `SkillsPage.tsx`：import wizard multi-source accordion + diff preview + source selection。
- `TargetEditor.tsx`：disabled target 查看內容按鈕 + modal。
- `commands.ts` / `types/skills.ts`：型別更新。
- `en.ts` / `zh-TW.ts`：新增 i18n keys。

**Out of Scope:**

- Full diff viewer（逐行 diff）。
- Forked overlay / three-way merge。
- 非碰撞情境的 import 流程變更。
- Import wizard 整體 UX 重設計。
- ManagedInventory / ProjectsPage 的 import 入口行為（除非 resolution enum 變更迫使型別調整）。

## Risks / Trade-offs

- [Risk] `DeferredMultiSource` 攜帶完整 candidates 會增加 scan 回傳 payload 大小。→ Mitigation: body_preview 限制 240 bytes，通常 multi-source 只有 2-3 個來源，payload 增量可忽略。
- [Risk] 移除 `KeepCanonical` 是 breaking enum change，若有外部 caller 硬編 variant 名稱會壞。→ Mitigation: 沒有 persisted resolution data，且前後端同步改動在一個 change 內完成。
- [Risk] disabled target 建立依賴 scan 時的 source_agent 推導，若 agent path 設定被改動後 target 指向錯誤位置。→ Mitigation: target 建立時使用 scan 當下的 path 資訊，後續 push 仍走既有 resolve_pair 動態解析。
- [Risk] Multi-source row 在 wizard 展開後 UI 複雜度增加，可能影響使用者 import 速度。→ Mitigation: 非 multi-source 的 row 行為完全不變；multi-source row 預設收起，只在使用者主動展開時顯示。

## Open Questions

(none)
