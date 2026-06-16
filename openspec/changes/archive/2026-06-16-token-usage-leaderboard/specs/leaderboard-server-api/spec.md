## ADDED Requirements

### Requirement: Leaderboard data schema

The market-server SHALL provide persistent storage for leaderboard entries via a migration applied by the existing sorted-SQL migration runner. The schema SHALL include a `leaderboard_entries` table holding exactly one row per user (keyed by `user_id` referencing `users(id)`) and a `leaderboard_daily` table holding per-day contribution rows keyed by `(user_id, day)`. The handle column SHALL be unique case-insensitively to prevent impersonation.

#### Scenario: Migration applies additively

- **WHEN** the migration runner starts against a database that already has the `users` and `skills` tables
- **THEN** the leaderboard tables are created without altering or dropping any existing table
- **AND** the migration is recorded so it is not re-applied on the next start

### Requirement: Submitting usage requires authentication

The server SHALL expose `POST /api/leaderboard/submit` that requires a valid JWT Bearer token. The user identity SHALL be taken from the token's subject claim and the client-supplied identity SHALL NOT be trusted.

#### Scenario: Missing token rejected

- **WHEN** a client calls `POST /api/leaderboard/submit` without a valid Bearer token
- **THEN** the server responds with HTTP 401 and stores nothing

### Requirement: Submit validates and persists usage

On an authenticated submit, the server SHALL validate the payload and reject invalid input with HTTP 400. A valid submit SHALL upsert the user's `leaderboard_entries` row (incrementing `submit_count`, refreshing `updated_at`) and SHALL replace that user's `leaderboard_daily` rows with the submitted series. The response SHALL include the user's current rank and submit count.

#### Scenario: Valid submit stores entry and returns rank

- **WHEN** an authenticated user submits a valid handle, summary totals, and a daily series
- **THEN** the server upserts one entry row, replaces the user's daily rows, and responds with HTTP 200 including `rank` and `submitCount`

#### Scenario: Repeat submit updates in place

- **WHEN** the same authenticated user submits again with new totals
- **THEN** the server updates the existing row rather than creating a second row
- **AND** increments `submit_count` by 1

#### Scenario: Invalid payload rejected

- **WHEN** a submit contains a handle outside `^[A-Za-z0-9_-]{2,32}$`, a negative or non-finite numeric field, or a daily array exceeding 800 entries
- **THEN** the server responds with HTTP 400 and stores nothing

##### Example: handle validation cases

| Handle | Result |
| ------ | ------ |
| "ab" | accepted |
| "a" | 400 (too short) |
| "user_name-1" | accepted |
| "has space" | 400 (invalid char) |
| 33-char string | 400 (too long) |

### Requirement: Handle uniqueness is enforced

The server SHALL reject a submit whose handle is already held by a different user with HTTP 409.

#### Scenario: Duplicate handle rejected

- **WHEN** user B submits a handle already in use by user A (case-insensitively)
- **THEN** the server responds with HTTP 409 and does not change user B's stored handle

### Requirement: Submit is rate limited

The submit route SHALL apply a per-route rate limit stricter than the global limit so submit counts cannot be inflated by rapid repeated calls.

#### Scenario: Excessive submits throttled

- **WHEN** a client exceeds the submit route's configured rate limit within its window
- **THEN** the server responds with HTTP 429

### Requirement: Public ranking listing

The server SHALL expose `GET /api/leaderboard` without requiring authentication. It SHALL accept a `sort` parameter of `tokens`, `cost`, or `active_days`, default to `tokens`, support `limit` and `offset`, and return both the ranked entries and aggregate totals (user count, summed tokens, summed cost). The response SHALL expose each entry's public handle but SHALL NOT expose any user email. When a valid Bearer token is supplied, the caller's own entry SHALL be flagged.

#### Scenario: Sort order honored

- **WHEN** a client requests the list with a given sort key
- **THEN** entries are returned ordered descending by that key

##### Example: ranking by sort key

- **GIVEN** entries U1(tokens=900, cost=1.0, active_days=3), U2(tokens=300, cost=5.0, active_days=9)
- **WHEN** sort=tokens
- **THEN** order is U1, U2
- **AND** WHEN sort=cost THEN order is U2, U1
- **AND** WHEN sort=active_days THEN order is U2, U1

#### Scenario: Email never exposed

- **WHEN** any client fetches the listing
- **THEN** each returned entry contains the public handle and no email field

#### Scenario: Own entry flagged when authenticated

- **WHEN** an authenticated user fetches the listing and has an entry
- **THEN** that entry is marked as belonging to the caller

### Requirement: Windowed ranking by time range

The listing endpoint SHALL accept an optional `days` parameter of 7, 30, 60, or 90. When supplied, the ranking and aggregates SHALL be computed from `leaderboard_daily` summed over the trailing window (tokens, cost, and in-window active-day count) and SHALL exclude users with no activity in the window. When `days` is absent or not one of those values, the all-time `leaderboard_entries` aggregates SHALL be used.

#### Scenario: Seven-day window ranks recent activity only

- **WHEN** a client requests the listing with `days=7`
- **THEN** each returned user's tokens, cost, and active days reflect only daily rows within the last 7 days
- **AND** users with no daily activity in that window are omitted

### Requirement: Per-user model breakdown storage and listing

The server SHALL store a per-user, per-model token breakdown submitted alongside the summary, replacing the prior set on each submit, and SHALL expose `GET /api/leaderboard/:handle/models` (public) returning that user's models ordered by tokens descending. The submit SHALL reject an invalid models list (not an array, exceeding the cap, or an entry missing a model name or carrying a negative/non-finite numeric field) with HTTP 400.

#### Scenario: Models stored and returned sorted

- **WHEN** an authenticated user submits a valid models list
- **THEN** the server replaces that user's model rows and `GET /api/leaderboard/:handle/models` returns them ordered by tokens descending

#### Scenario: Invalid model entry rejected

- **WHEN** a submit includes a model entry with an empty model name or a negative token value
- **THEN** the server responds with HTTP 400 and stores nothing

### Requirement: Public per-user contribution series

The server SHALL expose `GET /api/leaderboard/:handle/daily` without requiring authentication, returning the named user's stored daily contribution series.

#### Scenario: Daily series returned by handle

- **WHEN** a client requests the daily series for an existing handle
- **THEN** the server returns that user's per-day tokens and cost rows

#### Scenario: Unknown handle

- **WHEN** a client requests the daily series for a handle with no entry
- **THEN** the server returns an empty series with HTTP 200

### Requirement: Opt-out removes the entry

The server SHALL expose `DELETE /api/leaderboard/me` requiring a valid JWT Bearer token, which removes the caller's entry and its daily rows.

#### Scenario: Authenticated opt-out

- **WHEN** an authenticated user with an entry calls the opt-out endpoint
- **THEN** the server deletes that user's entry and daily rows and the user no longer appears in the listing
