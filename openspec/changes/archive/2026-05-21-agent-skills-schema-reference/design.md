## Context

`multi-agent-skills-foundation` 將決定 canonical skill 主檔 schema 與各 agent 的 fan-out 邏輯。要做這些決定,需要明確掌握三家 agent(Anthropic / OpenAI Codex / Google Gemini)當前的 skill 規範。**我(設計階段的 Claude)對 Codex 與 Gemini 是否真有「skills」概念並無實證確認**,僅有訓練資料中的記憶。直接基於記憶設計 foundation 將踩到三類風險:

1. 概念誤判:Codex / Gemini 可能根本沒有「按需呼叫的 skill」,只有 always-loaded 的 AGENTS.md / GEMINI.md。
2. 欄位猜測:frontmatter 欄位名與必填性記憶可能與現行規範不符。
3. 路徑猜測:`.agent/skills/` 與 `.gemini/skills/` 是使用者前面提的推測,並未驗證。

本 change 透過官方文件研究,把這些不確定性收斂成一份結構化、可長期維護的 reference spec。

## Goals / Non-Goals

**Goals:**

- 產出 `openspec/specs/agent-skills-schema/spec.md`,含三家 agent 的可驗證對照資訊。
- Spec 結構對「擴充第 4 家 agent」友善:per-agent 區塊採統一 sub-heading 模板。
- 對「該 agent 沒有 skills 概念」的情況明確記錄,並提供替代同步目標建議(例如渲染為 AGENTS.md 章節)。
- 定義 canonical skill 主檔的最小欄位集合,作為 `multi-agent-skills-foundation` 的設計依據。
- 每筆事實標註來源 URL + 查詢日期,日後可重新驗證。

**Non-Goals:**

- 不實作 skill 管理功能。
- 不研究第 4 家以後的 agent(僅留結構空位)。
- 不寫程式碼變動。

## In Scope

- 對 Anthropic Claude Skills 規範的對照欄位:skill 發現路徑(global / project)、目錄結構(目錄 / 單檔)、檔名(SKILL.md / 其他)、frontmatter 必填欄位、frontmatter 選填欄位、body 格式、bundled file 支援、觸發機制(model-invoked / always-loaded / explicit)。
- 對 OpenAI Codex CLI 的同上對照(若無 skills,記錄事實 + 替代方案)。
- Google Gemini CLI 的同上對照(若無 skills,記錄事實 + 替代方案)。
- Canonical schema 最小欄位定義:`name`、`description`、`agents: []`、其他三家交集欄位。
- 擴充新 agent 的 sub-heading 模板與作業流程描述。

## Out of Scope

- Cursor / Cline / Continue / 其他 agent 的對照內容。
- 任何欄位 normalize 演算法的詳細實作(僅敘述需要 normalize 的情境,實作留給 foundation change)。
- 任何 frontend / backend 程式碼變動。
- Skill UI 設計、CRUD 流程。

## Decisions

**決策 1:Spec 結構採「per-agent sub-heading 模板」而非 monolithic 對照表**

選擇:spec.md 內每家 agent 一個 `### Requirement: <Agent> Skill Format` 區塊,內含一致的 scenario 結構(發現路徑、檔名、frontmatter、body、bundled 等)。最後加 `### Requirement: Canonical Schema` 一節整理交集。

理由:對「新增第 4 家 agent」的延展友善——只需複製一個 Requirement 區塊填入。Monolithic 對照表雖然視覺上整齊,但每加一列就要重新對齊所有欄位,維護成本高;且 Spectra spec 體系本就以 Requirement / Scenario 為單位,自然契合。

替代方案:單一 Markdown 表格 + 多列。捨棄理由:擴充時要動到所有列、難以 delta 增改、與 Spectra spec 體系不一致(Spectra delta 是以 Requirement 為單位)。

**決策 2:無「skills」概念的 agent 仍須佔一個 Requirement 區塊**

選擇:即使 Codex / Gemini 證實沒有 dedicated skill 機制,該 agent 在 spec 中仍占一個完整 Requirement 區塊,scenarios 中明確記錄「無 skill 系統」事實,並描述替代同步目標(渲染為 AGENTS.md / GEMINI.md 章節 / appendix)。

理由:留白會造成「忘了研究」與「研究過但無結果」的歧義。明確記錄無結果反而比留白更有資訊價值。同時為 foundation change 提供具體的 fan-out 替代策略,而不是「不支援該 agent」這種懸而未決的留白。

替代方案:無 skills 的 agent 直接不列。捨棄理由:留白等同失憶,日後重新研究時無法判斷「之前查過嗎 / 結論是什麼」。

