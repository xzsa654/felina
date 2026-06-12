# Dev Docs

Conventions, workflows, UI consistency rules, and reusable design-time checklists for Felina.

---

## Page layout scaffold height contract (PageHeader + PageBody)
**ID:** kb-react-pagebody-layout
**Date:** 2026-05-22
**Updated:** 2026-05-22
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-05-22 fixing Skills page bottom-border clipping
**Context:** Page bottom border / last content row was clipped under the viewport even after per-panel scrollbars worked.
**Applies when:** Building or debugging any routed page that uses `PageScaffold`'s `PageHeader` + `PageBody`, or any full-height internal-scroll layout.
**Lesson:**
- A routed page renders as `<PageHeader /> + <PageBody />` siblings inside the router Outlet wrapper (`src/router.tsx`). That wrapper MUST be `flex flex-col min-h-0` for the height math to work.
- `PageBody` uses `flex-1 min-h-0`, NOT `h-full`. With `h-full`, PageBody is sized to 100% of the container while PageHeader also consumes space above it → total exceeds the container → the bottom (~one header height) is clipped by the parent's `overflow-hidden`.
- For two-column internal-scroll layouts: grid is `flex-1 min-h-0`, and EACH panel gets its own `overflow-y-auto`. Do not rely on the whole `PageBody` scrolling.
- Diagnostic heuristic: if scrollbars work but a panel's bottom border is invisible, the height math is wrong — look for a `h-full` element that is a sibling of a fixed-height header inside an `overflow-hidden` parent.
**Keywords:** layout, flexbox, h-full, flex-1, min-h-0, overflow-hidden, PageBody, PageScaffold, scroll, clipping, tailwind
**Related:** kb-ui-consistency-design

## UI consistency design-time checklist
**ID:** kb-ui-consistency-design
**Date:** 2026-05-22
**Updated:** 2026-05-22
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-05-22 — multiple UI consistency drifts surfaced during smoke (window.confirm, inline error tile, non-full-width controls, layout clip)
**Context:** A UI-touching change drifted from existing patterns because the design did not enumerate reusable components and layout invariants upfront.
**Applies when:** Designing (design.md) any change that adds or modifies UI pages/components.
**Lesson:**
- design.md for UI-touching changes should carry a short "UI Consistency / Component Reuse" section with two parts: (1) the shared components to reuse with file paths, (2) the layout invariants.
- Reuse shared components instead of rebuilding: `shared/ConfirmDialog` (confirm/alert modals), `shared/PageScaffold` (`PageHeader`/`PageBody`), the established modal pattern (`fixed inset-0 z-50` + backdrop + centered card).
- Do NOT use browser-native `window.confirm` / `window.alert` — they clash with the app's visual style. Route through `shared/ConfirmDialog`.
- Error display rule: blocking / must-acknowledge errors → modal (non-clickable backdrop, explicit OK); non-blocking success/info → inline banner.
- Form controls default to `w-full` so they fill their container; add `resize-y` for tall textareas.
- Treat the above as a design-review checklist — catching drift at design time is cheaper than fixing each instance after apply.
**Keywords:** ui consistency, design review, ConfirmDialog, window.confirm, modal, inline error, w-full, component reuse, design.md
**Related:** kb-react-pagebody-layout

## Identity migration: storage key first, display lags behind
**ID:** kb-frontend-identity-migration-display-vs-storage
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** session entry 2026-05-25 (harden-skill-import-frontmatter-validation S9)
**Context:** When migrating a UI/backend identity key across multiple consuming surfaces (e.g. parsed YAML `name` → canonical directory `name` for Skills), it is tempting to flip both storage and display in a single pass.
**Applies when:** Any change that introduces a new "true identity" alongside an existing display identity (rename, scope-move, identity-normalization, alias migration), and multiple UI surfaces consume the same entity (e.g. editor + list + projects-view + deep-links).
**Lesson:**
- Flip storage key first across all backend write paths (write, sync-meta keying, fan-out folder, sidecar lookup, delete, target mutation). This is the durable part — once on disk, it's the invariant future code relies on.
- Display key lags storage. Until every consuming surface (every list/grid/inventory/deep-link source) is ready to render the new identity, keep display on the legacy key so the user sees one consistent label across views.
- A mid-migration state where storage = canonical but one editor renders `canonicalId` while another inventory renders `parsed name` produces "is this one skill or two?" UX confusion. Don't ship that.
- Decouple cleanly in code: take a `dirName = isNew ? userInput : entity.canonicalId` for storage, but render `entity.displayName` for the disabled name input. The mismatch can heal naturally on next save once normalization is in place backend-side.
- Schedule a follow-up display unification only after all UI surfaces opt in. Capture it in the change's `Non-Goals` so it's not forgotten.
**Keywords:** identity migration, canonical id, display vs storage, rename, scope migration, UI consistency, skill identity, alias
**Related:** kb-ui-consistency-design

