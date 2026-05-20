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

- **Per-agent override**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  同一 skill 同步給多 agent 時,允許各 agent 端內容微調。資料模型需擴充(主檔 + agent override patch)。

## Phase 3 — Skill 社群化

- **公司內部 skill 分享 marketplace**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  延伸 server 端,使用者可發佈 / 訂閱他人的 skill。Server stack 初步討論:Vercel + Supabase,Node Express 是否必要待釐清。會影響 skill schema(需加唯一識別、版本、作者欄位)。

## 平行進行

- **Token 審計平台**
  flagged: 2026-05-20 / last-seen: 2026-05-20
  由同仁負責。排程 POST token 用量到 server,支援多 uid 與時間範圍查詢。Server stack 設計待同仁釐清。Glyphic 既有 token-savings / analytics 頁面在 cleanup-glyphic-base 階段一併移除,後續由本項目的方案取代。
