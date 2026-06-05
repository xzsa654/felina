## MODIFIED Requirements

### Requirement: Skill Registry API endpoints

The API server SHALL expose endpoints to list available skills, download skill packages, upload (publish) skill packages, and delete skills. Listing and download SHALL be backed by persistent storage (Postgres metadata + MinIO binary) rather than an in-memory array. The previously documented `:id`-keyed download endpoint SHALL be replaced by name-keyed endpoints.

#### Scenario: Listing skills

- **WHEN** a client sends a GET request to /api/skills
- **THEN** the server SHALL return a list of available (non-deleted) skills in JSON format, sourced from the Postgres `skills` table

#### Scenario: Downloading a skill package

- **WHEN** a client sends a GET request to /api/skills/:name/download for a non-deleted skill
- **THEN** the server SHALL stream the tar.gz binary from MinIO using the skill's storage_key

#### Scenario: Uploading a skill package

- **WHEN** a client sends a PUT request to /api/skills/:name with a multipart tar.gz body and X-Content-Hash header
- **THEN** the server SHALL store the binary in MinIO and upsert the metadata row, per Skill Package Upload requirement

#### Scenario: Deleting a skill

- **WHEN** a client sends a DELETE request to /api/skills/:name for a row that exists
- **THEN** the server SHALL soft-delete by setting deleted_at on the row, per Skill Soft Delete requirement
