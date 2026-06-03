# shared-modal-primitive Specification

## Purpose

TBD - created by archiving change 'extract-shared-modal-component'. Update Purpose after archive.

## Requirements

### Requirement: Modal primitive SHALL portal to document.body

The Modal primitive SHALL render its content via `createPortal` into `document.body` when `open` is true, and SHALL render nothing when `open` is false.

#### Scenario: Modal opens

- **WHEN** a caller renders `<Modal open={true} onClose={...}>...</Modal>`
- **THEN** the Modal content appears as a direct child of `document.body`, not in the caller's DOM tree position

#### Scenario: Modal stays closed

- **WHEN** a caller renders `<Modal open={false} onClose={...}>...</Modal>`
- **THEN** no Modal content is mounted to the DOM and `document.body.style.overflow` is not modified


<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->

---
### Requirement: Modal primitive SHALL close on Escape and overlay click

The Modal primitive SHALL invoke `onClose` when the user presses the `Escape` key while the Modal is open, and SHALL invoke `onClose` when the user clicks the overlay region outside the Modal content.

#### Scenario: Escape key closes Modal

- **WHEN** the Modal is open and the user presses `Escape`
- **THEN** the `onClose` callback is invoked exactly once

#### Scenario: Overlay click closes Modal

- **WHEN** the Modal is open and the user clicks on the backdrop region outside the Modal content
- **THEN** the `onClose` callback is invoked exactly once

#### Scenario: Click inside content does not close Modal

- **WHEN** the Modal is open and the user clicks inside the Modal content area
- **THEN** `onClose` is not invoked


<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->

---
### Requirement: Modal primitive SHALL lock body scroll while open

The Modal primitive SHALL set `document.body.style.overflow` to `hidden` while open, and SHALL restore the prior value when closed or unmounted.

#### Scenario: Body scroll locked while open

- **WHEN** the Modal mounts with `open={true}`
- **THEN** `document.body.style.overflow` becomes `hidden`

#### Scenario: Body scroll restored on close

- **WHEN** the Modal transitions from `open={true}` to `open={false}` or unmounts
- **THEN** `document.body.style.overflow` is restored to the value it held before the Modal opened


<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->

---
### Requirement: Modal primitive SHALL trap focus while open

The Modal primitive SHALL move keyboard focus into the Modal content on open, SHALL cycle focus within the Modal when the user presses `Tab` or `Shift+Tab` at the focus boundary, and SHALL NOT programmatically return focus to the previously-focused trigger element on close.

#### Scenario: Initial focus moves into Modal

- **WHEN** the Modal opens
- **THEN** keyboard focus moves to the first text-entry input or textarea inside the Modal content; if none exists, focus moves to the Modal container itself (which has `tabindex="-1"` and suppressed outline) so the dialog does NOT visually display a focus ring on a non-input element

#### Scenario: Tab cycles forward at last focusable

- **WHEN** the Modal is open, focus is on the last focusable element, and the user presses `Tab`
- **THEN** focus moves to the first focusable element inside the Modal

#### Scenario: Shift+Tab cycles backward at first focusable

- **WHEN** the Modal is open, focus is on the first focusable element, and the user presses `Shift+Tab`
- **THEN** focus moves to the last focusable element inside the Modal

#### Scenario: Focus is not returned on close

- **WHEN** the Modal closes
- **THEN** the Modal MUST NOT call `.focus()` on the previously-focused trigger element; focus falls naturally to `document.body` as the focused Modal descendant unmounts. Rationale: programmatic `.focus()` on a trigger button is not reliably suppressed by `:focus-visible` under Chromium's modality heuristic, producing a visible focus ring on mouse-opened dialogs (user-reported regression). Keyboard users can re-Tab from `document.body`.


<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->

---
### Requirement: Modal primitive SHALL accept open, onClose, title, size, and children

The Modal primitive SHALL expose a single React component default-exported from `src/lib/components/shared/Modal.tsx` accepting the props `open` (boolean, required), `onClose` (function, required), `title` (string, optional), `size` (`"sm"` | `"md"` | `"lg"`, optional, default `"md"`), and `children` (ReactNode, required).

#### Scenario: Title prop renders default header

- **WHEN** a caller passes a non-empty `title` prop
- **THEN** the Modal renders a header containing the title text and a close button (X icon) that invokes `onClose` when clicked

#### Scenario: Title prop omitted

- **WHEN** a caller does not pass `title`
- **THEN** the Modal renders only the `children` content with no default header

#### Scenario: Size prop maps to width

- **WHEN** a caller passes `size`
- **THEN** the Modal content container width matches the size mapping

##### Example: size mapping

| size  | content width |
| ----- | ------------- |
| "sm"  | w-96          |
| "md"  | w-[36rem]     |
| "lg"  | w-[48rem]     |
| (none)| w-[36rem]     |


<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->

---
### Requirement: Migrated dialogs SHALL use the Modal primitive instead of inline portal or backdrop boilerplate

Every dialog component listed in the proposal Impact section SHALL render through the Modal primitive and SHALL NOT directly use `createPortal`, `fixed inset-0` overlay markup, or hand-rolled `keydown` Escape listeners for dialog dismissal.

#### Scenario: Migrated dialog renders through Modal

- **WHEN** a migrated dialog component is rendered with its open state true
- **THEN** the dialog's overlay, portal, Escape handling, click-outside, scroll lock, and focus management are provided by the Modal primitive, and the dialog source no longer references `createPortal`, `fixed inset-0` for its backdrop, or `addEventListener("keydown", ...)` for Escape dismissal

#### Scenario: Non-modal overlays are excluded

- **WHEN** Sidebar (mobile drawer), CommandPalette, TargetPopover, or ContributionGraph tooltip is rendered
- **THEN** these components retain their existing overlay implementation and do not use the Modal primitive

<!-- @trace
source: extract-shared-modal-component
updated: 2026-06-03
code:
  - GEMINI.md
  - src/lib/components/skills/SkillImportWizard.tsx
  - .session/product-backlog.md
  - src/app.css
  - src/lib/components/skills/AddTargetDialog.tsx
  - src/lib/components/skills/CreateSkillDialog.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - src/lib/components/skills/RenameSkillDialog.tsx
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/shared/InfoDialog.tsx
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/SyncPreviewDialog.tsx
  - src/lib/components/shared/OnboardingWelcome.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/projects/ManagedInventory.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/ConfirmDialog.tsx
  - src/lib/components/shared/Modal.tsx
  - src/lib/components/skills/import/ImportStagingDialog.tsx
  - src/lib/components/skills/DeletePolicyDialog.tsx
-->