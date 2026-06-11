# Felina 黑客松簡報規格報告

> 用途：作為黑客松簡報與 PPT 製作基礎文件
> 目標讀者：一般使用者、非工程背景評審、黑客松評審
> 核心主題：問題陳述與解決方案、核心功能與技術架構、預期效益、團隊分工與開發工具使用

---

## 一、問題陳述與解決方案

### 1.1 專案背景

AI Agent 正快速進入開發者與團隊的日常工作流程。現在許多人不只使用單一 AI 工具，而是同時使用 Claude Code、OpenAI Codex CLI、Gemini / Antigravity CLI 等不同 Agent。

這些 Agent 各自有自己的 Skill、設定檔、專案目錄與使用紀錄。當使用者或團隊想要在多個 Agent 之間共用同一套工作規則時，往往只能依靠手動複製、貼上與維護。

這會帶來幾個實際問題：

- 同一份 Skill 散落在不同 Agent 目錄，難以確認哪一份是最新版。
- 不同 Agent 格式不同，手動轉換容易出錯。
- 外部修改可能在下一次同步時被覆蓋。
- 團隊成員之間分享好用 Skill 時，只能靠傳檔或口頭說明。
- Token、Session 與使用紀錄分散在不同工具裡，難以統一觀察。

簡單來說，多 Agent 工作流程正在變得強大，但也變得分散、難管、不可追蹤。

### 1.2 解決方案概述

Felina 是一套 local-first AI Agent control plane。它讓使用者在本機集中管理多個 Agent 的 Skill、同步狀態、使用紀錄與團隊共享流程。

Felina 的核心做法是：

> 使用者只需要維護一份 Felina canonical Skill，再由 Felina 安全同步到 Claude、Codex、Gemini / Antigravity 等 Agent 的原生目錄。

同時，Felina 提供差異預覽、drift detection、import staging、本機 snapshot、Token Analytics、History 與 Skill Hub，讓多 Agent 工作流程從手動複製，變成可管理、可預覽、可追蹤、可共享的桌面工作流。

### 1.3 Before / After

| Before：沒有 Felina | After：使用 Felina |
|---|---|
| 每個 Agent 各自維護 Skill | 一份 Skill 集中管理 |
| 手動複製到不同資料夾 | 同步到多個 Agent target |
| 不知道哪份被改過 | 自動偵測 drift |
| 覆蓋前沒有提醒 | 寫入前先看 diff preview |
| 好用 Skill 靠私下傳檔 | 透過 Skill Hub 發佈與安裝 |
| 使用紀錄分散 | 本機 Token Analytics / History |

### 1.4 一句話定位

> Felina 把多 Agent 工作流程從分散、手動、不可追蹤，轉變為集中、安全、可共享的本機 AI Agent 管理平台。

---

## 二、核心功能與技術架構

### 2.1 核心功能

Felina 的核心能力可以分為四個模組。

#### 1. Multi-Agent Skill 中央管理

Felina 將 Skill 視為可管理的 AI 工作能力，而不是散落在不同工具中的文字檔。

主要能力包括：

- 建立、編輯、重新命名、刪除 Skill。
- 從既有 Agent 目錄或 ZIP 匯入 Skill。
- 使用 Felina canonical store 作為單一維護來源。
- 支援 Claude、Codex、Gemini / Antigravity 等 Agent-native Skill 目錄。
- 管理 Global / Project targets 與同步狀態。
- 提供 Markdown 預覽、Split View 與來源對照。

非工程師說法：

> Felina 讓使用者把不同 AI 工具的工作規則集中管理，不需要每個工具各改一份。

#### 2. 安全同步與衝突防護

多 Agent 同步最大的風險不是「能不能複製檔案」，而是「會不會覆蓋錯的內容」。Felina 將同步流程設計成可預覽、可確認、可追蹤。

主要能力包括：

