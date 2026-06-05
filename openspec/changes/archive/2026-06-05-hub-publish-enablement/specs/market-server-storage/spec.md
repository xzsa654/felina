## ADDED Requirements

### Requirement: Market Server Persistent Storage

The market server SHALL persist skill metadata in PostgreSQL and skill package binaries in MinIO. The hardcoded in-memory `SKILLS` array SHALL be removed. The metadata SHALL include skill name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, and deleted_at fields. The skill name SHALL be the primary key.

#### Scenario: Listing skills with empty database

- **WHEN** a client sends GET /api/skills and the skills table contains zero non-deleted rows
- **THEN** the server SHALL respond with an empty JSON array `[]`

#### Scenario: Listing skills excludes soft-deleted rows

- **WHEN** a client sends GET /api/skills and the skills table contains rows where deleted_at is not NULL
- **THEN** the server SHALL exclude those rows from the response

#### Scenario: Downloading a soft-deleted skill

- **WHEN** a client sends GET /api/skills/:name/download and the matching row has deleted_at set
- **THEN** the server SHALL respond with HTTP 410 Gone

#### Scenario: Downloading a non-existent skill

- **WHEN** a client sends GET /api/skills/:name/download and no row matches the name
- **THEN** the server SHALL respond with HTTP 404 Not Found

### Requirement: Schema Migration Runner

The market server SHALL run database migrations via node-pg-migrate during boot, before accepting HTTP connections. Migration files SHALL be tracked in a pgmigrations table. The initial migration (001_init) SHALL create the skills table and enable the pgcrypto extension.

#### Scenario: First boot creates schema

- **WHEN** the market server starts against a Postgres database with no skills table
- **THEN** node-pg-migrate SHALL execute 001_init, creating the skills table and pgmigrations tracking table, before the HTTP listener binds

#### Scenario: Subsequent boots are no-op

- **WHEN** the market server starts against a Postgres database where pgmigrations records 001_init as applied
- **THEN** node-pg-migrate SHALL skip 001_init and proceed to HTTP listener bind without modifying the schema

#### Scenario: Migration failure prevents server start

- **WHEN** a migration fails during boot
- **THEN** the server process SHALL exit with a non-zero status and SHALL NOT bind the HTTP listener

### Requirement: MinIO Bucket Provisioning

The market server SHALL ensure the MinIO bucket `skills` exists at boot. If the bucket is missing the server SHALL create it before accepting HTTP connections.

#### Scenario: First boot creates bucket

- **WHEN** the market server starts against a MinIO instance with no `skills` bucket
- **THEN** the server SHALL invoke makeBucket('skills') before the HTTP listener binds

#### Scenario: Existing bucket is reused

- **WHEN** the market server starts against a MinIO instance where the `skills` bucket already exists
- **THEN** the server SHALL detect the bucket and proceed without re-creating it