## Async child save handler must not mutate store before parent onSaved
**ID:** kb-react-async-save-store-race
**Date:** 2026-05-25
**Updated:** 2026-05-25
**Status:** active
**Confidence:** confirmed
**Source:** session entry 2026-05-25 (raw-repair placeholder bug, S9 Blocker fix)
**Context:** A child component's async save handler called a Zustand store-mutation function (`loadEntries`) before invoking the parent's `onSaved` callback. The store change re-triggered a parent `useEffect` whose `cancelled`-flag cleanup path raced with `onSaved`'s own state updates, leaving the page in a placeholder state instead of showing the saved entity.
**Applies when:** React + Zustand (or any external store). Child component takes an `onSaved` prop and also has direct access to a store mutator. Parent has `useEffect(..., [storeState, selection])` that drives the visible render.
**Lesson:**
- Don't let the child save handler call store mutators. The child's job is `await backendCall(...)` then `onSaved(result)`. Let the parent orchestrate side effects.
- In the parent's `onSaved` callback, run state updates **before** the store refresh: `read(name) → setLocalState(repaired) → setBrokenRaw(null) → setSelectedName(name)` first, then `await loadEntries()` last. This way the React render commits the new visible state, then the store mutation triggers a re-run of dependent effects against state that is already correct.
- Diagnostic signal: if a placeholder/empty render appears intermittently after a successful save, suspect a parent `useEffect` whose cleanup or cancellation path runs `setState(null)` while a competing async update is in flight. Look for `let cancelled = false` patterns combined with `return () => { cancelled = true; }`.
- A loud workaround (extra `try { read } catch { setBoth(null) }` in the effect) hides the race instead of fixing it. The fix is reordering the calls so the local-state commit precedes the store mutation.
**Keywords:** react, zustand, useEffect, async save, race condition, cancelled flag, store mutation, parent-child callback, placeholder bug, loadEntries
**Related:** kb-react-pagebody-layout

---

## Drift cancel 不是 failure：dirty flag 語意
**ID:** kb-fan-out-drift-cancel-not-failure
**Date:** 2026-05-28
**Updated:** 2026-05-28
**Status:** active
**Confidence:** confirmed
**Source:** Session 8 / commit b9bc2e4
**Context:** `skill_sync_commit` 對 blockedDrift target 的 Cancel resolution 被錯誤計為 `any_failure=true`，導致部分 push 後 dirty 永遠不清除。
**Applies when:** 修改 fan-out push/commit 邏輯中 dirty flag 判定，或新增 resolution 類型時。
**Lesson:**
- Cancel 是使用者主動決策（「我不想現在處理這個 drift target」），不是系統錯誤。不應計入 `any_failure`。
- dirty flag 的正確語意 = 「canonical 有改動尚未推出到任何 target」，由 `last_sync` 存在性檢查保證（第 550-556 行）：所有 enabled+tracked targets 都有 `last_sync` 記錄 → dirty=false。
- `any_failure` 應僅用於真正的系統錯誤（寫入失敗、路徑解析失敗），不用於使用者有意識的跳過。
**Keywords:** fan-out, dirty flag, drift, cancel, any_failure, skill_sync_commit, push, resolution
**Related:** kb-architecture-skill-source-of-truth

---

## Hash 演算法變更必須同步遷移 sidecar
**ID:** kb-dev-docs-hash-migration-sidecar
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** drift-detection-and-conflict-ui session — semantic-hash false positive 根因定位
**Context:** `semantic-hash-refactor` 將 `pushed_hash` 從 raw `sha256_hex` 改為 `semantic_hash`，但未遷移既有 sidecar，導致 drift scan 全部 false positive。
**Applies when:** 修改任何用於比對/drift 偵測的 hash 演算法、序列化格式、或正規化邏輯時
**Lesson:**
- 改變 hash 計算方式後，既有 sidecar（`.felina-sync-meta.json`）裡的 `pushed_hash` 仍是舊格式，新舊不匹配 → 所有比對結果都是 Drifted
- Push preview 不受影響（兩邊都用新演算法即時計算），但任何「拿存儲值比對即時值」的路徑都會壞
- 解法：要嘛在 change 中加遷移邏輯（讀取時偵測舊格式並升級），要嘛接受一次性 Push All + Override 重寫全部 sidecar
- 不加 legacy 兼容是合理選擇（使用者量小、一次性操作成本低），但必須在 change 文件中明確記載遷移步驟
**Keywords:** hash, migration, sidecar, pushed_hash, semantic_hash, drift, false positive, sync-meta
**Related:** kb-dev-docs-dirty-flag-cancel-drift