- Push 前顯示實際會變更哪些 target。
- 偵測 Agent 端是否被外部修改。
- Pull 前提供行級 diff preview。
- 匯入前先進入 staging，不直接覆蓋 canonical store。
- 使用本機 snapshot 保存同步基準。
- 對衝突與不安全操作進行阻擋或提醒。

非工程師說法：

> Felina 在真正寫入之前，會先讓使用者看見影響範圍，避免重要設定被默默覆蓋。

#### 3. Token Analytics 與 History

Felina 不只管理 Agent 的能力，也協助使用者理解 Agent 實際如何被使用。

主要能力包括：

- 掃描本機 Agent CLI 的 Token / Session 資料。
- 依時間、模型、Project、Session 檢視使用情況。
- 提供 Token Dashboard、History 與 Session transcript。
- 資料保留於本機，不需要上傳到外部服務。

非工程師說法：

> Felina 幫使用者在本機看見 AI 工具的使用情況，了解哪些專案、模型與 session 消耗最多。

#### 4. Skill Hub 團隊共享

Felina 將個人的 Skill 管理延伸到團隊協作。透過公司內網部署的 Market Server，團隊可以發佈、搜尋與安裝彼此的 Skill。

主要能力包括：

- 發佈 canonical Skill 到內部 Skill Hub。
- 從 Hub 瀏覽、預覽、安裝 Skill。
- 安裝前顯示 Split View Markdown 預覽。
- 安裝後寫入 Felina canonical store，再透過 fan-out 同步到 Agent。
- 支援登入、refresh token、remember-me 與 ownership 驗證。
- Market Server 支援 Docker、PostgreSQL、MinIO 與安全設定。

非工程師說法：

> 好用的 AI 工作流程不再只能靠私下複製檔案，而是可以像內部工具市場一樣發佈、搜尋、安裝與更新。

### 2.2 技術架構

Felina 採用桌面應用與本機後端整合架構。

```text
使用者
  ↓
React / TypeScript 桌面介面
  ↓
Tauri IPC / typed command wrappers
  ↓
Rust local backend
  ↓
Canonical Skills / Fan-out / Drift Detection / Diff / Snapshot / Token Analytics
  ↓
Claude / Codex / Gemini 本機 Agent 目錄
```

Skill Hub 為選用功能：

```text
Felina Desktop
  ↓
公司內網 Market Server
  ↓
Fastify API + PostgreSQL + MinIO
```

### 2.3 技術選型

| 層級 | 技術 | 用途 |
|---|---|---|
| Desktop Shell | Tauri v2 | 桌面視窗、系統整合、前後端 IPC |
| Frontend | React 19、TypeScript | 使用者介面 |
| State / Data | Zustand、TanStack Query | 前端狀態與資料查詢 |
| Backend | Rust | 本機檔案操作、同步、解析與資料處理 |
| Styling | Tailwind CSS v4 | UI 樣式 |
| Snapshot / Diff | git2、similar | 本機版本基準與差異預覽 |
| Analytics | SQLite、Rayon、tokscale | Token / Session 掃描與分析 |
| Market Server | Node.js、Fastify、PostgreSQL、MinIO | Skill Hub API 與 artifact 儲存 |
| Development Process | Spectra SDD | 規格、設計、任務與驗證流程 |

### 2.4 技術亮點

Felina 的技術重點不只是「做一個管理介面」，而是處理多 Agent 生態中的實際整合問題：

- 保留各 Agent 原生格式，不要求使用者改用封閉格式。
- 所有主要資料流在本機完成，符合 local-first 設計。
- 同步前提供可視化預覽，降低誤覆蓋風險。
- 透過 Skill Hub 將個人工作流程擴展為團隊共享資產。
- 使用 Spectra SDD 管理功能規格與實作歷程，提高專案可追蹤性。

---

## 三、預期效益

### 3.1 對個人使用者的效益

