## ADDED Requirements

### Requirement: Scheduled quota-window trigger settings

The system SHALL persist per-agent quota-window trigger schedules under the `quotaWindowSchedules` key in `~/.felina/settings.json`, supporting the agents `claude` and `codex`. Each schedule SHALL contain `enabled` (boolean), `time` (local wall-clock in `HH:MM`, 24-hour), and `message` (non-empty string). When a schedule entry or any of its fields is absent, the system SHALL fall back to `{ enabled: false, time: "09:00", message: "早安" }`. Writing a schedule SHALL preserve all other existing keys in `settings.json`, including `quotaTtlSeconds`.

#### Scenario: Default fallback when no schedule persisted

- **WHEN** `get_quota_window_schedules` is invoked and `settings.json` has no `quotaWindowSchedules` key
- **THEN** the response returns both `claude` and `codex` with `enabled=false`, `time="09:00"`, `message="早安"`

#### Scenario: Writing a schedule preserves other settings keys

- **WHEN** `set_quota_window_schedule` writes a `claude` schedule into a `settings.json` that already contains `quotaTtlSeconds`
- **THEN** the persisted file retains the original `quotaTtlSeconds` value and contains the new `quotaWindowSchedules.claude` entry

#### Scenario: Invalid schedule input is rejected

- **WHEN** `set_quota_window_schedule` is called with an unsupported agent, a `time` not matching `HH:MM`, or an empty `message`
- **THEN** the command returns an error and `settings.json` is left unchanged

##### Example: input validation cases

| agent | time | message | Result |
| ----- | ---- | ------- | ------ |
| claude | "09:00" | "早安" | accepted, persisted |
| codex | "23:59" | "hi" | accepted, persisted |
| gemini | "09:00" | "早安" | rejected (unsupported agent) |
| claude | "9:0" | "早安" | rejected (bad time format) |
| claude | "25:00" | "早安" | rejected (bad time format) |
| claude | "09:00" | "" | rejected (empty message) |

### Requirement: App-runtime daily trigger execution

The system SHALL run a background scheduler during app runtime that, at minute-level granularity, sends the configured message exactly once per local calendar day to each enabled agent once the current local time has reached that agent's configured `time`. The system SHALL NOT trigger while the app is not running. The system SHALL record, per agent, the timestamp and outcome (success, or failure with an error string) of the most recent trigger attempt, held in memory only and not persisted.

#### Scenario: Trigger fires once at the scheduled time

- **WHEN** an enabled schedule's configured `time` is reached on a day where no trigger has yet occurred for that agent
- **THEN** the system sends the configured message to that agent once and records the attempt outcome

#### Scenario: No duplicate trigger within the same day

- **WHEN** the scheduler ticks again later on the same calendar day after a trigger already occurred for that agent
- **THEN** the system does not send another message for that agent until the next calendar day

#### Scenario: Failed attempt does not retry every tick

- **WHEN** a trigger attempt fails (missing credentials, non-2xx response, or network error)
- **THEN** the system records the error as that day's attempt and does not re-attempt for that agent until the next calendar day

##### Example: due-and-dedup decision (given now, schedule time, last-sent date)

| now (local) | schedule time | last attempt date | Decision |
| ----------- | ------------- | ----------------- | -------- |
| 08:59 | 09:00 | (none) | not due |
| 09:00 | 09:00 | (none) | due → send |
| 09:30 | 09:00 | today | already handled today |
| 09:00 next day | 09:00 | yesterday | due → send |

### Requirement: Manual immediate trigger

The system SHALL expose a command `trigger_quota_window_now` that synchronously sends the agent's configured message once and returns the outcome, independent of the scheduled time and of whether the daily automatic trigger has already run.

#### Scenario: Manual trigger returns outcome immediately

- **WHEN** `trigger_quota_window_now` is invoked for `claude`
- **THEN** the system sends the configured message and returns a result containing the attempt timestamp and either success or an error string

### Requirement: Provider message-send paths reuse existing credentials

The system SHALL send the trigger message to Claude via the Anthropic Messages API using the OAuth token obtained by the existing Claude credential reader, and to Codex via the ChatGPT backend responses endpoint using the access token and account id from `~/.codex/auth.json`. Each send path SHALL return success on a 2xx response and an error string otherwise. The request SHALL be a single minimal message sufficient to start the quota window, and SHALL NOT implement multi-turn conversation.

#### Scenario: Claude send succeeds with valid OAuth token

- **WHEN** a Claude trigger is sent and a valid OAuth token is available and the API returns 2xx
- **THEN** the send path reports success

#### Scenario: Missing credentials surface as an error

- **WHEN** a trigger is sent for an agent whose credentials are missing or unreadable
- **THEN** the send path returns an error string identifying the missing credential, and no message is sent
