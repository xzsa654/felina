# Felina Market Server

Local development server for the Felina Skill Hub. It runs Fastify with
Postgres metadata storage and MinIO tarball storage.

## Environment

All secrets are managed via a `.env` file in this directory. Docker Compose
reads it automatically.

```bash
cp .env.example .env   # then edit passwords
```

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | Postgres username |
| `POSTGRES_PASSWORD` | Postgres password |
| `POSTGRES_DB` | Database name |
| `MINIO_ROOT_USER` | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | MinIO admin password |
| `MINIO_BUCKET` | Object storage bucket name |

The API container derives its connection strings from these variables (see
`docker-compose.yml`). Do **not** commit `.env` — only `.env.example` is
tracked in git.

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

## Sharing the server with other developers on the LAN

The compose stack binds `api` to `0.0.0.0:3100`, so any machine that can reach
the host over the network can publish, install, and delete skills against this
single server. Other developers do NOT need to run their own `docker compose`
— they only run their own Felina app and point it at this host.

Host-side checklist:

1. Keep `docker compose up` running on the host that owns the server.
2. Find the host's LAN IPv4 address (Windows: `ipconfig` → look at the active
   Wi-Fi / Ethernet adapter). The LAN IP can change when switching networks.
3. If inbound 3100 is blocked, allow it through the host firewall. Docker
   Desktop's vEthernet bridge usually handles this, but verify with a peer.
4. Sanity check from another machine:

   ```bash
   curl http://<host-lan-ip>:3100/api/skills
   ```

   A `200` with a JSON array means the server is reachable.

Each remote developer then opens Felina → Settings → Market Server URL and
sets it to `http://<host-lan-ip>:3100`. Their Hub page, publish button, and
install actions will all hit the shared server.
