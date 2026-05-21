## Why

`multi-agent-skills-foundation` 需要決定 canonical skill 主檔的 schema、各 agent 目錄的對應規則、以及匯出時的欄位 normalize 邏輯。這些決策都依賴對 Anthropic / OpenAI Codex / Google Gemini 三家現行 skill 規範的精準掌握。目前的設計討論基於我(Claude)訓練資料的記憶,**對 Codex 與 Gemini 是否真有「skills」概念尚未實證確認**,直接開 foundation change 會踩到 placeholder 與設計返工。

本 change 透過官方文件研究,產出一份結構化、可長期維護的 schema 對照 spec,作為後續所有 skill 相關改動的單一參考來源。

## What Changes

- 新增 `openspec/specs/agent-skills-schema/spec.md`,內含三家 agent 的 skill 規範對照(skill 發現路徑、檔名規範、frontmatter 欄位、body 格式、bundled files、觸發機制)。
- 對照表結構必須對「擴充第 4 家 agent」友善:per-agent 區塊採固定 sub-heading,新增 agent 不需重構既有 sub-heading。
- 明確記錄每筆資訊的來源(官方 doc URL + 查詢日期),便於日後驗證是否過期。
- 若研究發現某家 agent 並無「skills」概念(例如僅有 AGENTS.md / GEMINI.md instruction file),spec 必須**明確記錄此事實**並指出可替代的同步目標(例如把 canonical skill 渲染為 AGENTS.md 章節),不能留空白。
- 定義 canonical schema 應有的最小欄位集合(取自三家規範的交集 + 我們自訂的同步控制欄位 `agents: []`)。

## Non-Goals

- 不實作任何 skill 管理功能(canonical 目錄、匯入匯出、CRUD)——屬於後續 `multi-agent-skills-foundation` change。
- 不研究除 Anthropic / Codex / Gemini 以外的 agent(Cursor / Cline / Continue 等)。spec 結構為這些 agent 未來加入預留位,但本 change 不填內容。
- 不決定 frontend / backend 實作細節(資料結構、Rust types、React UI)——本 change 純產出研究 spec。
- 不修改既有程式碼。本 change 是純 artifact-only(僅新增 `openspec/specs/agent-skills-schema/spec.md`)。

## Capabilities

### New Capabilities

- `agent-skills-schema`: 三家 agent 的 skill 規範對照 reference spec。定義每家 agent 的 skill 發現路徑、檔名、frontmatter 欄位、body 格式,以及未來擴充新 agent 時應遵循的 sub-heading 結構。同時定義本專案 canonical skill 主檔的最小欄位集合。

### Modified Capabilities

(none)

## Impact

Affected code:

- New:
  - openspec/specs/agent-skills-schema/spec.md

Affected docs / 工具產物:

- 本 change 不修改任何程式碼。完成後 `git status` 僅顯示新增 `openspec/specs/agent-skills-schema/` 目錄。

Dependency 變動:

- 無新增依賴。研究階段使用 WebFetch / 既有 MCP 工具讀取官方文件。

風險評估:

- **破壞性變更**:無——僅新增 reference spec。
- **跨 change 依賴**:後續 `multi-agent-skills-foundation` 強烈依賴本 change 結論。本 change 依賴 `cleanup-glyphic-base` 完成(避免在被改動的 repo 上做研究)。
- **backward compatibility**:無對外介面變動。
- **資訊時效風險**:研究結果為某時點快照。三家 agent 規範可能在數月內變動。Spec 必須記錄每筆資訊的查詢日期,並在 spec 開頭註明「重大新版 agent 釋出時需重新核對」。
