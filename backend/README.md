# Daylog

A scoped daily todo system with automatic rollover and multi-user support.

Each **user** has their own **workspaces**, each with per-day entries containing a **todo list** and a **story** (markdown). Unchecked items automatically roll over to the next day at midnight.

## Todo item states

- `unchecked` — still to do
- `checked` — done
- `revoked` — intentionally dismissed

Items can also be **removed** (hard delete, no trace).

## Item identity

Each item carries an `origin_id` (UUID) that persists across copies. When rollover or carry-forward copies an item to a new day, the copy gets the same `origin_id` as the source. This enables lineage tracking and deduplication across days.

## Rollover

At midnight, unchecked items are copied to the next day. The original stays in the previous day's list. Checked and revoked items do not roll over.

If the server was offline for multiple days, rollover finds the most recent day with unchecked items and rolls them to today.

Rollover is idempotent — items whose `origin_id` already exists on the target day are skipped.

## Setup

```sh
uv sync
uv run alembic upgrade head
uv run uvicorn daylog.main:app --reload
```

API docs at `http://localhost:8000/docs`.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///daylog.db` | SQLAlchemy database URL |
| `SESSION_SECRET` | random on startup | Secret for signing sessions |
| `SESSION_MAX_AGE` | `2592000` (30 days) | Session lifetime in seconds |
| `COOKIE_DOMAIN` | `None` | Cookie domain (set for cross-subdomain) |

CORS is configured for `http://localhost:5173` with credentials (see `daylog/main.py`).

## Authentication

All endpoints except `/api/auth/register` and `/api/auth/login` require authentication.

Two auth methods are supported:
- **Session cookies** — set automatically on login, used by the browser frontend
- **Personal access tokens** — for CLI/API usage, sent as `Authorization: Bearer dlg_...`

If existing workspaces are present during the auth migration, a default `admin` user is created with password `changeme`. Change this immediately after upgrading.

## API

### Auth

```
POST   /api/auth/register              {"username": "alice", "password": "..."}
POST   /api/auth/login                 {"username": "alice", "password": "..."}
POST   /api/auth/logout
GET    /api/auth/me
```

### Personal access tokens

```
POST   /api/auth/tokens                {"name": "cli"}
GET    /api/auth/tokens
DELETE /api/auth/tokens/{id}
```

`POST /api/auth/tokens` returns the plaintext token once: `{"id": 1, "name": "cli", "token": "dlg_..."}`. Store it — it cannot be retrieved again.

### Workspaces

```
GET    /api/workspaces
POST   /api/workspaces              {"name": "Work"}
GET    /api/workspaces/{id}
PATCH  /api/workspaces/{id}         {"name": "New Name"}
DELETE /api/workspaces/{id}
```

Returns 409 if the workspace name is already taken (per user). Each user only sees their own workspaces.

### Day entries

```
GET    /api/workspaces/{id}/days?limit=30&before=2026-04-06
GET    /api/workspaces/{id}/days/{date}
PUT    /api/workspaces/{id}/days/{date}/story    {"story": "markdown..."}
```

`GET .../days/{date}` creates the day entry if it doesn't exist. `PUT .../story` returns `{"story": "..."}`.

### Todo items

```
POST   /api/workspaces/{id}/days/{date}/items              {"text": "Do something", "description": "...", "position": 1}
PATCH  /api/workspaces/{id}/days/{date}/items/{item}     {"text": "...", "description": "...", "state": "checked"}
POST   /api/workspaces/{id}/days/{date}/items/{item}/move {"to_date": "2026-04-08"}
DELETE /api/workspaces/{id}/days/{date}/items/{item}
PUT    /api/workspaces/{id}/days/{date}/items/reorder     {"item_ids": [3, 1, 2]}
```

On POST, `position` and `description` are optional — omit `position` to append. On PATCH, all fields are optional. `description` is markdown. Positions are 1-based. Move transfers an item to another day within the same workspace, appending it to the end.

### Rollover

```
POST   /api/workspaces/{id}/rollover    {"from_date": "2026-04-06", "to_date": "2026-04-07"}
POST   /api/rollover                    {"to_date": "2026-04-07"}
```

The per-workspace endpoint copies unchecked items from `from_date` to `to_date`. The global endpoint auto-detects the most recent source day per workspace (scoped to current user).

### Carry forward

```
POST   /api/workspaces/{id}/carry/yesterday   {"to_date": "2026-04-08"}
POST   /api/workspaces/{id}/carry/sweep       {"to_date": "2026-04-08"}
```

**Yesterday** carries unchecked items from the day before `to_date`. **Sweep** scans all previous days, deduplicates by `origin_id` (keeping the latest version of each task), and copies them to the target date. Both are idempotent.
