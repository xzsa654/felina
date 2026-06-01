## ADDED Requirements

### Requirement: Agent Fields Collapsible Cards

The Settings tab SHALL display Agent Fields as per-agent collapsible cards stacked vertically. Each card SHALL show the agent name as a header with a collapse/expand toggle. Only agents whose skill has configured fields SHALL display a card; agents with no fields SHALL not render a card. Cards SHALL be expanded by default. The card visual style SHALL use subdued background with border (matching project design system).

#### Scenario: Cards rendered per agent with fields

- **GIVEN** a skill with Anthropic and Codex agent fields configured, but no Gemini fields
- **WHEN** the user opens the Settings tab
- **THEN** two cards appear: Anthropic and Codex, each expanded
- **AND** no Gemini card is rendered

#### Scenario: Collapse and expand a card

- **WHEN** the user clicks the Anthropic card header
- **THEN** the Anthropic card collapses, hiding its fields
- **AND** clicking again expands it back

#### Scenario: No agent fields renders empty state

- **GIVEN** a skill with no agent fields configured for any agent
- **WHEN** the user opens the Settings tab
- **THEN** no Agent Fields cards are rendered

### Requirement: Advanced Extras Card

The Settings tab SHALL display the Advanced Extras section in a styled card container. The card SHALL include an Add property button that appends a new empty key-value row. Input fields within the Settings tab SHALL have focus ring visual feedback.

#### Scenario: Add property button appends row

- **WHEN** the user clicks the Add property button
- **THEN** a new empty key-value row appears at the bottom of the extras list

#### Scenario: Focus ring on input fields

- **WHEN** the user focuses on any input field in the Settings tab
- **THEN** the input shows a ring highlight (accent color)
