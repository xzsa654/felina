## MODIFIED Requirements

### Requirement: Markdown Preview Toggle

The Content tab SHALL provide three view modes: Edit (editor only, default), Preview (rendered preview only), and Split (side-by-side editor and preview). The user SHALL be able to switch between modes via a button group. The Split mode SHALL only be available when the Content area container width is at least 768 pixels; when the container is narrower, the Split button SHALL be disabled. If the user is in Split mode and the container shrinks below 768 pixels, the system SHALL automatically fall back to Edit mode.

In Split mode, the editor and preview SHALL each occupy 50% of the horizontal space, separated by a vertical border. Each side SHALL scroll independently.

#### Scenario: Three mode buttons visible

- **WHEN** the Content tab is active
- **THEN** the mode selector shows Edit, Preview, and Split buttons

#### Scenario: Split mode disabled on narrow container

- **GIVEN** the Content area container width is 600 pixels
- **WHEN** the user views the mode selector
- **THEN** the Split button is disabled with reduced opacity
- **AND** Edit and Preview buttons remain functional

#### Scenario: Split mode renders side-by-side

- **GIVEN** the container width is 900 pixels
- **WHEN** the user selects Split mode
- **THEN** the left half shows the textarea editor
- **AND** the right half shows the rendered MarkdownPreview
- **AND** a vertical border separates them

#### Scenario: Auto fallback on resize

- **GIVEN** the user is in Split mode
- **WHEN** the container is resized below 768 pixels
- **THEN** the mode automatically switches to Edit

#### Scenario: Edit and Preview always available

- **GIVEN** any container width
- **WHEN** the user switches between Edit and Preview
- **THEN** the switch works regardless of container width
