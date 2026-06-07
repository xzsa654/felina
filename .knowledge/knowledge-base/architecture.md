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

---

## 外部資料來源的 enum 解析應 passthrough-first
**ID:** kb-architecture-external-data-passthrough
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-29 Session 2 — tokscale 回傳未知 client `big-pickle` 導致整批資料被丟棄
**Context:** tokscale 解析鏈有三道 agent 白名單閘門（`parse_agent`、`agent_from_str`、`AgentId` enum），任一道遇到未知值就拒絕或整批失敗。新 agent 出現時每道都要手動加，且一個未知 row 毒化所有有效 rows。
**Applies when:** 解析外部資料來源（CLI 工具輸出、API 回應、第三方 JSON）中的分類欄位，且該欄位值集合不由本專案控制時。
**Lesson:**
- 外部來源的分類值（agent name、provider、client type）不應用封閉 enum 當 gatekeeper。
- 正確模式：認識的值正規化成內部名稱，不認識的原樣透傳（passthrough-first）。
- 如果下游型別是封閉 enum（如 `AgentId`），考慮加 `Other(String)` variant 或在該層改用 `String`。
- 逐一新增已知值和「遇到未知就跳過」都是亡羊補牢——前者每次都要改代碼，後者靜默丟資料。
- 多層解析鏈（parse → transform → storage）每層都需一致的策略；只修一層不夠。
**Keywords:** architecture, enum, whitelist, passthrough, external data, agent, closed enum, poisoning, batch failure
**Related:** kb-platform-windows-cmd-shim

---

## Tauri invoke 參數名必須與 Rust 函式參數 snake_case 一致
**ID:** kb-architecture-tauri-invoke-param-naming
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-29 Session 4 — `skill_pull_from_target` invoke silent failure
**Context:** 前端 `invoke("cmd", { camelCaseKey })` 自動轉為 snake_case 傳給 Rust，但 Rust 參數名 `target_key_arg` 與轉換後的 `target_key` 不匹配 → invoke 直接失敗，無明確錯誤訊息。
**Applies when:** 新增或修改 Tauri `#[tauri::command]` 函式參數時。
**Lesson:**
- 前端 camelCase key 自動轉 snake_case 後必須與 Rust 函式參數名**完全一致**。
- 參數名不一致不會 compile error，只在 runtime invoke 時 silent fail。
- 新增 command 後務必實際呼叫一次驗證，不能只靠 `cargo build` 通過。
- 若 Rust 參數名與 import 的函式同名會 shadow，用 local `use ... as` 重新命名函式而非改參數名。
**Keywords:** tauri, invoke, command, parameter, snake_case, camelCase, naming, silent failure

---

## Canonical 與 agent 端 SKILL.md 格式不同：pull/import 需分層處理
**ID:** kb-architecture-canonical-vs-agent-skill-format
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** 2026-05-29 Session 4 — pull 整檔覆寫導致 frontmatter 解析失敗 + Codex import 殘留 `agents/openai.yaml`
**Context:** Push 時 per-agent renderer 精簡 frontmatter（Anthropic 只輸出 name+description，不含 agents 欄位）並可能產生附屬檔案（Codex 的 `agents/openai.yaml`）。反向操作（pull/import）若不理解這個差異會破壞 canonical。
**Applies when:** 實作任何從 agent target 讀取並寫回 canonical 的操作時（pull、import、sync）。
**Lesson:**
- Pull 只取 agent 端的 body，保留 canonical 原有的 frontmatter。直接整檔覆寫會丟失 `agents`、`agentFields` 等 canonical-only 欄位。
- Import 從 agent 目錄複製時，agent-specific 附屬檔案（如 `agents/openai.yaml`）應解析後存入 `agentFields` metadata，然後從 canonical 目錄刪除，不該以原始檔案形式殘留。
- `semantic_hash` 對整個檔案（frontmatter + body）算 hash，agent 端 frontmatter 與 canonical 不同 → 即使 body 相同 hash 也不同。pull 後存的 hash 應基於 agent 端原始內容，才能讓下次 drift scan 正確比對。
- `copy_bundled_siblings` 是通用複製，需要在其後由 agent-specific 清理邏輯移除已解析的附屬檔案。
**Keywords:** canonical, agent, skill, frontmatter, body, pull, import, format, hash, drift, bundled siblings, openai.yaml

---

## Hub 定位與已安裝判定：一次性來源，directory hash 比對
**ID:** kb-architecture-hub-install-identity
**Date:** 2026-06-05
**Updated:** 2026-06-05
**Status:** active
**Confidence:** confirmed
**Source:** Session 1 (2026-06-05) handoff; local-skill-market-prototype change 設計討論
**Context:** Hub 頁面需要判定 market skill 是否已安裝於本地。先嘗試 `x_felina_hub_id` frontmatter origin marker 方案，被使用者指出邏輯漏洞後收斂。
**Applies when:** 設計 Hub/marketplace 與 local skill 之間的關聯、判定、同步機制時。
**Lesson:**
- Hub 定位 = 公司內部 Skill 分享平台，安裝 = 複製一份到 local，之後各自獨立。不存在同步關係——Hub 不是 Git remote，不做 pull/push/drift。
- 不使用 origin marker（如 `x_felina_hub_id` 注入 frontmatter）：(a) 安裝後使用者修改了 skill，marker 還在但內容已不同，「已安裝」狀態誤導；(b) marker 會汙染 frontmatter，出現在 Skill page 內容顯示和 fan-out target 匯出中；(c) Hub 與 local 可能同名但不同 skill，marker-based 比對不能用 name，最終又回到需要比對內容。
- 正確方案：`directory_hash` = SHA-256(semantic_hash(SKILL.md) + sorted sibling hashes)。Server 端上傳時算 hash 回傳 `contentHash`；安裝時寫 hash 到 sync-meta `directoryHash`；Hub 頁面以 name + hash 雙重比對：同名 + hash 相同 → 「已是最新」，其餘 → 「安裝」。
- `directoryHash` 必須在安裝時和 save 時都更新，否則本地修改後 hash 過期會誤顯示「已是最新」。
- hash 範圍是整個 skill 目錄（SKILL.md + sibling files），不只 SKILL.md——否則 sibling 有差異時會誤判。
**Keywords:** hub, marketplace, install, identity, origin marker, directory hash, semantic hash, sibling, content hash, sync-meta, x_felina_hub_id
**Related:** kb-architecture-skill-source-of-truth, kb-dev-docs-hash-migration-sidecar