---

## @dnd-kit + React 19: 需要 skipLibCheck
**ID:** kb-dev-docs-dndkit-react19-skiplibcheck
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** customizable-sidebar-order 實作 — tsc --noEmit 在 node_modules 報 JSX namespace 錯誤
**Context:** `@dnd-kit/core` 和 `@dnd-kit/sortable` 的 `.d.ts` 使用 `JSX.Element`（全域 namespace），但 React 19 移到 `React.JSX.Element`，導致 `tsc --noEmit` 報 `Cannot find namespace 'JSX'`。
**Applies when:** 在 React 19 + TypeScript strict 專案中使用 `@dnd-kit` 或其他未更新 JSX 型別的第三方 React library 時。
**Lesson:**
- 這是 library 端的已知問題（@dnd-kit 尚未發布 React 19 相容的型別更新）
- 解法：在 `tsconfig.json` 加 `"skipLibCheck": true`，跳過 `node_modules` 內 `.d.ts` 的型別檢查
- `skipLibCheck` 是 React 生態的常見做法，不影響專案自身程式碼的型別安全
- 不要試圖 patch node_modules 或加 `declare namespace JSX`——等 library 更新即可
**Keywords:** dnd-kit, react 19, jsx, skipLibCheck, typescript, tsconfig, namespace

---

## Option\<T\> vs T + serde(default) 區分 legacy 與空值
**ID:** kb-rust-serde-option-vs-default
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** sibling-drift-detection change, Session 11
**Context:** 擴展 `LastSyncEntry` 加入 `sibling_hashes` 時，用 `BTreeMap` + `#[serde(default)]` + `skip_serializing_if = "is_empty"` 導致無法區分 legacy meta（欄位不存在）與 push 時確實沒有 sibling（空 map）
**Applies when:** 對既有 JSON schema 新增欄位，且「欄位不存在」與「欄位為空/零值」需要不同行為時
**Lesson:**
- `#[serde(default)]` 讓缺少的欄位反序列化為 `Default::default()`
- `skip_serializing_if = "is_empty"` 讓空值序列化時被省略
- 兩者組合使「欄位不存在」與「空值」在 round-trip 後無法區分
- 當兩種狀態有不同語意（如 legacy 跳過比對 vs 空值代表無 sibling 應偵測新增），用 `Option<T>` + `skip_serializing_if = "Option::is_none"`：`None` = legacy / 不存在、`Some(empty)` = 明確的空值
**Keywords:** serde, option, default, skip_serializing_if, backward compatibility, schema migration, json, rust

---

## Push preview 須考慮 SKILL.md 以外的檔案變動
**ID:** kb-fanout-push-preview-sibling-check
**Date:** 2026-05-29
**Updated:** 2026-05-29
**Status:** active
**Confidence:** confirmed
**Source:** sibling-drift-detection change, Session 11
**Context:** push preview 只比較 SKILL.md semantic hash 決定 NoOp/Overwrite。使用者在 canonical 端新增 sibling 檔案後，SKILL.md 沒變導致 preview 顯示 NoOp，`copy_bundled_siblings` 不執行，sibling 不被複製到 agent 端
**Applies when:** 修改 push/sync 流程、新增需要隨 push 同步的檔案類型、或評估 NoOp 快速路徑是否安全時
**Lesson:**
- `build_preview_for_skill` 的 NoOp 判斷不能只看 SKILL.md hash — 任何需要同步的檔案變動都應改為 Overwrite
- 解法：preview 時計算 canonical sibling hashes 與 `lastSync.siblingHashes` 比較，有差異則 operation 改為 Overwrite
- 同理，`canonical_skills_list` 載入時也需比較 canonical sibling，設 `dirty` + `siblingsDirty` 讓 push badge 出現
- 未來若有其他 push 附帶檔案（如 manifest），同樣需要加入 preview 比較
**Keywords:** push, preview, NoOp, sibling, copy_bundled_siblings, dirty, fan-out

