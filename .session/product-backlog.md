# Product Backlog

待立項的產品功能 roadmap。項目正式進入開發時,透過 `spectra new change` 立 Spectra change,並在這份文件移除或標註 `in-progress: <change>`。

維護規則:
- 只收尚未開立 Spectra change 的「未來功能 / 方向」。
- 已立項並進入開發的工作不重複追蹤;以 Spectra 的 `spectra list` 為準。
- 項目需註明 `flagged: YYYY-MM-DD`(首次登錄日)與 `last-seen: YYYY-MM-DD`(最近一次 session 確認仍要做的日期)。
- 不放工具 / 框架 / 流程層面的設計問題,那類項目歸 `.session/design-backlog.md`。

---

## Phase 1 — 等依賴的下一個 Spectra change

- **multi-agent-skills-foundation**(預計 change 名)
  flagged: 2026-05-20 / last-seen: 2026-05-20
  blocked-by: `agent-skills-schema-reference` 需先 apply 完成,提供 canonical schema 與三家 agent 對照表後,本 change 才能基於實際資料設計實作。

  核心構想(等 schema 研究完成後 propose 時細化):

  - **Canonical 儲存層**:
    - `~/.glyphic/skills/<skill-name>/SKILL.md`(全域)與 `<project>/.glyphic/skills/<skill-name>/SKILL.md`(專案)兩個 scope 各自獨立。
    - 主檔為 Markdown + YAML frontmatter,frontmatter 含 `agents: [<agent-name>, ...]` 同步控制欄位。
    - 跟 git 一起追蹤(主檔本身就是 source of truth)。

  - **Agent 設定**:
    - 寫死支援 Anthropic / OpenAI Codex / Google Gemini 三家。
    - 各 agent 的 skill 目錄路徑(global / project)可由使用者於 Settings 頁調整,預設值來自 `agent-skills-schema-reference` 研究結果。
    - 預留資料結構支援第 4 家,但 UI 不暴露(避免使用者誤設)。

  - **初始化匯入**:
    - 首次啟動或手動觸發時,掃描已知 agent 目錄(`~/.claude/skills/`、`.claude/skills/`、`.codex/skills/` 等)收集既存 skill。
    - 衝突處理:同名 skill 在多個 agent 目錄發現時,呈現 diff 讓使用者選擇主版本來源,並設定 `agents: []` 為所有發現的 agent。
    - 匯入後 skill 主檔放在 `~/.glyphic/skills/` 或 `<project>/.glyphic/skills/`,各 agent 目錄保留原檔不動(等待 phase 2 drift 偵測啟動雙向處理)。

  - **Skill CRUD**:
    - List:依 scope 切分 tab(global / 各 project),顯示 skill 名稱、description、`agents` 標籤、最後修改日。
    - Create / Edit:CodeMirror 編輯 SKILL.md(frontmatter + body),frontmatter 區用視覺化表單(欄位依 canonical schema)。
    - Delete:刪 canonical;同步給 agent 的版本不主動刪,留待 phase 2 drift UI 處理。

  - **單向匯出(push)**:
    - 操作:點 skill 上的「Sync」按鈕 → 依 `agents` 欄位匯出到各 agent 目錄。
    - 行為:純檔案複製(Windows 無 symlink 問題);target 目錄不存在自動建立。
    - 不處理:drift 偵測、衝突、normalize 警示——皆 phase 2。

  - **不包含的 phase 2 功能(明確 out of scope)**:
    - 雙向同步(drift 偵測 + 三向 diff 衝突解決)
    - 欄位 normalize 警示(target 不認識欄位的處理)
    - Per-agent override(同 skill 多 agent 內容微調)
    - Skill 社群化分享相關功能

  - **影響的既有頁面**:
    - Skills 頁重寫(使用 canonical 儲存層 + agent 同步)。
    - Settings 頁加入 agent 路徑設定區。
    - Templates 頁改寫為 skill 範本庫(初始化時可用)。
    - Memory 頁不動。
    - hooks / instructions / mcp / rules 仍保持取消註冊狀態。

## Phase 2 — Skill 同步進階功能

- **Drift 偵測 + 衝突解決 UI**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  App 開啟時掃描各 agent skill 目錄是否與 canonical 不一致,提供三向 diff 與「以主檔覆蓋 / 拉回主檔 / 解綁追蹤」三種解決動作。對應 phase 1 同步策略路線二的延伸實作。

- **跨 agent 欄位 normalize 警示**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  同步前比對 target agent schema,主檔有 target 不認識的欄位時提示使用者:過濾掉 / 保留原樣 / 對應到其他欄位,選擇記為 per-skill per-agent mapping rule 持久化。