Felina 可以降低個人管理多個 AI Agent 的成本。

使用者不需要在 Claude、Codex、Gemini 等工具之間重複維護同一份 Skill，也不需要記住每個 Agent 的目錄位置與格式差異。當內容要同步時，Felina 會先顯示差異與影響範圍，讓使用者在確認後再寫入。

預期效益包括：

- 減少重複編輯與手動複製時間。
- 降低格式轉換與同步錯誤。
- 避免外部修改被靜默覆蓋。
- 更清楚知道每個 Skill 部署到哪些 Agent 與 Project。
- 在本機查看 Token 與 Session 使用紀錄。

### 3.2 對團隊的效益

Felina 可以把個人累積的 AI 使用經驗轉化成團隊資產。

團隊中的好用 Skill 不再只存在於某位成員的電腦或聊天紀錄裡，而是可以透過 Skill Hub 發佈、搜尋、預覽與安裝。新成員也可以更快取得團隊標準化的 AI 工作流程。

預期效益包括：

- 降低團隊導入 AI Agent 的門檻。
- 促進 Skill 重複使用。
- 讓團隊工作規則更一致。
- 減少靠口頭傳授與手動傳檔造成的版本落差。
- 建立可累積、可維護的內部 Agent capability library。

### 3.3 對組織與資安的效益

Felina 採 local-first 設計。主要 Skill、設定、Token 與 Session 資料都保留於使用者本機。Skill Hub 也可以部署於公司內網，不依賴外部雲端服務。

預期效益包括：

- 敏感工作流程與使用紀錄不需要上傳第三方平台。
- 公司可自管 Skill Hub 與權限。
- 適合對內部開發流程、程式碼規範與資料隱私有要求的團隊。

### 3.4 建議展示 KPI

目前這些指標應作為競賽展示與後續驗證 KPI，不應描述為已完成的正式使用者研究結果。

| 效益面向 | 建議展示方式 |
|---|---|
| 降低 Skill 維護時間 | 比較手動部署一份 Skill 到三個 Agent 與 Felina fan-out 所需時間 |
| 降低誤覆蓋風險 | 現場修改 Agent 端檔案，展示 drift detection 與 diff preview |
| 提升同步透明度 | 展示 Push Preview、Coverage Matrix 與 target 狀態 |
| 提升團隊共享效率 | 從 Hub 發佈 Skill，再以另一位使用者安裝 |
| 提升使用洞察 | 展示 Token Analytics / History |
| 強化本機隱私 | 說明資料留在本機與內網 Hub 部署模式 |

### 3.5 競賽價值總結

Felina 的價值不只是節省幾次複製貼上的時間，而是把多 Agent 工作流程變成可管理的系統。

它解決的是 AI Agent 普及後會越來越明顯的問題：

> 當每個人都開始使用 AI Agent，團隊需要的不只是更強的模型，而是管理 AI 工作方式、能力資產與使用紀錄的工具。

---

## 四、團隊分工與開發工具使用

### 4.1 團隊分工

Felina 的開發依照產品模組與技術層分工。

| 成員 | 分工 |
|---|---|
| 57 | 共同產品規劃；Skills、Projects、Skill Hub、Market Server、相關 UI 與測試 |
| Billy | 共同產品規劃；Token Analytics、History、相關 UI 與測試 |

這樣的分工讓 Felina 不只是單一功能 demo，而是涵蓋桌面應用、後端同步邏輯、資料分析、團隊共享平台與工程流程的完整產品原型。

### 4.2 開發工具與流程

Felina 使用 Spec-Driven Development 方式開發，透過 Spectra 管理 proposal、design、spec、tasks 與 archive。

這代表每個功能不是臨時堆疊，而是經過：

```text
問題定義 → 設計 → 規格 → 實作 → 驗證 → 封存
```

主要開發與品質工具包括：

