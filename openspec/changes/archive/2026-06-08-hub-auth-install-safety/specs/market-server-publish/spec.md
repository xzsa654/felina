## MODIFIED Requirements

### Requirement: Skill Package Upload

The market server SHALL accept skill package uploads via PUT /api/skills/:name. The request SHALL include a valid JWT in the `Authorization: Bearer <token>` header; requests without a valid token SHALL be rejected with 401. The request body SHALL be multipart with a field named `package` containing a tar.gz binary. The request SHALL include an X-Content-Hash header carrying the client-computed semantic hash. The server SHALL validate `:name` against the canonical skill identifier ruleset (ASCII alphanumeric, hyphens, underscores, dots; non-empty) and respond 400 for invalid names. The server SHALL compute SHA-256 of the tar.gz bytes as tarball_hash, store the binary in MinIO under key `<name>/<uuid>.tar.gz`, parse SKILL.md frontmatter from the package to derive `version` and `description` values, and upsert the metadata row keyed by name. On INSERT the server SHALL set `author` to the authenticated email from the JWT. On every upsert the server SHALL set `updated_by` to the authenticated email and `updated_ip` to the request IP address. `version` and `description` are derived solely from frontmatter: if the frontmatter `version` field is present and a non-empty string it SHALL be stored verbatim, otherwise NULL; the same rule applies to `description`. When the upsert overwrites an existing row, the prior storage_key SHALL be moved into previous_storage_key and the prior MinIO object SHALL NOT be deleted. The upsert SHALL also clear deleted_at, allowing re-publish to revive a soft-deleted record. Packages that do not contain a top-level `<name>/SKILL.md` entry SHALL be rejected with 400.

#### Scenario: New skill upload

- **WHEN** a client PUT /api/skills/code-review with a valid Bearer token (email: alice@corp.local), a tar.gz body, and header X-Content-Hash: abc123, and no row exists for name=code-review
- **THEN** the server SHALL insert a row with name=code-review, content_hash=abc123, tarball_hash=SHA-256 of the bytes, storage_key set to the new MinIO object key, author=alice@corp.local, updated_by=alice@corp.local, updated_ip set from request, previous_storage_key NULL, deleted_at NULL, and respond HTTP 200

#### Scenario: Re-upload overwrites and preserves previous

- **WHEN** a client PUT /api/skills/code-review with a valid Bearer token and a new tar.gz body and a row already exists for name=code-review with storage_key=K1
- **THEN** the server SHALL update content_hash, tarball_hash, version, description with new values, set storage_key to a new key K2, set previous_storage_key to K1, set updated_by to the authenticated email, set updated_ip, set updated_at to now(), and SHALL NOT delete the K1 MinIO object. The original author field SHALL NOT be changed.

#### Scenario: Missing X-Content-Hash header

- **WHEN** a client PUT /api/skills/code-review without an X-Content-Hash header or with an empty value
- **THEN** the server SHALL respond HTTP 400 Bad Request and SHALL NOT write to MinIO or Postgres

#### Scenario: Unauthenticated PUT request

- **WHEN** a client PUT /api/skills/code-review without an Authorization header or with an invalid token
- **THEN** the server SHALL respond HTTP 401 and SHALL NOT write to MinIO or Postgres

#### Scenario: Re-publish revives soft-deleted record

- **WHEN** a client PUT /api/skills/code-review with a valid token and a row already exists for name=code-review with deleted_at set
- **THEN** the server SHALL upsert as in the re-upload scenario AND SHALL clear deleted_at to NULL

#### Scenario: Frontmatter version and description derivation

- **WHEN** a client PUT /api/skills/code-review with a tar.gz whose top-level `code-review/SKILL.md` frontmatter contains `version: 1.2.0` and `description: Automated code review skill`
- **THEN** the server SHALL store `version='1.2.0'` and `description='Automated code review skill'` in the row

#### Scenario: Missing frontmatter fields fall back to NULL

- **WHEN** a client PUT /api/skills/code-review with a tar.gz whose `SKILL.md` frontmatter omits `version` or `description`, or those fields are empty strings
- **THEN** the server SHALL store NULL in the corresponding column rather than rejecting the upload

#### Scenario: Missing SKILL.md is rejected

- **WHEN** a client PUT /api/skills/code-review with a tar.gz that does not contain a `code-review/SKILL.md` entry
- **THEN** the server SHALL respond HTTP 400 Bad Request and SHALL NOT write to MinIO or Postgres

#### Scenario: Invalid name is rejected

- **WHEN** a client PUT /api/skills/.. or /api/skills/ (empty) or /api/skills/has%20space
- **THEN** the server SHALL respond HTTP 400 Bad Request and SHALL NOT write to MinIO or Postgres

### Requirement: Skill Soft Delete

The market server SHALL accept skill deletion via DELETE /api/skills/:name. The request SHALL include a valid JWT in the `Authorization: Bearer <token>` header; requests without a valid token SHALL be rejected with 401. Deletion SHALL be implemented as a soft delete by setting deleted_at = now() on the matching row. The server SHALL enforce ownership: if the skill row has a non-NULL `author` field and the authenticated email does not match the `author`, the server SHALL respond 403 with an error message identifying the original author. If the skill row has a NULL `author` (legacy row published before auth was added), the delete SHALL be allowed. The MinIO objects SHALL NOT be deleted.

#### Scenario: Delete own skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token (email: alice@corp.local) and the skill row has author=alice@corp.local and deleted_at IS NULL
- **THEN** the server SHALL update deleted_at to now() and respond HTTP 204 No Content

#### Scenario: Delete another user's skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token (email: bob@corp.local) and the skill row has author=alice@corp.local
- **THEN** the server SHALL respond HTTP 403 with an error message indicating the skill was published by alice@corp.local

#### Scenario: Delete legacy skill with NULL author

- **WHEN** a client DELETE /api/skills/old-skill with a valid Bearer token and the skill row has author=NULL
- **THEN** the server SHALL allow the delete and respond HTTP 204 No Content

#### Scenario: Unauthenticated DELETE request

- **WHEN** a client DELETE /api/skills/code-review without an Authorization header
- **THEN** the server SHALL respond HTTP 401

#### Scenario: Delete a non-existent skill

- **WHEN** a client DELETE /api/skills/code-review with a valid Bearer token and no row matches the name
- **THEN** the server SHALL respond HTTP 404 Not Found