## ADDED Requirements

### Requirement: Daily tab auto-syncs current-day data on entry

The system SHALL trigger a single token data refresh when the user enters the Daily tab on `/tokens`, so the current day's data is synchronized without a manual refresh. The trigger SHALL fire once per entry transition into the Daily tab and MUST NOT re-fire on unrelated re-renders while the Daily tab remains active. On refresh completion the system SHALL invalidate the token analytics queries so the Daily views render the latest data.

#### Scenario: Entering the Daily tab triggers a sync

- **WHEN** the user switches the active tab to Daily from another tab
- **THEN** the system SHALL trigger exactly one token refresh
- **THEN** after the refresh completes the Daily analytics queries SHALL be invalidated and re-rendered with the latest data

#### Scenario: Staying on the Daily tab does not re-trigger

- **WHEN** the Daily tab is already active and the component re-renders for an unrelated reason
- **THEN** the system MUST NOT trigger an additional refresh from the tab-entry effect

### Requirement: Daily analytics refetches on window refocus

The system SHALL refetch the Daily analytics query when the application window regains focus, relying on the TanStack Query `refetchOnWindowFocus` behavior. The Daily analytics query MUST NOT disable window-focus refetching via a local override.

#### Scenario: Returning to the window refetches Daily data

- **WHEN** the user is on the Daily tab, switches away from the application window, and later returns focus to it
- **THEN** the Daily analytics query SHALL refetch automatically
- **THEN** the Daily views SHALL reflect the refetched data
