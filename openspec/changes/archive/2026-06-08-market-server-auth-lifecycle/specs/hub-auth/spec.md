## MODIFIED Requirements

### Requirement: User registration

The market server SHALL expose `POST /auth/register` accepting `{ email, password }` JSON body. The server SHALL hash the password with bcrypt, INSERT a new row into the `users` table with a UUID primary key, and return `{ accessToken, refreshToken, email }` where accessToken is a short-lived JWT (default 15 minutes, configurable via `ACCESS_TOKEN_EXPIRY` environment variable) signed with HS256 using the `JWT_SECRET` environment variable, and refreshToken is a UUID v4 stored as a SHA-256 hash in the `refresh_tokens` table with a 30-day expiration. The JWT payload SHALL contain `{ sub: <user-uuid>, email: <email>, iat, exp }`. If the email already exists, the server SHALL respond 409. If email or password is empty or missing, the server SHALL respond 400.

### Requirement: User login

The market server SHALL expose `POST /auth/login` accepting `{ email, password }` JSON body. The server SHALL look up the user by email, compare the password with bcrypt, and on success return `{ accessToken, refreshToken, email }` with the same token semantics as registration. If the email is not found or password does not match, the server SHALL respond 401.

## ADDED Requirements

### Requirement: Token refresh

The market server SHALL expose `POST /auth/refresh` accepting `{ refreshToken }` JSON body. The server SHALL hash the provided refresh token with SHA-256, look up the hash in the `refresh_tokens` table, and verify the token has not expired. On success, the server SHALL delete the used refresh token, generate a new access token and new refresh token (token rotation), store the new refresh token hash, and return `{ accessToken, refreshToken, email }`. If the refresh token is invalid or expired, the server SHALL respond 401.

#### Scenario: Successful token refresh

- **WHEN** a client sends POST /auth/refresh with a valid, non-expired refresh token
- **THEN** the server SHALL respond 200 with new `{ accessToken, refreshToken, email }`
- **AND** the old refresh token SHALL be deleted from the database

#### Scenario: Expired refresh token

- **WHEN** a client sends POST /auth/refresh with an expired refresh token
- **THEN** the server SHALL respond 401

### Requirement: Server-side logout with token revocation

The market server SHALL expose `POST /auth/logout`. When the request body contains `{ refreshToken }`, the server SHALL delete that specific refresh token from the database. When the request body is empty or does not contain refreshToken, and the request includes a valid Bearer token, the server SHALL delete all refresh tokens for the authenticated user (all-device logout). The server SHALL respond 200 on success.

#### Scenario: Logout revokes specific refresh token

- **WHEN** a client sends POST /auth/logout with `{ refreshToken: "<token>" }`
- **THEN** the server SHALL delete that refresh token from the database
- **AND** subsequent POST /auth/refresh with that token SHALL fail with 401

#### Scenario: Logout revokes all sessions

- **WHEN** an authenticated client sends POST /auth/logout with empty body
- **THEN** the server SHALL delete all refresh tokens for that user
