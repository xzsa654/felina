# Agent Skill Market — 專案現況校準調查

**日期：** 2026-05-28  
**狀態：** Phase 3 方向研究，尚未適合開立實作型 Spectra change  
**定位：** 公司內部 Skill 社群化分享平台，未來可接內網 server；目前不應干擾 Skills 基礎能力收斂。

---

## 一、現況結論

Felina 目前已落地的 Skill 架構是本機 canonical source + fan-out model：

- Canonical Skill 主檔位於 `~/.felina/skills/<skill-name>/SKILL.md`。
- Sync metadata 位於同目錄 `.felina-sync-meta.json`。
- `.claude/skills/`、`.agents/skills/`、`.gemini/skills/` 等 agent-native 目錄是 fan-out output，不是 source of truth。
- Skills page、Projects page、Import Wizard、target model、drift/conflict UI 仍在 Phase 1.5 / Phase 2 收斂中。

因此 Skill Market 不應現在開成實作型 change。它應保留在 Phase 3，等 Skills 基礎模型穩定後再立案。

---

## 二、為什麼現在不開發

Skill Market 會直接依賴尚未完全穩定的能力：

| 依賴 | 目前狀態 | 對 Market 的影響 |
|---|---|---|
| Multi-source import / conflict semantics | Phase 1.5 planned | 安裝 marketplace package 時會遇到同名、改名、覆蓋、來源選擇問題 |
| Skill creation destination model | Phase 2 suggestion | 使用者需要理解建立 Skill 時 canonical、Workspace、Global、Shared 的落點 |
| Drift detection and conflict UI | Phase 2 parked | 安裝或更新 marketplace skill 後，target 端 drift 的處理規則要一致 |
| Third-party agent path configuration | Phase 2 suggestion | Market package 不能只假設三家內建 agent；未來可能擴充 agent definitions |
| Local versioning / snapshot layer | Phase 2 suggestion | Market install/update 應有 rollback、hash、compare 的安全基礎 |

如果現在開發 Market，會把尚未定案的 Skill 行為硬編進 marketplace，後續很容易重工。

---

## 三、正確產品方向

Skill Market 的目標不是單純本機工具，而是公司內部社群化：

```text
員工在 Felina 建立或維護 Skill
  -> 發佈到公司內部 Skill Market
  -> 同仁可搜尋、查看版本、安裝到自己的 Felina canonical skills
  -> 再由各自 Felina fan-out 到 Claude / Codex / Gemini / 其他 agent target
```

Market 應該建立在 Felina 現有 canonical model 上，而不是另建一套 `skill.json` package model。

---

## 四、建議的未來架構

### Desktop App

- React 新增 Skill Market 頁面。
- Rust/Tauri 新增 market client commands。
- Publish 來源是 `~/.felina/skills/<skill-name>/` canonical skill directory。
- Install 結果寫回 `~/.felina/skills/<skill-name>/`，再走現有 fan-out 流程。

### Market Server

未來內網 server 可以採用：

- Node.js + TypeScript + Fastify
- PostgreSQL 儲存 metadata
- MinIO 或公司既有 S3-compatible storage 儲存 package artifact
- Microsoft Entra ID 驗證公司帳號

這是合理方向，但應在 Phase 3 正式 proposal 中重新確認，不在目前立即實作。

### Package Format

建議以 Felina canonical package 為準：

```text
<skill-name>/
  SKILL.md
  .felina-sync-meta.json
  manifest.json
```

`manifest.json` 應描述 marketplace metadata，例如：

- package schema version
- canonical skill identity
- semantic version
- author identity
- description / tags
- published timestamp
- content hash
- compatible Felina/package schema version

---

## 五、Phase 3 前置條件

在開立 `skill-marketplace` Spectra change 前，至少應先完成或重新確認：

1. Skills import conflict model 穩定。
2. Skill creation destination model 定案。
3. Drift detection / conflict UI 有一致處理方式。
4. Canonical package identity 與 versioning 規則定案。
5. 本機 snapshot / rollback 或等價安全機制有方案。
6. 內網部署與身份驗證需求由 IT 或產品 owner 確認。

---

## 六、建議拆分

不要一次做完整 marketplace。建議拆成：

### 1. Package Contract Spike

定義 canonical package 格式、manifest schema、publish/install conflict semantics。  
這是 Phase 3 的前置 proposal，可在 server 前先做。

### 2. Local Registry Prototype

只用本機 registry 或 fixture 驗證桌面端 publish/install UX。  
目的不是正式功能，而是驗證 package contract。

### 3. Internal Market Server MVP

加入 server、metadata DB、artifact storage、Entra ID、search/download API。

### 4. Community Features

版本通知、評分、留言、team visibility、治理流程。

---

## 七、目前不採用的設計

- 不採用獨立 `skill.json` 作為 Felina marketplace 的核心 package source。
- 不以 Vercel/Supabase 作為已定案方向；公司內網與無網際網路部署需求使自管內網 server 更合理。
- 不在 Skills page 基礎能力完成前新增正式 Market route。
- 不讓 marketplace package 直接寫入 agent-native directories；它必須先進 canonical storage，再由 fan-out 管理 target output。

---

## 八、Backlog 狀態

`skill-marketplace` 應維持在 Phase 3 / suggestion / not-committed。

此項目前不是可立即開發的 planned-change；它是公司內部 Skill 社群化方向，blocked by Phase 1.5 / Phase 2 的 Skills 基礎能力。
