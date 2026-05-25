## ADDED Requirements

### Requirement: AgentParser trait for extensible agent support

The system SHALL define an `AgentParser` trait in Rust that each AI coding agent implements. The trait SHALL expose `agent_id()`, `data_directories()`, `file_patterns()`, `parse_file()`, and `is_available()` methods.

#### Scenario: Registering a new agent parser

- **WHEN** a new struct implementing `AgentParser` is added to `ParserRegistry::new()`
- **THEN** the scanner SHALL include that agent's data in subsequent scans

#### Scenario: Parser reports agent availability

- **WHEN** `is_available()` is called on a parser
- **THEN** the parser SHALL return `true` only if the agent's data directories exist on disk

##### Example: available and unavailable agents

| Agent | Data directory exists? | is_available() |
|-------|----------------------|----------------|
| Claude Code | `~/.claude/projects/` exists | `true` |
| Cursor | `~/.config/tokscale/cursor-cache/` missing | `false` |

### Requirement: Claude Code parser extracts token events

The system SHALL include a `ClaudeCodeParser` that scans `~/.claude/projects/*/**.jsonl` conversation files and `~/.claude/stats-cache.json` for token usage data. Each parsed event SHALL contain agent, provider, model, timestamp, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, and reasoning_tokens fields.

#### Scenario: Parsing a Claude Code conversation JSONL file

- **WHEN** the parser processes a `.jsonl` file containing assistant messages with `usage` data
- **THEN** each assistant message with token usage SHALL produce a `TokenEvent` with correct token counts

#### Scenario: Parsing stats-cache.json for pre-aggregated data

- **WHEN** the parser processes `~/.claude/stats-cache.json` containing `dailyModelTokens` and `modelUsage`
- **THEN** the parser SHALL extract model-level token data into `TokenEvent` records

### Requirement: Parallel file scanner with rayon

The system SHALL implement a `TokenScanner` that uses rayon parallel iterators to scan all available agent data directories concurrently. Each parser's files SHALL be processed in parallel without blocking other parsers.

#### Scenario: Scanning multiple agents concurrently

- **WHEN** `scan_all()` is called and 3 agents are available
- **THEN** each agent's files SHALL be processed in parallel using rayon's thread pool
- **THEN** the result SHALL contain all events from all agents, merged into a single vector

#### Scenario: Scanner handles missing agent directories gracefully

- **WHEN** a parser's `data_directories()` returns a path that does not exist
- **THEN** the scanner SHALL skip that directory without error and continue processing other parsers

### Requirement: SQLite storage for token events

The system SHALL maintain a SQLite database at `~/.glyphic/tokens.db` to cache parsed token events. The database SHALL include a `token_events` table with columns for all `TokenEvent` fields plus a `cost_usd` column. A unique constraint on `(agent, session_id, timestamp, model)` SHALL prevent duplicate events.

#### Scenario: Events are persisted across app restarts

- **WHEN** token events are scanned and inserted into SQLite
- **THEN** subsequent queries SHALL return those events without re-scanning the source files

#### Scenario: Incremental scan avoids duplicate events

- **WHEN** a re-scan is triggered and the same conversation file has not changed
- **THEN** existing events in SQLite SHALL NOT be duplicated due to the unique constraint

#### Scenario: Scanner handles empty database

- **WHEN** the database file does not exist at app startup
- **THEN** the storage layer SHALL create the database and run the schema migration automatically
