# 架構

Felina 的高層架構原則。用途是協助未來 agent 做出正確技術判斷，而不是複製完整 spec 或 README 內容。

---

## Local-only 桌面應用邊界
**ID:** kb-architecture-local-only-boundary
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-25 討論；AGENTS.md 專案指示
**Context:** Felina 是 Tauri v2 桌面應用，用來管理本機 agent 設定與 multi-agent skills。
**Applies when:** 設計或審查任何可能引入網路、telemetry、同步、遠端儲存或 server 假設的功能時。
**Lesson:**
- 將 Felina 視為本機檔案型桌面應用：沒有 server、沒有 telemetry，也沒有遠端 source of truth。
- 功能設計應優先透過 Tauri commands 明確讀寫本機檔案系統，而不是假設背景網路或 hosted service。
- 如果未來功能看起來需要遠端行為，應先把它提升為產品或架構決策，再進入實作，不要悄悄塞進 app layer。
**Keywords:** architecture, local-only, desktop, tauri, filesystem, no server, no telemetry
**Related:** AGENTS.md

## Local agent control plane 方向
**ID:** kb-architecture-local-agent-control-plane-direction
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-25 討論；.session/product-backlog.md Product Direction
**Context:** Product backlog 將 Felina 定位為 local agent control plane，而不是單純的 skill editor。
**Applies when:** 設計新的 skill-specific abstraction、資料模型、UI flow、backend module，或評估未來 capability family 是否會被目前設計卡住時。
**Lesson:**
- Skills 是第一個落地的 capability kind，但架構決策應避免 skill-only dead ends。
- 新增 skill-specific abstraction 前，先檢查它是否能自然延伸到其他 capability kind，或至少不會阻礙後續的 `hook`、`subagent`、`workflow`、`mcp-tool`、`prompt-template`、`policy-pack`。
- 可用 `Capability`、`Artifact`、`RuntimeBinding`、`ExecutionRecord` 作為長期模型方向，但目前實作仍以已存在的 `kind=skill` surface 為準；不要把 backlog 方向誤寫成已完成能力。
**Keywords:** architecture, control plane, capability, capability kind, skill-only, local agent, roadmap, backlog, artifact, runtime binding, execution record
**Related:** kb-architecture-skill-source-of-truth; .session/product-backlog.md

## Skill source of truth 與 fan-out 邊界
**ID:** kb-architecture-skill-source-of-truth
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-25 討論；AGENTS.md 專案指示
**Context:** Felina 會管理 canonical skill 定義，以及多個 agent 生態系使用的 agent-native skill 目錄。
**Applies when:** 變更 skill import、edit、sync、delete、repair、routing 或 fan-out 行為時。
**Lesson:**
- `~/.felina/skills/` 底下的 canonical skill master files 是使用者編輯的 source of truth。
- `.claude/skills/`、`.agents/skills/`、`.gemini/skills/` 這類 agent-native directories 是 fan-out outputs，不是 canonical stores。
- 讀取資料或偵測 drift 時，必須以 `~/.felina/skills/` 為比對基準。
- 修復或推播行為是單向的：從 canonical (`~/.felina/skills/`) 同步到 target (fan-out directories)；不要嘗試從 target 反向合併變更回 canonical。
**Keywords:** architecture, skills, canonical skills, source of truth, fan-out, agent-native, routing, sync
**Related:** kb-architecture-local-agent-control-plane-direction; AGENTS.md

## Felina 設定與 Claude 設定的邊界分離
**ID:** kb-architecture-felina-settings-boundary
**Date:** 2026-05-28
**Updated:** 2026-05-28
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-28 討論；src-tauri/src/paths.rs
**Context:** 曾誤將 Felina 內部的 Quota TTL 設定規劃存放至 `~/.claude/settings.json`。
**Applies when:** 重構、新增設定項目，或設計跨 Agent 組態儲存位置時。
**Lesson:**
- Felina 是一個「管理」各家 Agent 的獨立控制平面，它擁有自己專屬的配置檔。
- `~/.claude/settings.json` (`global_settings_path()`) 是 Claude Code 的專屬設定檔，Felina 只能用來管理 Claude 本身的配置，**絕對不可**將 Felina 內部的狀態或設定寫入其中，以免污染外部工具。
- Felina 自身的設定（如 Token Quota TTL、系統主題等）應統一儲存至 `~/.felina/settings.json` (`felina_global_settings_path()`)。如果現有的設定儲存機制（如 `settings.rs`）缺少對應的 scope，應擴充實作，而非圖方便借用其他 Agent 的配置空間。
**Keywords:** architecture, settings, felina, claude, namespace pollution, control plane, configuration
**Related:** kb-architecture-local-agent-control-plane-direction

## Active surface 由 registration 定義
**ID:** kb-architecture-active-surface-registration
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-25 討論；AGENTS.md 專案指示
**Context:** repository 可能保留一些模組或頁面作為參考資料，但它們不一定是 active application surface。
**Applies when:** 搜尋行為來源、串接新 capability、審查看似 dead code 的程式碼，或決定變更應實作在哪裡時。
**Lesson:**
- Active frontend pages 由 `src/router.tsx` 決定。
- Active backend command modules 由 `src-tauri/src/commands/mod.rs` 以及 `src-tauri/src/lib.rs` 裡的 Tauri `invoke_handler!` registration 決定。
- 只新增 Rust function 不會讓 frontend 可以呼叫它；需要一併更新 command module、registration，以及 typed frontend wrapper。
**Keywords:** architecture, active surface, router, tauri command, invoke_handler, command registration, frontend wrapper
**Related:** kb-tauri-shell-open-scope

## Specs、docs 與 KB 的職責分工
**ID:** kb-architecture-specs-docs-kb-boundary
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-25 討論；project-knowledge skill governance
**Context:** Felina 使用 Spectra 做 spec-driven development，並使用 `.knowledge/` 保存可重用的專案經驗。
**Applies when:** 判斷應該更新 spec、README/AGENTS 類文件、session handoff，或 KB entry 時。
**Lesson:**
- Spectra changes 與 specs 保存 task-specific requirements 和 feature truth。
- README/AGENTS 類文件保存廣義專案指示與 onboarding facts。
- `.knowledge/` 應保存可重用的架構原則、決策與經驗，協助未來 agent 避免重複犯錯；它不應變成第二份 README、task queue 或 handoff log。
**Keywords:** architecture, spectra, specs, knowledge base, documentation boundary, handoff, reusable lesson
**Related:** exp-spectra-analyze-keyword-coverage