---

## React Modal useEffect 不應依賴 inline callback
**ID:** kb-react-modal-useeffect-inline-callback
**Date:** 2026-06-08
**Updated:** 2026-06-08
**Status:** active
**Confidence:** confirmed
**Source:** Session 4 — hub-auth-install-safety e2e 測試時發現
**Context:** Modal 元件的 useEffect 依賴 `[open, onClose]`，呼叫端傳入 inline arrow function 作為 onClose，導致每次父元件 re-render 時 useEffect 重跑並 auto-focus 第一個 input
**Applies when:** 任何 Modal/Dialog 元件的 useEffect 有 auto-focus 邏輯且依賴 prop callback 時
**Lesson:**
- useEffect 中的 auto-focus 只應在 dialog 開啟時觸發，不應因 callback reference 變化而重跑
- 修法：用 useRef 保存 callback，useEffect 只依賴 `[open]`
- 症狀：使用者在非第一個 input 打字時，每輸入一個字元游標跳回第一個 input
**Keywords:** react, modal, useEffect, focus, inline callback, useRef, auto-focus

---

## Docker Compose restart 不重讀 .env
**ID:** kb-docker-compose-restart-env
**Date:** 2026-06-08
**Updated:** 2026-06-08
**Status:** active
**Confidence:** confirmed
**Source:** Session 4 — market-server JWT_SECRET 補設後 restart 無效
**Context:** `docker compose restart` 只重啟 container process，不重建 container，因此不會重讀 `.env` 或 `docker-compose.yml` 中的環境變數變更
**Applies when:** 修改 `.env` 或 `docker-compose.yml` 環境變數後需要生效時
**Lesson:**
- `docker compose restart` ≠ 重新載入環境變數，只是 stop + start 同一個 container
- 要讓 .env 變更生效，需要 `docker compose up <service> -d --force-recreate`
- 若 Dockerfile 或 source code 也改了，加 `--build`
**Keywords:** docker, compose, restart, env, force-recreate, environment variable

---

## SQL upsert COALESCE 處理 null 欄位接管
**ID:** kb-sql-upsert-coalesce-null-takeover
**Date:** 2026-06-08
**Updated:** 2026-06-08
**Status:** active
**Confidence:** confirmed
**Source:** Session 4 — market-server author 欄位 legacy null 無法被新 publish 覆寫
**Context:** `ON CONFLICT DO UPDATE` 刻意不覆蓋 author（保留原始發布者），但 legacy 資料 author=null 時，重新 publish 也無法填入 author
**Applies when:** upsert SQL 中有「保留原值、不覆蓋」的欄位，且該欄位可能為 null（legacy 資料）時
**Lesson:**
- `ON CONFLICT DO UPDATE` 省略某欄位 = 保留舊值，但舊值是 null 時等於永遠 null
- 修法：`author = COALESCE(skills.author, EXCLUDED.author)` — 有值保留，null 則接管
- 適用於任何「first-writer-wins but legacy has no writer」的場景
**Keywords:** sql, upsert, coalesce, null, on conflict, legacy data, author, ownership

---

## Fastify v5 register() 需 await
**ID:** kb-dev-docs-fastify-v5-await-register
**Date:** 2026-06-08
**Updated:** 2026-06-08
**Status:** active
**Confidence:** confirmed
**Source:** Session 5 — market-server-security-hardening，rate-limit plugin 完全不生效
**Context:** Fastify v5 的 `register()` 不 `await` 時 plugin 不會在 `inject()`/`ready()` 時自動 resolve，導致 plugin hooks 完全缺失
**Applies when:** 在 Fastify v5 專案中註冊 plugin（rate-limit、cors、multipart 等），且 `createApp` 為 sync function 時
**Lesson:**
- Fastify v4 允許 sync `register()` + `inject()` 自動觸發 `ready()` 來 resolve 所有 queued plugins；v5 不再如此
- 不 `await` 的 `register()` 在 v5 中 plugin 完全不生效：無 response headers、無 hooks、無 decorators
- 修法：`createApp` 改為 `async function`，每個 `fastify.register(plugin, opts)` 前加 `await`
- 所有 caller（server.js、test files）必須同步改為 `await createApp()`
**Keywords:** fastify, v5, register, await, plugin, rate-limit, breaking change, async

