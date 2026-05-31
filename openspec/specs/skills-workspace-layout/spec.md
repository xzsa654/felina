# skills-workspace-layout Specification

## Purpose

TBD - created by archiving change 'resizable-skills-workspace'. Update Purpose after archive.

## Requirements

### Requirement: Resizable Skills Workspace

The skills workspace layout SHALL present the SkillEditor in a document-centric layout when editing an existing skill. The layout SHALL consist of a sticky Document Header (skill name as a large heading, description, and action buttons), a tab bar (Content and Settings), and a scrollable content area below.

The Document Header SHALL display the skill name as a large, non-editable heading. When creating a new skill, the name field SHALL be an editable input styled to match the heading appearance. The description SHALL appear directly below the name as a subdued-color editable textarea without visible borders. Action buttons (Save, Rename, Delete, Cancel) SHALL be positioned at the right side of the name row.

The tab bar SHALL provide Content and Settings tabs using the project's existing underline tab style. The Content tab SHALL contain the Markdown body editor with edit/preview toggle. The Settings tab SHALL contain Agent Fields and Advanced Extras sections, displayed without a collapse toggle since tab isolation makes collapsing redundant.

The Document Header and tab bar SHALL be sticky (fixed at the top of the editor panel) while the content area scrolls independently.

When the editor is in broken raw mode (YAML parse failure), the Document Header and tab bar SHALL be hidden, showing only the error-styled action bar and full-width raw textarea.

When the editor has unsaved changes, a dirty indicator SHALL appear next to the skill name.

#### Scenario: Existing skill displays document header

- **WHEN** the user selects an existing skill in the skill list
- **THEN** the editor displays the skill name as a large heading
- **AND** the description appears below as subdued text
- **AND** Save, Rename, and Delete buttons appear at the right of the name row

#### Scenario: New skill displays editable name

- **WHEN** the user starts creating a new skill
- **THEN** the name field is an editable input styled as a large heading
- **AND** Cancel and Save buttons appear in the action bar

#### Scenario: Tab switching between Content and Settings

- **WHEN** the user clicks the Settings tab
- **THEN** the Markdown body editor is hidden
- **AND** Agent Fields and Advanced Extras sections are displayed

#### Scenario: Sticky header during scroll

- **WHEN** the content area has enough content to scroll
- **THEN** the Document Header and tab bar remain fixed at the top
- **AND** only the content below the tab bar scrolls

#### Scenario: Broken raw mode hides tabs

- **WHEN** a skill has broken YAML frontmatter
- **THEN** the Document Header and tab bar are not rendered
- **AND** only the error action bar and raw textarea are shown

#### Scenario: Dirty indicator appears on unsaved changes

- **WHEN** the user modifies the description or body without saving
- **THEN** a dirty indicator appears next to the skill name
- **AND** the indicator disappears after saving


<!-- @trace
source: skill-editor-document-header
updated: 2026-06-01
code:
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/i18n/locales/en.ts
-->

---
### Requirement: Collapsible Skill List

The Skill List pane SHALL be collapsible. When the pane is resized below its minimum display width or when explicitly toggled, it SHALL collapse entirely, allowing the Skill Editor to consume the full available horizontal space.

#### Scenario: User collapses the list by dragging

- **WHEN** the user drags the resize boundary to the left past the minimum width threshold
- **THEN** the Skill List SHALL collapse
- **AND** the Skill Editor SHALL expand to fill the remaining width


<!-- @trace
source: resizable-skills-workspace
updated: 2026-05-29
code:
  - .knowledge/_catalog.json
  - src-tauri/Cargo.toml
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/snapshot.rs
  - src/lib/stores/navigation.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/mod.rs
  - package.json
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/architecture.md
  - .session/product-backlog.md
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - .knowledge/knowledge-base/_index.json
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/canonical_skills.rs
  - tsconfig.json
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/ResizableHandle.tsx
tests:
  - src/lib/stores/navigation.test.ts
-->

---
### Requirement: Persistent Layout Preferences

The system SHALL persist the user's customized layout sizes. When the user resizes the panes and later navigates away or reloads the application, the system SHALL restore the previously set pane dimensions.

#### Scenario: Layout width is restored on reload

- **GIVEN** the user has resized the Skill List to occupy 40% of the screen width
- **WHEN** the user reloads the application and navigates to the Skills page
- **THEN** the Skill List SHALL still occupy 40% of the screen width

<!-- @trace
source: resizable-skills-workspace
updated: 2026-05-29
code:
  - .knowledge/_catalog.json
  - src-tauri/Cargo.toml
  - src/lib/components/skills/TargetEditor.tsx
  - .knowledge/knowledge-base/dev-docs.md
  - src-tauri/src/commands/snapshot.rs
  - src/lib/stores/navigation.ts
  - src/lib/components/skills/SkillsPage.tsx
  - src-tauri/src/commands/mod.rs
  - package.json
  - src/lib/tauri/commands.ts
  - src/lib/types/index.ts
  - src/lib/types/skills.ts
  - .knowledge/knowledge-base/architecture.md
  - .session/product-backlog.md
  - src/lib/components/layout/Sidebar.tsx
  - src/lib/i18n/locales/en.ts
  - .knowledge/knowledge-base/platform.md
  - src-tauri/src/commands/fan_out/mod.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/components/skills/PullConfirmDialog.tsx
  - .knowledge/knowledge-base/_index.json
  - src/lib/i18n/locales/zh-TW.ts
  - src-tauri/src/commands/canonical_skills.rs
  - tsconfig.json
  - src/lib/components/layout/QuickSettingsPopover.tsx
  - src-tauri/src/commands/skill_import.rs
  - src-tauri/src/lib.rs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/skills/ResizableHandle.tsx
tests:
  - src/lib/stores/navigation.test.ts
-->

---
### Requirement: Target Chips Metadata Row

The SkillEditor SHALL display a Target Chips row between the Description and the tab bar when editing an existing skill. The row SHALL NOT appear when creating a new skill. Each target SHALL be rendered as a compact chip displaying agent, scope, and mode. Clicking a chip SHALL expand the full TargetEditor inline. A plus button at the end of the chip row SHALL open the AddTargetDialog.

#### Scenario: Chips display target summary

- **GIVEN** a skill with two targets (Anthropic global auto, Gemini project manual)
- **WHEN** the user selects the skill
- **THEN** two chips appear: one showing "anthropic · global · auto" and one showing "gemini · project · manual"

#### Scenario: Chip click expands full editor

- **WHEN** the user clicks any target chip
- **THEN** the compact chip row is replaced by the full TargetEditor with mode toggles, action buttons, and drift status

#### Scenario: Collapse returns to chips

- **WHEN** the user collapses the expanded TargetEditor
- **THEN** the full editor is hidden and the compact chip row reappears

#### Scenario: Plus button opens add dialog

- **WHEN** the user clicks the plus button at the end of the chip row
- **THEN** the AddTargetDialog opens

#### Scenario: New skill hides chips

- **WHEN** the user is creating a new skill
- **THEN** the Target Chips row is not rendered

#### Scenario: Expanded editor has height limit

- **WHEN** the TargetEditor is expanded and has many targets
- **THEN** the expanded area is constrained to a maximum height with internal scrolling

<!-- @trace
source: skill-editor-target-chips
updated: 2026-06-01
code:
  - .session/projects-page-ui-adjustment-report.md
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/components/skills/TargetChips.tsx
  - .session/skill-editor-ui-adjustment-report.md
  - src/lib/i18n/locales/zh-TW.ts
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/i18n/locales/en.ts
-->