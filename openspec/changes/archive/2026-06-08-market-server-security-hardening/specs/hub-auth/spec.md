## ADDED Requirements

### Requirement: Password minimum length on registration

The market server SHALL validate that the password field in `POST /auth/register` is at least 8 characters long. If the password is shorter than 8 characters, the server SHALL respond 400 with `"password must be at least 8 characters"`. The login endpoint SHALL NOT enforce this minimum length to maintain backwards compatibility with accounts registered before this requirement.

#### Scenario: Registration rejected for short password

- **WHEN** a client sends POST /auth/register with `{ email: "alice@corp.local", password: "short" }`
- **THEN** the server SHALL respond 400 with body containing `"password must be at least 8 characters"`

### Requirement: Rate limiting on auth endpoints

The market server SHALL enforce rate limiting on `/auth/register` and `/auth/login` endpoints. The limit SHALL default to 5 requests per 15 minutes per IP address. When the limit is exceeded, the server SHALL respond 429. The limit values SHALL be configurable via `RATE_LIMIT_AUTH_MAX` (default 5) and `RATE_LIMIT_AUTH_WINDOW` (default "15 minutes") environment variables. All other endpoints SHALL have a global rate limit of 100 requests per minute per IP, configurable via `RATE_LIMIT_MAX` environment variable.

#### Scenario: Rate limit exceeded on login

- **WHEN** a client sends 6 POST /auth/login requests from the same IP within 15 minutes
- **THEN** the 6th request SHALL receive a 429 response
