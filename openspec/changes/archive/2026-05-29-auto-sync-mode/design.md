## Context

Felina 的 skill sync 目前是純手動流程：canonical 改了 → dirty flag → 使用者點 Push → preview → confirm → 推送。對高頻修改場景（邊寫邊測）摩擦過大。本 change 新增 `auto` mode，讓 canonical write 後自動推送到 auto target，保留 manual mode 給需要審慎控制的場景。

現有基礎：
- `TargetMode` enum（Rust）: `Tracked | Detached | Forked`，前端 type: `"tracked" | "detached" | "forked"`
- `SkillTarget.enabled: bool` 控制是否參與 push
- `skill_sync_one(name)` 推送單一 skill 的所有 enabled + tracked targets
- TargetEditor 的 `UIState`: `"tracked" | "disabled"` 是前端投影

## Goals / Non-Goals

**Goals:**

- 新增 `auto` TargetMode，save 後自動 push 到 auto + enabled targets
- Sidecar 向後相容：讀到 `tracked` 視為 `manual`
- UI toggle 改為 Auto / Manual / Disabled

**Non-Goals:**

- File watcher 監聽外部編輯（只 hook Felina 的 write commands）
- Auto pull（pull 永遠手動）
- Detached / forked mode 實作
- 改變 manual push 的 preview/confirm 流程

## Decisions

### TargetMode enum 擴展

Rust `TargetMode` 從 3 variant 改為 4 variant：`Auto | Manual | Detached | Forked`。Serde deserialize 時 `"tracked"` alias 為 `Manual`（用 `#[serde(alias = "tracked")]`）。Serialize 時 `Manual` 寫出 `"manual"`。

前端 `TargetMode` type 改為 `"auto" | "manual" | "tracked" | "detached" | "forked"`，其中 `"tracked"` 保留為 read-only 相容值。

### Auto push trigger 位置

在 Rust 後端，auto push 不做在各 write command 函式內部，而是提取為一個共用的 helper `auto_push_if_needed(canonical_id: &str)`：

1. 讀取 sidecar targets
2. 過濾 `enabled=true && mode=Auto` 的 targets
3. 若非空，呼叫現有的 fan-out render + write 邏輯（`skill_sync_one` 的核心部分）
4. 更新 sidecar pushed_hash + lastSync.at
5. 成功後 dirty 設為 false

呼叫 `auto_push_if_needed` 的 3 個位置：
- `canonical_skills_write` 成功後
- `canonical_skills_write_raw` 成功後
- `skill_pull_from_target` 成功後

Auto push 失敗時不 block 原操作（save/pull 已完成），而是回傳結果中附帶 auto push 的錯誤訊息，讓前端可選擇性顯示。

### TargetEditor UI 改動

`UIState` 從 `"tracked" | "disabled"` 改為 `"auto" | "manual" | "disabled"`。Toggle 按鈕組從 2 個變 3 個。`applyUIState` mapping：

- `auto` → `{ enabled: true, mode: "auto" }`
- `manual` → `{ enabled: true, mode: "manual" }`
- `disabled` → `{ enabled: false, mode: "manual" }`

`toUIState` mapping：
- `enabled=true && mode=auto` → `"auto"`
- `enabled=true && (mode=manual || mode=tracked)` → `"manual"`
- `enabled=false` → `"disabled"`
- `mode=detached` → `"disabled"`（維持現行行為）

### Sidecar 相容性

不做 migration。讀取時 `"tracked"` alias 為 `Manual`，寫出時永遠用新值（`"auto"` 或 `"manual"`）。舊 sidecar 在第一次被寫入時自然升級。

## Implementation Contract

**Backend — TargetMode enum:**
- `Auto | Manual | Detached | Forked`，serde 序列化為 `"auto" | "manual" | "detached" | "forked"`
- `"tracked"` 反序列化 alias 為 `Manual`
- Acceptance: `cargo test` 涵蓋 `"tracked"` JSON 反序列化為 `Manual`

**Backend — `auto_push_if_needed` helper:**
- 接收 `canonical_id: &str`，回傳 `Result<Vec<SyncResult>, String>`
- 過濾 enabled + Auto targets，呼叫 fan-out render + write + sidecar update
- 3 個呼叫點：`canonical_skills_write`、`canonical_skills_write_raw`、`skill_pull_from_target` 成功後
- Auto push 失敗不 block 原操作
- Acceptance: `cargo test` 涵蓋 auto target 被推送 + manual target 不被推送

**Frontend — TargetMode type:**
- `"auto" | "manual" | "tracked" | "detached" | "forked"`
- Acceptance: `npm run check` clean

**Frontend — TargetEditor toggle:**
- 3 個按鈕：Auto / Manual / Disabled
- `toUIState` 和 `applyUIState` 按上述 mapping
- Acceptance: `npm run check` clean

**i18n keys:**
- `skills.targets.auto` — Auto 按鈕文字
- `skills.targets.autoTitle` — Auto tooltip
- `skills.targets.manual` — Manual 按鈕文字（取代原 `tracked`）
- `skills.targets.manualTitle` — Manual tooltip

## Risks / Trade-offs

- **[Auto push 失敗靜默]** Auto push 失敗不 block save，使用者可能不察覺 target 沒更新。→ 緩解：前端可在 save response 中顯示 auto push 錯誤 toast，但本 change 不實作 toast UI（scope 控制）。dirty flag 會因 auto push 失敗而保持 true，使用者下次看到 dirty badge 就知道了。
- **[效能]** Save 後同步 push 增加延遲。→ 緩解：push 通常 <100ms（本地檔案寫入），使用者感知不明顯。
- **[安全敏感]** 讀寫使用者檔案系統。→ 路徑解析沿用現有 `agent_paths` + `resolve_pair` 邏輯，不引入新 path construction。
