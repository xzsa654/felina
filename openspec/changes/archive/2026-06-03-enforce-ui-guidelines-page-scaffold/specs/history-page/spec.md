## ADDED Requirements

### Requirement: Glassmorphism List Styles

The History page's session list SHALL NOT use hardcoded solid borders (such as `border-l-2` or `border-r-2`) or fully solid background colors to indicate active or hovered states. Instead, they SHALL use glassmorphism techniques (e.g., `backdrop-blur-md`, subtle semi-transparent background colors, and low-opacity borders) to allow the underlying application background grid animations to remain visible.

#### Scenario: User hovers over a list item

- **WHEN** the user hovers over a session in the History list
- **THEN** the item SHALL display a semi-transparent glassmorphism background
- **AND** the item SHALL NOT display a solid border

#### Scenario: User selects a list item

- **WHEN** the user selects a session
- **THEN** the active item SHALL display a brighter semi-transparent background and a subtle border to distinguish it from the hover state
- **AND** the active item SHALL NOT use thick solid left/right borders
