## MODIFIED Requirements

### Requirement: Skill listing response

The market server SHALL expose `GET /api/skills` returning a JSON array of skill metadata objects. Each object SHALL include `name`, `version`, `description`, `contentHash`, `updatedAt`, and `author`. The `author` field SHALL contain only the username portion of the email (the part before the `@` character). When `author` is NULL (legacy data), the field SHALL be returned as null. The full email address SHALL NOT be exposed in the public listing endpoint.

#### Scenario: Author email masked in listing

- **WHEN** a client requests GET /api/skills and a skill has author "alice@corp.local"
- **THEN** the `author` field in the response SHALL be "alice"