| 類別 | 工具或做法 |
|---|---|
| 版本控制 | Git；main、dev、spx/change-name 分支模型 |
| 規格管理 | Spectra SDD |
| Frontend | React、TypeScript strict mode、Vite |
| Backend | Rust、Tauri commands |
| 靜態檢查 | npm run check |
| Build 驗證 | npm run build、npm run tauri build |
| Backend 驗證 | cargo check / Rust tests |
| 規格驗證 | spectra analyze、spectra validate |
| Hub 部署 | Docker、Docker Compose、PostgreSQL、MinIO |

### 4.3 工程可信度

Felina 的開發成果可由以下資料佐證：

- Git history 顯示持續開發紀錄。
- 多位 contributors 參與。
- 已完成多個 Spectra changes 與正式 specs。
- 前端、後端、桌面整合與 Market Server 均有實作。
- 核心功能可透過 Demo 流程展示。

簡報中可以用這句話總結：

> 我們不只是做出畫面，而是用規格驅動的方式，把需求、設計、實作與驗證串成一個可持續開發的產品。

---

## 五、建議 Demo 流程

為了讓四大主題能在簡報中自然串起來，建議 Demo 使用單一故事線：

### Demo 主軸

> 一位開發者建立一份 Code Review Skill，想讓 Claude、Codex、Gemini 都能使用，並將它分享給團隊。

### Demo 步驟

1. 展示不同 Agent 各自有不同 Skill 目錄與格式。
2. 在 Felina 建立或匯入一份 canonical Skill。
3. 選擇 Claude、Codex、Gemini targets。
4. 展示 Coverage Matrix 與 Push Preview。
5. 確認後 fan-out 到各 Agent 原生目錄。
6. 手動修改其中一個 Agent 端 Skill。
7. 回到 Felina 展示 drift detection 與 diff preview。
8. 切到 Token Analytics / History，展示本機使用洞察。
9. 將 Skill 發佈到 Skill Hub。
10. 以另一位使用者身份從 Hub 預覽並安裝 Skill。

這個 Demo 可以同時覆蓋：

- 問題與解決方案
- 核心功能與技術架構
- 預期效益
- 團隊成果與完整度

---

## 六、建議 PPT 結構

1. **封面**

   Felina: Local-First AI Agent Control Plane

2. **問題**

   多 Agent 時代，Skill、設定與使用紀錄散落各處。

3. **解決方案**

   一份 Skill 集中管理，安全同步到多個 Agent。

4. **Before / After**

   展示 Felina 帶來的工作流程差異。

5. **核心功能**

   Skill 管理、安全同步、Token Analytics、Skill Hub。

6. **技術架構**

   Tauri Desktop、Rust backend、React UI、Market Server。

7. **Demo**

   用一份 Code Review Skill 串起完整流程。

8. **預期效益**

   個人省時、團隊共享、組織本機隱私。

9. **團隊分工與開發流程**

   模組分工、Spectra SDD、品質工具。

10. **結論與未來方向**

   Felina 將多 Agent 工作流程變成可管理、可追蹤、可共享的本機平台。

---

## 七、結論

Felina 解決的是多 Agent 時代逐漸浮現的管理問題。

當使用者同時使用 Claude、Codex、Gemini 等 AI Agent 時，Skill、設定、使用紀錄與團隊知識會分散在不同工具與資料夾中。Felina 透過 canonical source、fan-out、安全同步、Token Analytics 與 Skill Hub，將這些分散流程整合成一個本機優先的 Agent 管理平台。

對個人而言，Felina 減少重複維護與同步錯誤。
對團隊而言，Felina 讓好用的 AI 工作流程可以被發佈、安裝與重複使用。
對組織而言，Felina 保留 local-first 與內網部署能力，兼顧效率與資料掌控。

Felina 的核心價值可以總結為：

> 把多 Agent 工作流程從分散、手動、不可追蹤，轉變成集中、安全、可共享的本機 AI Agent control plane。
