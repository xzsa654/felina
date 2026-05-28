## ADDED Requirements

### Requirement: Draggable Sidebar Ordering

The system SHALL allow users to reorder the main navigation items in the Sidebar via drag-and-drop. The dragging interaction SHALL provide visual feedback indicating the new position of the item before it is dropped. 

#### Scenario: User reorders a navigation item

- **WHEN** the user presses and holds a navigation item in the Sidebar
- **AND** drags it to a new position in the list
- **THEN** the system SHALL animate the other items to show the drop position
- **WHEN** the user releases the item
- **THEN** the navigation list SHALL render in the new order

### Requirement: Order Persistence and Merging

The system SHALL persist the user's customized order of navigation items across application restarts. When loading the persisted order, the system SHALL reconcile it with the statically registered list of pages (`NAV_ITEMS`) to ensure that any newly added pages are appended to the bottom, and any removed pages are omitted.

#### Scenario: Order is preserved on reload

- **GIVEN** the user has dragged "Tokens" to be the first item in the Sidebar
- **WHEN** the user reloads the application
- **THEN** "Tokens" SHALL still appear as the first item

#### Scenario: Newly registered page is appended to custom order

- **GIVEN** the user has a customized order saved in persistence
- **AND** a developer adds a new page "Experiments" to the static `NAV_ITEMS` array
- **WHEN** the user loads the application
- **THEN** the custom order SHALL be maintained for existing items
- **AND** "Experiments" SHALL be appended to the bottom of the visible navigation list

#### Scenario: Removed page is omitted from custom order

- **GIVEN** the user has a customized order saved in persistence that includes "LegacyPage"
- **AND** a developer removes "LegacyPage" from the static `NAV_ITEMS` array
- **WHEN** the user loads the application
- **THEN** "LegacyPage" SHALL NOT appear in the visible navigation list
- **AND** the remaining items SHALL maintain their relative custom order