**決策 3:每筆事實標註 source URL + 查詢日期,寫在 scenario 的 `**WHEN**` 之前**

選擇:每個 scenario 在 `**WHEN**` 之前加一行 `Source: <URL> (verified YYYY-MM-DD)`。例:`Source: https://docs.anthropic.com/.../skills (verified 2026-05-21)`。

理由:Spectra spec 是長期 artifact,但本 spec 內容會隨外部規範變動而過期。固定位置的 source + date 讓「資訊是否過期」可被檢查與更新。

替代方案:統一在文件開頭列一張來源表。捨棄理由:多家 agent 多個段落,集中表會跟細部資訊脫鉤,過期時不易回溯。

**決策 4:Canonical schema 採「三家交集 + glyphic 自訂欄位」**

選擇:canonical schema 必填欄位 = 三家 skill 規範交集(預期含 `name`、`description`,其他依研究結果);可選欄位 = 三家任一家有的欄位之聯集;glyphic 自訂同步控制欄位 `agents: [<agent-name>, ...]` 為必填。

理由:必填採交集確保所有目標 agent 都能接收;可選採聯集確保不丟失資訊(target agent 不認識的欄位走 normalize 警示路徑,屬於 foundation change 範圍)。`agents` 為 glyphic 同步控制必填,不依賴任何 agent 規範。

替代方案 A:必填採聯集——某家 agent 無對應欄位就強制填空字串。捨棄理由:污染檔案、語意不清。
替代方案 B:無 canonical,直接以 Anthropic schema 為主。捨棄理由:形同寫死「Claude 優先」,與多 agent 中性立場衝突。

## Implementation Contract

**Behavior(本 change 完成後的可觀察結果):**

- `openspec/specs/agent-skills-schema/spec.md` 存在,含至少 4 個 Requirement 區塊(三家 agent + canonical)。
- 每個 agent Requirement 區塊內含相同結構的 scenarios:skill location / file naming / frontmatter fields / body format / bundled files support / load mechanism。
- 每個 scenario 的 WHEN 之前含 `Source: <URL> (verified YYYY-MM-DD)` 行。
- Canonical Requirement 區塊明確列出必填欄位與選填欄位清單。
- Spec 開頭 prologue 提示「資訊隨外部規範變動,新版 agent 釋出時需重新核對」。

**Interface / 檔案契約:**

- 路徑:`openspec/specs/agent-skills-schema/spec.md`(英文,SHALL/MUST 規範語言)。
- 每個 Requirement 名稱可被未來 delta spec 引用(命名穩定:`Anthropic Claude Skills`、`OpenAI Codex Skills`、`Google Gemini Skills`、`Canonical Schema`、`Extension Template`)。

**Failure modes:**

- 若 Codex / Gemini 官方文件直接證實無 skill 機制,scenario 仍須記錄此事實與替代同步目標,不得改成「TODO 待研究」。
- 若官方文件對某欄位描述模糊(例:必填性不明),scenario 須明確標註「規範未明示」,避免猜測。

**Acceptance criteria:**

- `spectra validate agent-skills-schema-reference` 通過。
- `spectra analyze agent-skills-schema-reference` Critical 與 Warning 為 0。
- 人工 review:每個 Requirement 區塊含 source URL 與 verified 日期,且日期屬於 apply 期間。

**Scope boundaries:**

- 在 scope:`openspec/specs/agent-skills-schema/spec.md` 內容產出。
- 出 scope:任何程式碼變動、任何 frontend UI 變動、Cursor / Cline / Continue 等其他 agent 的研究。

## Risks / Trade-offs

- [Risk] 官方文件對 skill 機制描述不完整,scenario 內容含糊 → Mitigation:遇到模糊處明確記錄「規範未明示」,並在 spec prologue 列出「未來需釐清項目」清單;不臆測。
- [Risk] 三家規範差異過大,canonical 交集為空集(極端情況) → Mitigation:若交集真為空,canonical 必填只剩 glyphic 自訂的 `agents` 欄位 + `name`(以使用者體驗考量強制);其餘走可選 + normalize 警示路徑。
- [Risk] 研究查到的資訊在 foundation change apply 時已過期 → Mitigation:source + 日期機制讓 foundation change 開工前可快速核對;若發現過期,從 ingest workflow 更新 spec 而非重做。
- [Trade-off] 為了延展性採「per-agent Requirement 區塊」結構,spec 會比 monolithic 表格冗長。接受理由見決策 1。

**安全敏感性評估:** 本 change 為純研究文件產出,不涉及檔案系統存取、外部命令執行、外部輸入處理。**不需要** `/spectra-audit`。

**第三方依賴變動:** 無。