- **移除 target 時的孤兒 prune(de-select agent → 舊檔處理)**
  flagged: 2026-05-22 / last-seen: 2026-05-22
  問題(S3 smoke 2026-05-22 發現):變更 skill 的 agents tag、取消某 agent 後 push,被取消 agent 資料夾(如 `.gemini/skills/<name>`)的舊檔**不會被刪除**,留成孤兒。根因:fan-out(`skill_sync_one`)只寫 `skill.agents` 列出的 target,從不 prune;S3 fan-out 規格本就是單向 render、未規範刪除。
  歸屬:刻意不在 S3 修——這是「移除一個 target 時舊檔要不要 prune」的破壞性語意,屬下一個 change(target 模型 + detach/cascade)領域,與 [[Forked-target 客製化]] 的 target list 模型一起做才不丟棄性。
  **待 discuss 的決策**:de-select agent / 移除 target 時,舊檔 → (a) 自動刪除(cascade prune) / (b) 留孤兒(detach,預設) / (c) 每次 prompt。與「刪整個 canonical 的 C7 prompt 三選一(Cascade/Detach/Cancel)」是同族,粒度不同(移除單一 target vs 移除整個 skill),收斂時應一致處理。傾向預設 (b) detach + 提供顯式「prune orphans」動作(在 tag 編輯時自動刪 agent 資料夾的檔太突兀)。

- **Forked-target 客製化(per-target overlay,Route 2)**
  flagged: 2026-05-20 / last-seen: 2026-05-22
  使用情境:canonical 推到 `claude-project:Foo` 後,使用者進該目標檔手改一小部分(例:加 project-specific path、example、注意事項),希望此客製化保留;但 canonical 後續更新的其他部分仍能套用。等同於 git 的「tracking branch + local commits」概念套到 skill 檔。

  **設計路線(於 2026-05-22 discuss 會敲定 Route 2 overlay,捨棄 Route 1 3-way merge 與 Route 3 區段標註)**:
  - Canonical 主檔保持純淨,客製內容以**獨立 overlay 檔**儲存在 canonical sidecar:
    ```
    ~/.felina/skills/<skill-name>/
      SKILL.md                                ← canonical
      .felina-sync-meta.json                  ← targets + last_sync(Phase 1 已建立)
      overlays/
        claude-project-Foo.patch.md           ← Foo 專案的客製覆蓋
        claude-project-Bar.patch.md           ← Bar 專案的客製覆蓋
    ```
  - Overlay 格式 MVP 採「**整段替換**」(明確、好顯示);未來可延伸支援 unified diff 行級覆蓋。
  - Render flow:`fan_out(canonical) → apply overlay(target) → 寫入 target SKILL.md`。Canonical 改了等於自動套新 base + 老 overlay。
  - 三家 agent 不認識 overlay 概念,渲染後輸出仍是純 SKILL.md,對 agent 透明。

  **Phase 1 已預留的鉤子(於 `skill-tab-target-freedom` change 落地)**:
  - sync-meta sidecar schema v2 `targets[].mode` enum 已含 `forked` 值(Phase 1 只實作 `tracked`/`detached`,`forked` 留 placeholder)。
  - sync-meta `last_sync[target].base_snapshot` 欄位已預留,Phase 2 啟用(存 fork 那一刻的 canonical 內容,作為 overlay 的 base)。
  - Phase 1 reverse drift 對話框只給「override / detach」兩選一;Phase 2 加上「fork(保留客製,Phase 2 啟動)」第三選項。

  **Phase 2 要實作的工作**:
  - Overlay 編輯 UI:不能讓使用者寫 unified diff,需提供「對照原 canonical 顯示客製段落、編輯整段替換」的介面。
  - Overlay 與 canonical 結構漂移處理:canonical 把某段砍了、overlay 還想改那段時的降級策略(警告 + 落為 detached?)。
  - Push 時的 conflict surface:overlay 套用失敗時的使用者提示流。
  - Overlay 進 git 的策略(project canonical 的 overlay 進、global 的不進,同 sync-meta)。

## Phase 3 — Skill 社群化

- **公司內部 skill 分享 marketplace**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  延伸 server 端,使用者可發佈 / 訂閱他人的 skill。Server stack 初步討論:Vercel + Supabase,Node Express 是否必要待釐清。會影響 skill schema(需加唯一識別、版本、作者欄位)。

## 平行進行

- **Token 審計平台**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  由同仁負責。排程 POST token 用量到 server,支援多 uid 與時間範圍查詢。Server stack 設計待同仁釐清。Glyphic 既有 token-savings / analytics 頁面在 cleanup-glyphic-base 階段一併移除,後續由本項目的方案取代。
