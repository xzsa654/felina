## ADDED Requirements

### Requirement: Quota-window scheduler panel on Tokens Overview

The system SHALL render a "流量到期日控制" panel within the Overview tab of the `/tokens` page, positioned at the bottom of the Overview tab content (below the temporal charts). The panel SHALL provide, for each supported agent (Claude and Codex), an enable toggle, a daily time input (`HH:MM`), and a message text input defaulting to "早安". Changes SHALL be persisted via the scheduler settings command. The panel SHALL display, per agent, the most recent trigger timestamp and outcome (success or error message). The panel SHALL clearly state that scheduled triggers only run while the Felina app is running.

#### Scenario: Panel renders on Overview tab

- **WHEN** the user opens the `/tokens` page on the Overview tab
- **THEN** the "流量到期日控制" panel is shown at the bottom of the Overview tab with Claude and Codex controls

#### Scenario: Editing a schedule persists it

- **WHEN** the user toggles an agent on and sets a time and message
- **THEN** the new schedule is saved through the scheduler settings command and re-reading the settings returns the updated values

#### Scenario: Recent trigger outcome is displayed

- **WHEN** a trigger attempt has occurred for an agent
- **THEN** the panel shows that agent's most recent attempt time and its success or error message

#### Scenario: App-runtime limitation is disclosed

- **WHEN** the panel is shown
- **THEN** it displays text stating triggers run only while the app is open

### Requirement: Manual trigger control in the panel

The system SHALL provide a per-agent "立即觸發" action in the panel that invokes the manual immediate trigger command and updates the displayed recent-trigger outcome with the returned result.

#### Scenario: Manual trigger updates displayed result

- **WHEN** the user activates "立即觸發" for an agent
- **THEN** the system invokes the manual trigger command and updates that agent's displayed recent-trigger outcome with the returned timestamp and status
