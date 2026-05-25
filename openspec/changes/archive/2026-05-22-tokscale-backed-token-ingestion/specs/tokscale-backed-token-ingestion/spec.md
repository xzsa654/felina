## ADDED Requirements

### Requirement: Use tokscale as production token ingestion source

The system SHALL use tokscale machine-readable output as the primary production ingestion source for `/tokens` refresh. The production refresh path MUST NOT use Felina Claude, Codex, or Gemini parsers as the default source after this migration.

#### Scenario: Successful tokscale-backed refresh

- **WHEN** the operator refreshes token data and tokscale returns valid machine-readable usage rows
- **THEN** the system SHALL store or cache analytics data derived from tokscale output
- **THEN** the refresh result SHALL identify tokscale as the active ingestion source
- **THEN** `/tokens` analytics SHALL be computed from tokscale-backed data

##### Example: source selection

- **GIVEN** tokscale returns `claude` and `codex` usage rows
- **WHEN** `refresh_token_data` completes successfully
- **THEN** the active source is `tokscale_export`
- **THEN** Felina parser-backed rows are not included in the returned analytics totals

### Requirement: Normalize tokscale usage rows

The system SHALL normalize tokscale JSON usage rows into the internal analytics shape before storage or aggregation. Normalized rows MUST include agent, provider, model, input tokens, output tokens, cache read tokens, cache write tokens, reasoning tokens, event or message count, timestamp or scope bucket, and source metadata.

#### Scenario: Normalize Claude and Codex rows

- **WHEN** tokscale JSON includes rows with `client`, `model`, `provider`, `input`, `output`, `cacheRead`, `cacheWrite`, `reasoning`, and `messageCount`
- **THEN** the system SHALL map `client=claude` to `claude-code`
- **THEN** the system SHALL map `client=codex` to `codex-cli`
- **THEN** the system SHALL preserve cache, reasoning, and message count fields in the normalized row

##### Example: tokscale row mapping

| Tokscale client | Model | Input | Output | Cache Read | Cache Write | Reasoning | Message Count | Expected Agent |
| ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| claude | claude-sonnet-4-6 | 59951 | 1578906 | 168809098 | 7465353 | 0 | 2345 | claude-code |
| codex | gpt-5.5 | 5162272 | 339926 | 65629568 | 0 | 56278 | 881 | codex-cli |

#### Scenario: Unsupported tokscale schema

- **WHEN** tokscale output lacks required token usage fields
- **THEN** the system SHALL report an unsupported schema status
- **THEN** the system MUST NOT create zero-token production records from that output

##### Example: missing cache fields

- **GIVEN** tokscale returns a row with `client=claude`, `provider=anthropic`, `model=claude-sonnet-4-6`, `input=10`, `output=1`, and `messageCount=1`
- **AND** the row omits `cacheRead`, `cacheWrite`, or `reasoning`
- **WHEN** production refresh parses the row
- **THEN** the refresh result reports `unsupported_schema`
- **THEN** no `tokscale_export` production row is written for that output

### Requirement: Preserve `/tokens` analytics API compatibility

The system SHALL preserve the existing `/tokens` analytics command and frontend response shape while changing the ingestion backend. Existing consumers MUST continue receiving totals, agent breakdown, model breakdown, time-series data, cache metrics, and refresh status fields with compatible names and types.

#### Scenario: Frontend reads analytics after migration

- **WHEN** the `/tokens` page requests token analytics after a successful tokscale-backed refresh
- **THEN** the Tauri command SHALL return the same response shape expected before migration
- **THEN** totals and breakdowns SHALL be computed from tokscale-backed normalized data
- **THEN** the response SHALL expose refresh status without requiring frontend schema changes

### Requirement: Isolate legacy parser data from tokscale-backed data

The system SHALL prevent legacy Felina parser-backed rows from being aggregated together with tokscale-backed rows after migration. The implementation MUST provide either active source or active generation isolation, or a reversible storage rebuild that excludes legacy rows from production analytics.

#### Scenario: Legacy data exists before migration

- **WHEN** parser-backed `token_events` already exist before the first tokscale-backed refresh
- **THEN** the migration SHALL preserve a rollback path for the pre-migration data
- **THEN** production analytics SHALL aggregate only the active tokscale-backed source or generation after migration
- **THEN** legacy parser-backed rows SHALL NOT inflate tokscale-backed totals

##### Example: aggregate isolation

- **GIVEN** legacy parser-backed total is `2076337915`
- **AND** tokscale-backed total is `1161157714`
- **WHEN** analytics are requested after migration
- **THEN** the returned total is derived from `1161157714`
- **THEN** the returned total is not the sum of both sources

### Requirement: Surface tokscale failures without corrupting analytics

The system SHALL distinguish missing binary, command failed, unsupported schema, and parse failed statuses for tokscale-backed refresh. Failed tokscale refreshes MUST NOT overwrite the last successful analytics with empty or partial data.

#### Scenario: Tokscale binary is missing

- **WHEN** production refresh runs and the tokscale executable is unavailable
- **THEN** the refresh result SHALL report missing binary status
- **THEN** the system SHALL preserve the last successful analytics data
- **THEN** the system MUST NOT silently report Felina parser data as a successful tokscale refresh

##### Example: missing executable

- **GIVEN** no `tokscale` executable exists on `PATH`
- **AND** `GLYPHIC_TOKSCALE_BIN` is unset
- **WHEN** `refresh_token_data` runs
- **THEN** the refresh result reports `status=missing_binary`
- **THEN** `fallback_used=false`
- **THEN** the previous active source remains active

#### Scenario: Tokscale command fails

- **WHEN** tokscale exits unsuccessfully during production refresh
- **THEN** the refresh result SHALL report command failed status and diagnostic message
- **THEN** existing analytics SHALL remain unchanged

##### Example: non-zero exit

- **GIVEN** tokscale exits with status code `1`
- **AND** stderr contains `failed to read local usage`
- **WHEN** `refresh_token_data` runs
- **THEN** the refresh result reports `status=command_failed`
- **THEN** the refresh result includes the diagnostic message
- **THEN** existing analytics rows and active source remain unchanged

### Requirement: Require explicit parser fallback

The system SHALL disable automatic Felina parser fallback by default for production refresh. If parser fallback is explicitly enabled, the refresh result and analytics metadata MUST identify the fallback source.

#### Scenario: Fallback disabled by default

- **WHEN** tokscale-backed refresh fails and no explicit fallback option is enabled
- **THEN** the system SHALL return a degraded or failed refresh status
- **THEN** the system MUST NOT run Felina parsers as an implicit replacement source

##### Example: default refresh does not fallback

- **GIVEN** the active source is `tokscale_export`
- **AND** tokscale refresh fails with `command_failed`
- **WHEN** the default `/tokens` refresh command runs
- **THEN** the refresh result reports `fallback_used=false`
- **THEN** no rows are written with `source=parser_fallback`

#### Scenario: Explicit fallback enabled

- **WHEN** tokscale-backed refresh fails and explicit parser fallback is enabled
- **THEN** the system SHALL run the parser fallback path
- **THEN** the refresh result SHALL identify the active source as parser fallback
- **THEN** analytics metadata SHALL distinguish fallback data from tokscale-backed data

##### Example: diagnostic fallback source

- **GIVEN** tokscale refresh fails with `missing_binary`
- **AND** a diagnostic caller enables parser fallback explicitly
- **WHEN** the fallback refresh completes
- **THEN** the refresh result reports `status=parser_fallback`
- **THEN** the refresh result reports `active_source=parser_fallback`
- **THEN** fallback analytics rows are written with `source=parser_fallback`
