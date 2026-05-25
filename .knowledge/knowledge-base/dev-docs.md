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
