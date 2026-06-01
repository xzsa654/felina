## ADDED Requirements

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
