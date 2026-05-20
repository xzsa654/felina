## ADDED Requirements

### Requirement: Frontend exposes selectable locales

The frontend SHALL support exactly two user-selectable locales for the initial i18n rollout: English (`en`) and Traditional Chinese (`zh-TW`). The frontend MUST default to English when no valid saved locale exists.

#### Scenario: First launch uses English

- **WHEN** the application starts without a saved locale
- **THEN** the frontend SHALL render translatable `/tokens` text in English

#### Scenario: Saved Traditional Chinese locale is restored

- **WHEN** the application starts with `zh-TW` saved as the locale
- **THEN** the frontend SHALL render translatable `/tokens` text in Traditional Chinese

#### Scenario: Invalid saved locale falls back

- **WHEN** the application starts with a saved locale value other than `en` or `zh-TW`
- **THEN** the frontend SHALL use English as the active locale

### Requirement: Tokens page provides language switching

The `/tokens` page SHALL provide a visible language switcher that lets the user select English or Traditional Chinese. Changing the selected locale MUST update `/tokens` user-visible text without requiring a page reload.

#### Scenario: User switches from English to Traditional Chinese

- **WHEN** the active locale is English and the user selects Traditional Chinese on `/tokens`
- **THEN** `/tokens` SHALL update its translatable labels, headings, controls, empty states, chart labels, table headers, button text, and status text to Traditional Chinese

#### Scenario: User switches from Traditional Chinese to English

- **WHEN** the active locale is Traditional Chinese and the user selects English on `/tokens`
- **THEN** `/tokens` SHALL update its translatable labels, headings, controls, empty states, chart labels, table headers, button text, and status text to English

#### Scenario: Locale selection persists

- **WHEN** the user selects a locale on `/tokens` and restarts the application
- **THEN** the frontend SHALL restore the selected locale for `/tokens`

### Requirement: Tokens user interface uses translation resources

The `/tokens` page and its direct React child components SHALL obtain user-visible static text from translation resources instead of hard-coded English literals. This includes page title, loading text, date range controls, granularity controls, stat card labels and subtitles, agent status labels, refresh button text, chart titles, chart legend names, chart tooltip labels, table headers, empty states, heatmap labels, and spending/cache labels.

#### Scenario: Token analytics loading state is translated

- **WHEN** `/tokens` is loading token analytics for the active locale
- **THEN** the loading message SHALL be rendered from the active locale translation resource

#### Scenario: Chart labels are translated

- **WHEN** `/tokens` renders token usage, cost, model, agent, or heatmap visualizations
- **THEN** chart titles, legend names, tooltip labels, and heatmap low-to-high labels SHALL be rendered from the active locale translation resource

#### Scenario: Table and controls are translated

- **WHEN** `/tokens` renders the model breakdown table, granularity picker, date range filter, or refresh control
- **THEN** headings, column labels, option labels, and button text SHALL be rendered from the active locale translation resource

### Requirement: Locale-aware formatting is used on Tokens page

The `/tokens` page SHALL format user-visible numbers, dates, and USD currency values with the active locale. The system MUST NOT convert currencies or modify token analytics source values when locale changes.

#### Scenario: Event count uses active locale formatting

- **WHEN** `/tokens` displays event counts with the active locale set to `zh-TW`
- **THEN** the count SHALL use Traditional Chinese compatible number grouping while preserving the numeric value

#### Scenario: USD cost keeps currency semantics

- **WHEN** `/tokens` displays token cost with either supported locale
- **THEN** the value SHALL remain a USD amount and SHALL NOT be converted to another currency

#### Scenario: Agent and model identifiers remain unchanged

- **WHEN** `/tokens` displays agent identifiers or model names from analytics data
- **THEN** the frontend SHALL display those identifiers exactly as provided by the data source
