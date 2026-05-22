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
