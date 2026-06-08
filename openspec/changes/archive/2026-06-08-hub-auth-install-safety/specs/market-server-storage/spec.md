## MODIFIED Requirements

### Requirement: Market Server Persistent Storage

The market server SHALL persist skill metadata in PostgreSQL and skill package binaries in MinIO. The metadata SHALL include skill name, version, description, content_hash, tarball_hash, storage_key, previous_storage_key, updated_at, deleted_at, author, updated_by, updated_ip, owner_id, and created_by_id fields. The skill name SHALL be the primary key. The `author`, `updated_by`, `updated_ip`, `owner_id`, and `created_by_id` fields SHALL be nullable to maintain backward compatibility with rows created before authentication was introduced. The `owner_id` and `created_by_id` fields are reserved for future Entra ID integration and SHALL NOT be written by this change. The `GET /api/skills` list response SHALL include the `author` field for each skill.

#### Scenario: Listing skills with empty database

- **WHEN** a client sends GET /api/skills and the skills table contains zero non-deleted rows
- **THEN** the server SHALL respond with an empty JSON array `[]`

#### Scenario: Listing skills excludes soft-deleted rows

- **WHEN** a client sends GET /api/skills and the skills table contains rows where deleted_at is not NULL
- **THEN** the server SHALL exclude those rows from the response

#### Scenario: Listing skills includes author

- **WHEN** a client sends GET /api/skills and the skills table contains rows with non-NULL author values
- **THEN** the server SHALL include the `author` field in each skill object in the response

#### Scenario: Downloading a soft-deleted skill

- **WHEN** a client sends GET /api/skills/:name/download and the matching row has deleted_at set
- **THEN** the server SHALL respond with HTTP 410 Gone

#### Scenario: Downloading a non-existent skill

- **WHEN** a client sends GET /api/skills/:name/download and no row matches the name
- **THEN** the server SHALL respond with HTTP 404 Not Found