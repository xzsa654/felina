# skill-content-markdown-preview Specification

## Purpose

Define Markdown preview behavior for canonical skill content and agent-side target inspection surfaces.

## Requirements

### Requirement: Skill Markdown Preview

The system SHALL provide a Markdown preview mode for skill content to enhance readability. This preview mode SHALL be available in both the Skill Editor main content area and the Sync Target inspection modal. The preview mode SHALL render the Markdown text using the existing application Markdown rendering component.

#### Scenario: Toggling preview in Skill Editor

- **WHEN** a user opens a skill in the Skill Editor
- **THEN** the editor SHALL provide a toggle between "Edit" and "Preview" modes for the Markdown body
- **AND WHEN** the user selects "Preview"
- **THEN** the raw Markdown text SHALL be rendered as formatted HTML

#### Scenario: Default preview in Sync Target modal

- **WHEN** a user opens the Sync Target inspection modal
- **THEN** the skill content SHALL be rendered in Markdown preview mode by default
- **AND** the modal SHALL provide a toggle to view the raw source if desired

##### Example: Markdown rendering

- **GIVEN** a skill contains a Markdown table and bold text
- **WHEN** the user switches to Preview mode
- **THEN** the text is rendered as an HTML table and bold `<strong>` text instead of raw `|` and `**` characters

---
### Requirement: Source Map Line Attribution

The MarkdownPreview component SHALL use a custom marked renderer that injects a `data-source-line` attribute on every block-level HTML element (heading, paragraph, code block, list, table, blockquote, horizontal rule). The attribute value SHALL be the 1-based line number of the corresponding token's start position in the original Markdown source text. Inline-level elements (emphasis, links, inline code) SHALL NOT receive source line attributes.

#### Scenario: Block elements receive source line attributes

- **WHEN** MarkdownPreview renders Markdown content in any mode (Preview or Split)
- **THEN** each block-level HTML element in the rendered output SHALL have a `data-source-line` attribute matching its source line number

##### Example: Heading and paragraph attribution

- **GIVEN** Markdown input with a heading at line 1 and a paragraph at line 3
- **WHEN** the content is rendered
- **THEN** the output contains `<h1 data-source-line="1">...</h1>` and `<p data-source-line="3">...</p>`

##### Example: Code block attribution

- **GIVEN** Markdown input with a fenced code block starting at line 5
- **WHEN** the content is rendered
- **THEN** the output contains `<pre data-source-line="5"><code>...</code></pre>`


<!-- @trace
source: skill-editor-split-sourcemap
updated: 2026-06-01
code:
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/assets/antigravity.png
  - src/lib/i18n/locales/en.ts
  - tests/loader.mjs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/components/skills/sync-status-utils.ts
  - .session/agent-skill-market-complete.md
  - src/lib/components/skills/TargetPopover.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/assets/codex.png
  - src/lib/components/skills/SyncInfoBar.tsx
  - src/lib/assets/claude.svg
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/utils/markdown-source-map.ts
  - src-tauri/src/lib.rs
  - .session/product-backlog.md
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - .session/skill-editor-ui-adjustment-report.md
tests:
  - tests/sync-status-utils.test.ts
  - tests/markdown-source-map.test.ts
-->

---
### Requirement: Split View Source Map Scroll Sync

In Split view mode, the system SHALL synchronize scrolling between editor and preview using source line mapping instead of proportional scroll position. When the editor scrolls, the system SHALL determine the topmost visible source line number, find the preview DOM element with the nearest `data-source-line` attribute, and scroll that element into view. When the preview scrolls, the system SHALL perform the reverse mapping to scroll the editor to the corresponding source line. The system SHALL use requestAnimationFrame and a syncingScroll guard flag to prevent circular scroll events.

#### Scenario: Editor-to-preview scroll sync via source map

- **WHEN** the user scrolls the editor in Split view
- **THEN** the preview SHALL scroll to the block element whose `data-source-line` is nearest to the editor's topmost visible line

##### Example: Scrolling to a heading

- **GIVEN** the editor viewport's top line is line 25
- **AND** the preview has elements with data-source-line values [1, 5, 12, 24, 30]
- **WHEN** the scroll sync fires
- **THEN** the preview scrolls to the element with data-source-line="24" (nearest ≤ 25)

#### Scenario: Preview-to-editor reverse sync

- **WHEN** the user scrolls the preview in Split view
- **THEN** the editor SHALL scroll to the line number corresponding to the topmost visible `data-source-line` element in the preview

#### Scenario: Sync guard prevents circular events

- **WHEN** a programmatic scroll is triggered by sync logic
- **THEN** the opposing scroll handler SHALL NOT fire a reciprocal sync within the same animation frame

<!-- @trace
source: skill-editor-split-sourcemap
updated: 2026-06-01
code:
  - src-tauri/src/commands/agent_paths.rs
  - src/lib/assets/antigravity.png
  - src/lib/i18n/locales/en.ts
  - tests/loader.mjs
  - src/lib/components/skills/SkillEditor.tsx
  - src/lib/components/settings/AgentPathsSection.tsx
  - src/lib/components/shared/MarkdownPreview.tsx
  - src/lib/components/skills/TargetEditor.tsx
  - src/lib/components/skills/CoverageMatrix.tsx
  - src/lib/components/skills/TargetChips.tsx
  - src/lib/components/skills/sync-status-utils.ts
  - .session/agent-skill-market-complete.md
  - src/lib/components/skills/TargetPopover.tsx
  - src-tauri/src/commands/skill_import.rs
  - src/lib/assets/codex.png
  - src/lib/components/skills/SyncInfoBar.tsx
  - src/lib/assets/claude.svg
  - src/lib/components/skills/SkillsPage.tsx
  - src/lib/utils/markdown-source-map.ts
  - src-tauri/src/lib.rs
  - .session/product-backlog.md
  - src-tauri/src/commands/canonical_skills.rs
  - src/lib/components/skills/SkillList.tsx
  - src/lib/i18n/locales/zh-TW.ts
  - .session/skill-editor-ui-adjustment-report.md
tests:
  - tests/sync-status-utils.test.ts
  - tests/markdown-source-map.test.ts
-->