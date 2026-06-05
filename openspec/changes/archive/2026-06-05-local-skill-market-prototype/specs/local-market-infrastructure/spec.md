## ADDED Requirements

### Requirement: Local Market Server Architecture

The system SHALL provide a local Docker Compose environment that includes a Node.js Fastify API server, a PostgreSQL database, and a MinIO storage service.

#### Scenario: Running the local market infrastructure

- **WHEN** the user starts the Docker Compose environment
- **THEN** the API server, database, and storage SHALL be accessible on localhost

### Requirement: Skill Registry API endpoints

The API server SHALL expose endpoints to list available skills and to download skill packages.

#### Scenario: Listing skills

- **WHEN** a client sends a GET request to `/api/skills`
- **THEN** the server SHALL return a list of available skills in JSON format

#### Scenario: Downloading a skill package

- **WHEN** a client sends a GET request to `/api/skills/:id/download`
- **THEN** the server SHALL return the compressed skill package
