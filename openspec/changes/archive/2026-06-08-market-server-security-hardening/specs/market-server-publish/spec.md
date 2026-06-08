## ADDED Requirements

### Requirement: Server-side content hash validation

The market server SHALL validate the X-Content-Hash header on PUT /api/skills/:name. The header value SHALL be a 64-character lowercase hexadecimal string. If the header is missing, empty, or does not match the 64-hex-char pattern, the server SHALL respond 400 with `"invalid content hash format"`. This validation ensures the client-provided hash is well-formed before storage.

#### Scenario: Content hash with invalid format rejected

- **WHEN** a client PUT /api/skills/my-skill with X-Content-Hash: "not-a-hash"
- **THEN** the server SHALL respond 400 with body containing `"invalid content hash format"`

### Requirement: CORS origin restriction

The market server SHALL configure CORS with an origin whitelist read from the `CORS_ORIGIN` environment variable. When `CORS_ORIGIN` is set, only origins in the comma-separated list SHALL be allowed. When `CORS_ORIGIN` is not set, all origins SHALL be allowed (development fallback). Preflight and actual requests from non-allowed origins SHALL receive no Access-Control-Allow-Origin header.

#### Scenario: CORS rejects unknown origin

- **WHEN** a request arrives from origin `https://evil.example.com` and CORS_ORIGIN is set to `http://localhost:1420`
- **THEN** the response SHALL NOT include an Access-Control-Allow-Origin header

### Requirement: Upload size limit

The market server SHALL limit multipart file uploads to 10 MB by default. The limit SHALL be configurable via `UPLOAD_MAX_SIZE_MB` environment variable. Uploads exceeding the limit SHALL be rejected with 413.

#### Scenario: Upload exceeding size limit

- **WHEN** a client PUT /api/skills/big-skill with a 15 MB tar.gz and UPLOAD_MAX_SIZE_MB is not set
- **THEN** the server SHALL respond 413
