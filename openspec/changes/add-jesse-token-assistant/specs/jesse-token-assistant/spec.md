## ADDED Requirements

### Requirement: Tokens page shows Jesse assistant mascot

The system SHALL render a Jesse assistant panel only inside the `/tokens` page. Jesse SHALL have a fixed mascot identity named `Jesse`, also known as `pinkman`, represented as a chunky pink mascot in the UI. The assistant SHALL provide collapsed and expanded states without registering a new navigation page or global app overlay.

#### Scenario: User opens Tokens page

- **WHEN** the user navigates to `/tokens`
- **THEN** the page SHALL display a collapsed Jesse assistant control within the Tokens page
- **AND** the control SHALL identify the assistant as `Jesse`
- **AND** the application navigation SHALL NOT add a new page for Jesse

#### Scenario: User expands and collapses Jesse

- **WHEN** the user activates the collapsed Jesse control
- **THEN** the page SHALL show an expanded assistant panel with a drop target, chat thread, provider selector, and message composer
- **WHEN** the user closes the expanded assistant panel
- **THEN** the page SHALL return Jesse to the collapsed mascot state

### Requirement: Tokens page provides structured draggable context

The system SHALL allow supported `/tokens` dashboard sections to provide structured draggable context payloads for Jesse. Supported payload kinds SHALL include `token-overview`, `top-session`, `model-breakdown`, and `quota-snapshot`. Each payload SHALL include a `kind`, `title`, `source`, `capturedAt`, and bounded data fields relevant to that kind.

#### Scenario: User drops a supported token context on Jesse

- **WHEN** the user drags a supported `/tokens` context payload onto the collapsed Jesse mascot or expanded Jesse drop target
- **THEN** Jesse SHALL accept the payload
- **AND** Jesse SHALL display a preview containing the payload title and source
- **AND** Jesse SHALL automatically request an initial summary chat response for that context

##### Example: top session payload preview

- **GIVEN** a payload with `kind="top-session"`, `title="Codex session abc123"`, and `source="tokens.topSessions"`
- **WHEN** the user drops it on Jesse
- **THEN** Jesse displays `Codex session abc123` as the active context title
- **AND** Jesse displays `tokens.topSessions` as the active context source

#### Scenario: User drops unsupported data

- **WHEN** the user drops data that does not contain a valid Jesse context payload
- **THEN** Jesse SHALL reject the drop
- **AND** Jesse SHALL keep the previous active context unchanged
- **AND** Jesse SHALL display a non-crashing invalid-context message

### Requirement: Jesse supports context-bound chat

The system SHALL expose a typed assistant chat flow for Jesse. The flow SHALL accept provider, context payload, bounded chat messages, and locale inputs. Successful chat generation SHALL return markdown text with provider metadata. Jesse SHALL keep the chat thread in frontend panel state only and SHALL NOT persist chat messages to Felina settings.

#### Scenario: User drops context and receives an initial summary

- **GIVEN** Jesse has an active valid context payload
- **WHEN** the context is dropped on Jesse
- **THEN** the system SHALL call the assistant chat flow with the context and an initial user instruction asking for a summary
- **AND** Jesse SHALL display a loading state while generation is pending
- **AND** Jesse SHALL append the returned markdown as an assistant chat message when generation completes

#### Scenario: User asks a follow-up question

- **GIVEN** Jesse has an active valid context payload and at least one chat message
- **WHEN** the user submits a follow-up question in the composer
- **THEN** the system SHALL call the assistant chat flow with the active context and current bounded chat thread
- **AND** Jesse SHALL display the user question as a user message
- **AND** Jesse SHALL append the returned markdown as an assistant message

##### Example: chat input and output shape

- **GIVEN** a `quota-snapshot` context for Codex quota usage and messages containing a user question
- **WHEN** assistant chat succeeds
- **THEN** the response contains markdown text and provider metadata fields `provider`, `model`, and `generated_at`

### Requirement: Jesse reuses local agent credentials without storing secrets

The system SHALL generate Jesse assistant output by reusing the user's existing local Codex or Claude agent credentials. The system SHALL NOT require a new API key input for Jesse. The system SHALL NOT return access tokens, account IDs, OAuth tokens, or credential file contents to the frontend. The system SHALL NOT persist Jesse request payloads or generated responses to Felina settings.

#### Scenario: Codex provider uses local Codex login

- **WHEN** Jesse generation is requested with provider `codex`
- **THEN** the backend SHALL use the local Codex authentication source
- **AND** the frontend response SHALL contain generated markdown and non-secret provider metadata only

#### Scenario: Claude provider uses local Claude login

- **WHEN** Jesse generation is requested with provider `claude`
- **THEN** the backend SHALL use the local Claude authentication source
- **AND** the frontend response SHALL contain generated markdown and non-secret provider metadata only

#### Scenario: Credentials are missing

- **WHEN** Jesse generation is requested for a provider whose local credentials are unavailable
- **THEN** the backend SHALL return an error describing that the provider is not logged in or unavailable
- **AND** the error SHALL NOT include raw tokens, account IDs, or credential file contents
- **AND** the Tokens dashboard SHALL remain usable

### Requirement: Jesse validates assistant requests safely

The system SHALL validate Jesse assistant requests before provider HTTP calls. Unsupported providers, unsupported actions, empty contexts, and oversized serialized contexts SHALL be rejected without sending a provider request.

#### Scenario: Unsupported action is rejected

- **WHEN** the frontend submits assistant generation with an action other than `summary`, `explain`, or `plan`
- **THEN** the backend SHALL reject the request before any provider HTTP request is sent
- **AND** Jesse SHALL display the validation error without clearing the active context

#### Scenario: Unsupported chat role is rejected

- **WHEN** the frontend submits assistant chat with a role other than `user` or `assistant`
- **THEN** the backend SHALL reject the request before any provider HTTP request is sent
- **AND** Jesse SHALL display the validation error without clearing the active context

#### Scenario: Oversized context is rejected

- **WHEN** the serialized Jesse context exceeds the backend size limit
- **THEN** the backend SHALL reject the request before any provider HTTP request is sent
- **AND** Jesse SHALL display an error telling the user to reduce the dropped context size
