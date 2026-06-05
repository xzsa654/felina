# Felina Market Server

Local development server for the Felina Skill Hub. It runs Fastify with
Postgres metadata storage and MinIO tarball storage.

## Environment

The API container expects these environment variables:

- `DATABASE_URL`: Postgres connection string.
- `MINIO_ENDPOINT`: MinIO HTTP endpoint, for example `http://minio:9000`.
- `MINIO_ACCESS_KEY`: MinIO access key.
- `MINIO_SECRET_KEY`: MinIO secret key.
- `MINIO_BUCKET`: bucket name for uploaded skill packages. The compose default
  is `skills`.

## Docker Compose

Start the local stack:

```bash
docker compose up --build
```

The compose file starts:

- `postgres` on host port `5433`.
- `minio` on host ports `9000` and `9001`.
- `api` on host port `3100`.

The API runs database migrations and ensures the MinIO bucket exists before it
binds the HTTP listener.

Reset local server data:

```bash
docker compose down -v
```

This deletes the local Postgres and MinIO volumes.

## Migrations

Migrations live in `migrations/` and are tracked by `node-pg-migrate` in the
`pgmigrations` table. Add new SQL migrations with the next numeric prefix, for
example:

```text
migrations/002_add_author_columns.sql
```

Do not edit an already-applied migration for a deployed environment; add a new
migration instead.

## MinIO Objects

Skill packages are stored in the configured bucket using this key shape:

```text
<skill-name>/<uuid>.tar.gz
```

Re-publishing a skill writes a new object and keeps the previous object. The
database row stores the current `storage_key` and one `previous_storage_key`.
