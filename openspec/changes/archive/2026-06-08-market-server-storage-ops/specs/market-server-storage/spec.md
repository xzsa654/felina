## ADDED Requirements

### Requirement: Old object cleanup on upsert

When a skill package upload (PUT /api/skills/:name) succeeds and the upserted row has a non-null `previous_storage_key`, the server SHALL delete the old MinIO object identified by `previous_storage_key`. Deletion failure SHALL be logged as a warning but SHALL NOT affect the HTTP response to the client.

#### Scenario: Old tarball deleted after update

- **WHEN** a client uploads a new version of skill "code-review" and the previous storage_key was "code-review/old-uuid.tar.gz"
- **THEN** the server SHALL delete "code-review/old-uuid.tar.gz" from MinIO after the upsert succeeds

### Requirement: Object cleanup on soft delete

When a skill is soft-deleted (DELETE /api/skills/:name), the server SHALL delete the MinIO object identified by the skill's `storage_key`. Deletion failure SHALL be logged as a warning but SHALL NOT affect the HTTP response.

#### Scenario: Tarball deleted on soft delete

- **WHEN** an authorized client deletes skill "code-review" with storage_key "code-review/uuid.tar.gz"
- **THEN** the server SHALL soft-delete the DB row AND delete "code-review/uuid.tar.gz" from MinIO

### Requirement: Private bucket policy

The market server SHALL set an explicit private bucket policy on the skills bucket during initialization. The policy SHALL deny all anonymous/public read access. The server SHALL apply this policy idempotently on every startup (no error if already set).

#### Scenario: Anonymous access denied

- **GIVEN** the skills bucket has the private policy applied
- **WHEN** an unauthenticated HTTP request attempts to read an object directly from MinIO
- **THEN** the request SHALL be denied
