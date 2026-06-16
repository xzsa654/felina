## ADDED Requirements

### Requirement: Submission gathers all-time usage from the aggregator

The desktop backend SHALL expose a command that builds the leaderboard payload from the token aggregator's all-time daily analytics using the merged source resolution (so the full history is included). The payload SHALL contain a summary (total, input, output, cache-read, cache-write, and reasoning tokens; total cost; event count), a per-day contribution series where `active_days` is the count of days whose token total is greater than zero, and a per-model breakdown derived from the aggregator's model breakdown where each model's tokens is the sum of all token types.

#### Scenario: Payload reflects aggregator totals

- **WHEN** the submit command runs while the aggregator holds dated usage across multiple days
- **THEN** the summary token and cost totals equal the aggregator's all-time totals
- **AND** the daily series contains one entry per day with usage
- **AND** `active_days` equals the number of days whose token total exceeds zero
- **AND** the per-model breakdown contains one entry per model with tokens summed across all token types

### Requirement: Reading a user's model breakdown

The desktop backend SHALL expose a command to fetch a single user's per-model token breakdown by handle.

#### Scenario: Fetch model breakdown

- **WHEN** the model breakdown command runs for a handle
- **THEN** it returns that user's per-model token rows from the server

### Requirement: Submission requires login and explicit opt-in

The submit command SHALL require a valid hub session and SHALL only run when the user has explicitly opted in. The public handle SHALL be sent instead of the account email.

#### Scenario: Not logged in

- **WHEN** the submit command runs without a stored valid access token
- **THEN** the command returns an error indicating the user must log in and uploads nothing

### Requirement: Submission maps server errors to actionable messages

The submit command SHALL attach the access token as a Bearer header, and SHALL translate an expired-session response into a re-login prompt and a handle-conflict response into a handle-taken message.

#### Scenario: Expired session

- **WHEN** the server responds 401 to a submit
- **THEN** the command surfaces a re-login message

#### Scenario: Handle already taken

- **WHEN** the server responds 409 to a submit
- **THEN** the command surfaces a handle-taken message and does not report success

### Requirement: Read and opt-out commands

The desktop backend SHALL expose commands to fetch the ranking listing (passing the sort key), to fetch a single user's contribution series by handle, and to remove the caller's own entry (opt-out).

#### Scenario: Fetch ranking

- **WHEN** the listing command runs with a sort key
- **THEN** it returns the server's ranked entries for that sort key

#### Scenario: Opt-out

- **WHEN** the opt-out command runs for a logged-in user
- **THEN** it calls the server opt-out endpoint and reports success

### Requirement: Handle is remembered locally

The desktop backend SHALL persist the user's last-used handle in local settings so the submit form can prefill it, without storing the handle as proof of opt-in.

#### Scenario: Handle prefilled on next submit

- **WHEN** a user has previously submitted with a handle and opens the submit flow again
- **THEN** the previously used handle is available to prefill the form
