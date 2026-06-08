## ADDED Requirements

### Requirement: Graceful shutdown on container stop

The market server process SHALL listen for SIGTERM and SIGINT signals. On receiving either signal, the server SHALL stop accepting new connections, wait for in-flight requests to complete (up to a configurable timeout via `SHUTDOWN_TIMEOUT_MS` environment variable, default 10000ms), close the database connection pool, and exit with code 0. If the timeout is exceeded, the process SHALL exit with code 1.

#### Scenario: Graceful shutdown completes

- **WHEN** the server process receives SIGTERM while 2 requests are in-flight
- **THEN** the server SHALL complete both requests, close the DB pool, and exit with code 0

### Requirement: Database connection pool configuration

The market server SHALL configure the PostgreSQL connection pool with values from environment variables: `DB_POOL_MAX` (default 20), `DB_POOL_IDLE_TIMEOUT` (default 30000ms), `DB_POOL_CONNECTION_TIMEOUT` (default 5000ms). When environment variables are not set, the defaults SHALL be used.

#### Scenario: Custom pool size

- **WHEN** the server starts with `DB_POOL_MAX=5`
- **THEN** the connection pool SHALL have a maximum of 5 connections

### Requirement: Independent migration execution

The market server SHALL provide a standalone migration script (`src/migrate.js`) that reads SQL files from the `migrations/` directory in alphabetical order and executes them idempotently using a `schema_migrations` tracking table. The API server startup (`src/server.js`) SHALL NOT execute migrations. The migration script SHALL be run as a separate step before the API server starts.

#### Scenario: Migration runs independently

- **WHEN** `node src/migrate.js` is executed
- **THEN** pending migrations SHALL be applied and recorded in `schema_migrations`
- **AND** already-applied migrations SHALL be skipped
