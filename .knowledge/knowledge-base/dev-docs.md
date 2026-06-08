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