## Error display convention: ErrorNotice, no window.alert
**ID:** kb-frontend-error-display
**Date:** 2026-06-11
**Updated:** 2026-06-11
**Status:** active
**Confidence:** confirmed
**Source:** Spectra change shared-error-display (archived 2026-06-11, merge f711ad3)
**Context:** Error presentation was inconsistent across pages — window.alert (blocking, non-copyable) and bare String(e) renders without localized framing.
**Applies when:** Any frontend code path that surfaces a failure to the user (command invoke errors, query errors, dialog action failures).
**Lesson:**
- Use the shared `src/lib/components/shared/ErrorNotice.tsx`: localized title via t(locale, key) + verbatim backend error as detail (monospace, selectable, collapsible when long, danger semantic tokens only, non-blocking inline).
- `window.alert` is banned in `src/lib/components/` — normative requirement in `openspec/specs/shared-error-display/spec.md`; verify with grep (must stay zero).
- Pattern for call sites: `const [pageError, setPageError] = useState<{title; detail} | null>(null)` in the page, render `<ErrorNotice ... onDismiss />` near the top of content; in catch blocks use `setPageError({ title: t(locale, "<ns>.xxxFailed"), detail: String(e) })`.
- Backend error payloads stay verbatim in detail — never translate, parse, or truncate them.
- Sites still rendering String(e) inside styled blocks (ManagedInventory, SkillEditor, ImportStagingDialog, skills-store) are accepted leftovers; adopt ErrorNotice opportunistically when touching them.
**Keywords:** error, ErrorNotice, window.alert, i18n, verbatim, danger, inline error, toast
**Related:** kb-ui-consistency-design

## i18n verbatim boundary rulings
**ID:** kb-i18n-verbatim-boundary
**Date:** 2026-06-11
**Updated:** 2026-06-11
**Status:** active
**Confidence:** confirmed
**Source:** Spectra changes shared-error-display + memory-history-i18n (archived 2026-06-11)
**Context:** CLAUDE.md says user/system data stays verbatim, but several borderline cases needed explicit rulings during the Memory/History i18n migration.
**Applies when:** Adding i18n keys or migrating hardcoded UI text; deciding whether a string is translatable UI text or verbatim data.
**Lesson:**
- Verbatim (never translate): agent product names (Claude/Codex/Gemini), token metric tags in usage lines (input/output/cache/write/reasoning), session IDs, model names, paths, filenames, timestamps values, transcript/memory content, backend error payloads, memory_type enum values (user/feedback/project/reference).
- Translate: filter labels like "All", role labels (User/Agent), empty states, placeholders, button text, error titles.
- Number formatting: pass the active locale to formatNumber; numeric values must not change. Timestamps keep `toLocaleString(undefined, ...)` (system locale) — spec only mandates locale-aware numbers.
- Removing keys: when a migration orphans an i18n key, delete it from BOTH en.ts and zh-TW.ts in the same change (no deprecation residue); TranslationDict type enforces structural alignment.
**Keywords:** i18n, verbatim, locale, formatNumber, zh-TW, translation, TranslationDict
**Related:** kb-frontend-error-display

## React Query 遷移：key 重置不會保留舊 effect 的副作用
**ID:** kb-react-query-migration-side-effects
**Date:** 2026-06-12
**Updated:** 2026-06-12
**Status:** active
**Confidence:** confirmed
**Source:** Spectra change history-react-query-migration (archived 2026-06-12, merge 30e09fc)
**Context:** HistoryPage 手動資料層遷 useInfiniteQuery 時，舊 effect 在 filter/query 變更時除了重查列表，還順帶 setSelected(null)；query key 變更只會重置列表資料，不會重現這個副作用。
**Applies when:** 任何頁面把「手動 useEffect + useState 資料層」遷移到 React Query（Memory/Projects/Settings 等頁的後續遷移）。
**Lesson:**
- 遷移前先盤點舊載入 effect 裡「非資料」的副作用（清 selection、重置 scroll、關 editor 等）——key 變更只管資料重置，這些副作用會默默消失。
- 補回位置選互動 handler（如 filter 按鈕 onClick、搜尋框 onChange 加 setSelected(null)），不要另開 useEffect 監聽 filter 變化，避免回到手動狀態機。
- refresh-on-mount 類前置動作放進第一頁 queryFn（pageParam === 0 時 await refresh().catch(() => {})），不要獨立 mutation 協調順序。
- 命令式一次性副作用（如 revealSessionTranscript）維持 try/catch + 獨立 error state，不進 query。
**Keywords:** react-query, useInfiniteQuery, migration, side effect, selection, query key, refresh-on-mount
**Related:** kb-frontend-error-display

