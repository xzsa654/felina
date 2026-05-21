## 1. Baseline

- [x] 1.1 為本 artifact-only change 建立健全度基線:跑 `npm run check` 與 `cd src-tauri && cargo build`,確認 repo 當前可編譯,將 stdout / stderr 與 exit code 寫入 `openspec/changes/agent-skills-schema-reference/baseline.txt`。本 change 不會修改任何程式碼,baseline 主要用於 apply 結束時對照確認「真的沒有意外動到 code」。Verify: 該檔案存在;npm 與 cargo 段均 exit 0。

## 2. Anthropic Claude Skills Format 研究

- [x] 2.1 [P] 完成 Anthropic Claude Skills Format Requirement 的所有 scenarios 填寫:WebFetch 或 Context7 抓取 Anthropic 官方 Skills 文件,將實際 global / project skill 發現路徑、frontmatter 必填與選填欄位清單、body 格式說明、bundled file 規範、load mechanism(預期 model-invoked)寫入 spec 對應 scenarios 的 THEN 段。每筆事實後綴 `Source: <URL>` 與 `verified YYYY-MM-DD`(YYYY-MM-DD 為 apply 當日)。Verify: `openspec/changes/agent-skills-schema-reference/specs/agent-skills-schema/spec.md` 的 Anthropic Claude Skills Format 區塊下,每個 scenario 的 THEN 段含具體事實字串、source URL 與 verified 日期;不存在 `<TBD>` / `<待研究>` 等 placeholder。

## 3. OpenAI Codex Skills Format 研究

- [x] 3.1 [P] 完成 OpenAI Codex Skills Format Requirement 的 scenarios:從 OpenAI Codex CLI 官方文件 / GitHub repo 確認是否存在 dedicated skill 機制。若存在,填寫「Codex skill system exists」scenario 內所有事實(發現路徑、frontmatter、body、load mechanism);若不存在,填寫「Codex has no skill system」scenario 內所有事實(AGENTS.md 替代路徑、格式、fan-out 渲染策略)。兩個 scenario 任擇其一填寫,另一個 scenario 加註 `(not applicable: 該 agent <存在|不存在> dedicated skill system)`。每筆事實後綴 source URL 與 verified 日期。Verify: spec 對應 Requirement 區塊下,兩個 scenario 至少一個 THEN 段含具體事實,另一個有 not-applicable 註記;source URL 與 verified 日期完備。

## 4. Google Gemini Skills Format 研究

- [x] 4.1 [P] 完成 Google Gemini Skills Format Requirement 的 scenarios:同 task 3.1 流程,針對 Google Gemini CLI(從 google-gemini/gemini-cli 官方 repo 或 ai.google.dev 文件)確認 skill 機制,填寫「Gemini skill system exists」或「Gemini has no skill system」對應 scenario,另一個加 not-applicable 註記。每筆事實後綴 source URL 與 verified 日期。Verify: spec 對應 Requirement 區塊下,scenario 完備度與 task 3.1 相同。

## 5. Canonical Schema Definition 統整

- [x] 5.1 基於 task 2.1 / 3.1 / 4.1 的研究結果,完成 Canonical Schema Definition Requirement 的 scenarios:將三家 frontmatter 欄位交集寫入 required fields 清單(預期含 `name`、`description`,以實際研究為準),三家欄位聯集寫入 optional fields 清單(各 optional 欄位標註來源 agent),補上 Glyphic 自訂 `agents: []` 為 required。同時填 canonical-to-agent field mapping scenario:對每家 agent 列出 canonical field → agent 端 field 對照(包含 identity / rename / ignored)。Verify: spec Canonical Schema Definition 區塊下三個 scenarios 的 THEN 段均含具體欄位清單(無 placeholder);required 清單明確標示 `agents` 為 Glyphic-specific 必填;mapping 包含三家 agent 各一份對照。

## 6. Prologue 與 Extension Template

- [x] 6.1 撰寫 Spec Prologue 區塊:於 spec.md 開頭(`## ADDED Requirements` 之前)新增 prologue 段落,內含「本 spec 為時點快照」「主要 agent 廠商釋出新版時需 re-verify」「初始涵蓋 agent 廠商清單」三項;清單以 bullet 列出 Anthropic Claude、OpenAI Codex CLI、Google Gemini CLI。Verify: spec.md 第一個 Markdown 段落含上述三項陳述;agent 清單為 bullet list 且三項齊備。
- [x] 6.2 完成 Extension Template for New Agents Requirement 的 scenario:撰寫 Extension Template 區塊內容,定義新增 agent 的步驟(複製哪一個 Requirement、命名規則為 `<AgentVendor> <ProductName> Skills Format`、最小 scenarios 清單、source URL + verified 日期政策)。Verify: spec 對應 Requirement 的 scenario THEN 段含上述四個要點;範例 Requirement 命名以「Anthropic Claude Skills Format」為例說明命名規則的套用方式。

## 7. 最終驗證

- [x] 7.1 跑 `spectra analyze agent-skills-schema-reference --json`,確認 Critical 與 Warning findings 各為 0(Suggestion 可忽略)。若有 Critical / Warning,在 spec 對應位置修正後重跑直到清零。Verify: analyze JSON 輸出中 Critical 與 Warning 的 finding_count 均為 0。
- [x] 7.2 跑 `spectra validate agent-skills-schema-reference`,確認 valid;對照 baseline.txt 跑一次 `npm run check` 與 `cd src-tauri && cargo build`,確認 exit code 與 baseline 一致(即本 change 確實未動 code)。Verify: validate 輸出 `valid`;npm 與 cargo 兩段 exit code 與 baseline 完全一致。
