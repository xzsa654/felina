# quick-settings-panel Specification

## Purpose

TBD - created by archiving change 'quick-settings-and-preferences'. Update Purpose after archive.

## Requirements

### Requirement: Quick Settings Popover

The Sidebar SHALL render a single gear icon button in its bottom controls area, replacing the separate theme toggle and language switcher controls. Clicking the gear button SHALL open a Quick Settings Popover positioned above the button. Clicking the gear button again or clicking outside the Popover SHALL close it.

#### Scenario: Gear button opens popover

- **WHEN** the user clicks the gear icon button in the Sidebar bottom area
- **THEN** a Quick Settings Popover SHALL appear above the button
- **AND** the Popover SHALL remain visible until explicitly closed

#### Scenario: Clicking outside closes popover

- **WHEN** the Quick Settings Popover is open and the user clicks outside of it
- **THEN** the Popover SHALL close

#### Scenario: Sidebar bottom shows single gear button

- **WHEN** the user views the Sidebar bottom controls area
- **THEN** only a single gear icon button SHALL be visible
- **AND** the separate language switcher and theme toggle buttons SHALL NOT be rendered directly in the Sidebar

---
### Requirement: Theme Selection

The Quick Settings Popover SHALL provide three mutually exclusive theme options: Dark, Light, and System. Selecting an option SHALL immediately apply the corresponding theme. When System is selected, the resolved theme SHALL follow the operating system preference via the `prefers-color-scheme` media query and SHALL update in real time when the OS preference changes. The selected theme preference SHALL be persisted to localStorage under the key `felina-theme`.

#### Scenario: User selects System theme

- **WHEN** the user selects "System" in the theme options
- **AND** the operating system is set to dark mode
- **THEN** the app SHALL apply the dark theme
- **AND** localStorage `felina-theme` SHALL store `"system"`

#### Scenario: OS preference changes while System theme is active

- **WHEN** the current theme preference is "system"
- **AND** the user changes the OS appearance from dark to light
- **THEN** the app SHALL switch to the light theme without user interaction

#### Scenario: User selects explicit Dark theme

- **WHEN** the user selects "Dark" in the theme options
- **THEN** the app SHALL apply the dark theme regardless of OS preference
- **AND** localStorage `felina-theme` SHALL store `"dark"`

---
### Requirement: Language Selection

The Quick Settings Popover SHALL provide language selection options for English (en) and Traditional Chinese (zh-TW). Selecting a language SHALL immediately switch all i18n-managed UI text to the selected locale.

#### Scenario: User switches language in popover

- **WHEN** the user selects "zh-TW" in the language options
- **THEN** all user-facing text managed by the i18n system SHALL render in Traditional Chinese

---
### Requirement: All Settings Link

The Quick Settings Popover SHALL include an "All Settings" link at the bottom, visually separated from the theme and language controls. Clicking the link SHALL navigate the app to the `/felina-settings` route and SHALL close the Popover.

#### Scenario: User clicks All Settings link

- **WHEN** the user clicks the "All Settings" link in the Quick Settings Popover
- **THEN** the app SHALL navigate to `/felina-settings`
- **AND** the Popover SHALL close