## URL 查詢參數編解碼交給 URLSearchParams，勿重複 decode
**ID:** kb-url-searchparams-encoding
**Date:** 2026-06-12
**Updated:** 2026-06-12
**Status:** active
**Confidence:** confirmed
**Source:** Spectra change memory-url-deep-link (archived 2026-06-12, merge 48b384c)
**Context:** tasks 寫「file 參數 encodeURIComponent/decodeURIComponent」，但 react-router useSearchParams 底層的 URLSearchParams.set/get 已做百分比編解碼。
**Applies when:** 任何頁面新增 URL deep-link / 查詢參數同步（含中文、空格、特殊字元的值）。
**Lesson:**
- params.set() 寫入時自動編碼、searchParams.get() 讀取時自動解碼；再手動 decodeURIComponent 會雙重解碼，含字面 % 的值會壞掉或丟 URIError。
- URL 更新集中在單一 helper（比照 TokensPage updateTokenSearchParams、MemoryPage updateMemorySearchParams）：next 值為 null 表示刪參數、undefined 表示不動。
- 還原走「列表就緒後一次性比對」模式（useRef flag），無命中靜默忽略維持預設狀態。
**Keywords:** URLSearchParams, useSearchParams, deep-link, encode, decode, double-decode, query params
**Related:** kb-react-query-migration-side-effects

## 多 skill 共用規則：schema 單一權威源 + 顯式角色差異
**ID:** kb-skills-dedupe-schema
**Date:** 2026-06-12
**Updated:** 2026-06-12
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-06-12（product-backlog→project-knowledge 遷移改 6 檔 + session-* dedupe 約 90 行）
**Context:** session-* 五個 skill 各自整段複製 Handoff Root Resolution / Quote-Trace / Concurrent Write Guard，schema 已有完整版仍重抄；遷移時要同步改 6 檔，且複本間已出現用詞 drift（無法分辨刻意特化 vs 抄寫漂移）。
**Applies when:** 兩個以上協作 skill（session-*、spectra-* 等）出現逐字或近逐字相同的規則段落時。
**Lesson:**
- 完整規則只存 schema 檔；schema 寫成涵蓋所有變體的「超集」（如 reader 讀 shared root 並回報 mismatch、writer 拒寫 worktree-local 副本同列）。
- 各 skill 只留：一行引用（Follow ## X in schema）+ 顯式標註的 skill 特有差異（如 session-start 的 source-label 自檢、session-handoff 的 lock 與 insertion script 互斥規則）。
- 純引用會丟角色差異、純複製會漂移——「超集 + 顯式差異」是關鍵中間態。
- 反例：真正 skill 特有的流程（claim Fast Path、handoff Session Entry Insertion）不抽，避免 schema 變成第二個大雜燴。
**Keywords:** skill, schema, dedupe, single source of truth, DRY, session skills, drift
**Related:** kb-workflow-backlog-ownership

## Backlog/Milestone 唯一權威：project-knowledge，session skills 只讀與委派
**ID:** kb-workflow-backlog-ownership
**Date:** 2026-06-12
**Updated:** 2026-06-12
**Status:** active
**Confidence:** confirmed
**Source:** session 2026-06-12（誤建 .session/product-backlog.md 後全面遷移，不留 fallback）
**Context:** session-* skills 原指向 .session/product-backlog.md，project-knowledge 另管 .knowledge/ideas-backlog.md，雙軌並存導致 OQ prune 時誤建錯誤檔案。
**Applies when:** 任何 skill 要新增/更新/移動 backlog 或 milestone 條目時；以及未來新 skill 設計涉及產品工作項儲存時。
**Lesson:**
- backlog = .knowledge/ideas-backlog.md、milestone = .knowledge/milestones.md，唯一管理者是 project-knowledge skill（--backlog add/update/promote、--milestone move/record）。
- 其他 skill 一律「讀取 + 委派」：不直寫檔案、不自持 lock；寫入走 project-knowledge 的 schema 驗證腳本（backlog_insert.py / backlog_move.py）。
- OQ prune 移入 → --backlog add；spectra archive 完成項 → --milestone move；claim 啟動 → --backlog update 設 active。
- 同責任不留雙軌路徑（fallback）：舊路徑殘留會在語義觸發時複活錯誤行為。
**Keywords:** backlog, milestone, project-knowledge, ideas-backlog, ownership, delegation, session skills
**Related:** kb-skills-dedupe-schema
