## ADDED Requirements

### Requirement: Session list pagination resets on filter change

The History page SHALL load sessions in pages of 50 with a load-more control showing loaded and total counts, and SHALL reset the list to the first page of the new result set whenever the agent filter or the session search query changes. The load-more control SHALL NOT be shown when all sessions are loaded.

#### Scenario: Load more appends the next page

- **WHEN** the user activates the load-more control and more sessions exist
- **THEN** the next page is appended to the list and the loaded/total counts update accordingly

#### Scenario: Changing the agent filter resets the list

- **WHEN** the user switches the agent filter after loading multiple pages
- **THEN** the list shows the first page of sessions matching the new filter

### Requirement: Transcript loads are race-safe and cached within a session

The History page SHALL key transcript loads by agent and session ID so that rapidly switching the selected session never renders a previously selected session's transcript, and SHALL serve a previously viewed transcript from cache without a visible reload when the user re-selects it within the same app session.

#### Scenario: Rapid session switching shows the latest selection

- **WHEN** the user selects session A and then session B before A's transcript finishes loading
- **THEN** the page renders session B's transcript and never displays A's transcript under B's selection

#### Scenario: Re-selecting a viewed session hits the cache

- **WHEN** the user returns to a session whose transcript was already loaded in this app session
- **THEN** the transcript renders without an intervening loading state
