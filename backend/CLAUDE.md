# Daylog Backend

A daily todo/journal API with multi-user support, automatic rollover, and item lineage tracking.

## Quick orientation

```
daylog/
  models.py          # All SQLAlchemy models (User, Workspace, DayEntry, TodoItem, etc.)
  schemas.py         # All Pydantic request/response schemas
  auth.py            # Password hashing (bcrypt), session management, get_current_user dependency
  dependencies.py    # Shared FastAPI dependencies (get_user_workspace ownership check)
  rollover.py        # Core rollover + carry-forward logic (no HTTP, pure business logic)
  config.py          # pydantic-settings config (DATABASE_URL, session settings)
  db.py              # SQLAlchemy engine, SessionLocal, get_db dependency
  main.py            # FastAPI app, CORS, APScheduler midnight rollover job
  router/
    auth.py          # Register, login, logout, PAT management
    workspaces.py    # CRUD for workspaces (scoped to current user)
    days.py          # Day entry listing + story editing
    items.py         # Item CRUD, move, reorder
    rollover.py      # Rollover + carry-forward endpoints
```

## Data model

```
User → Workspace → DayEntry → TodoItem
```

- Each user owns workspaces. Workspace names are unique per user.
- Each workspace has day entries (one per date, created on demand).
- Each day entry has a story (markdown) and ordered todo items.
- Each todo item has an `origin_id` (UUID) that persists across copies — this is the lineage system.

## Key concepts

### origin_id
Every item gets a UUID `origin_id` on creation. When rollover/carry copies an item to a new day, the copy keeps the same `origin_id`. Each day still has its own independent row. This enables deduplication: the backwards sweep can find all unchecked items across all past days and only carry the latest version of each unique `origin_id`.

### Authentication
Two methods, both checked in `auth.py:get_current_user`:
1. **Session cookie** (`httponly`, name=`session`) — browser flow
2. **Bearer token** (`Authorization: Bearer dlg_...`) — personal access tokens for CLI/API

All routes except register/login require auth. Workspace ownership is enforced by `dependencies.py:get_user_workspace`, which every workspace-scoped route uses.

### Rollover vs carry-forward
- **Rollover** (`rollover_workspace`): copies unchecked items from a specific source date to a target date. Used by the midnight cron job and the manual rollover endpoint.
- **Carry yesterday** (`carry_from_yesterday`): thin wrapper — rollover from `target - 1 day`.
- **Backwards sweep** (`carry_backwards_sweep`): scans ALL previous days, deduplicates by `origin_id` (latest day wins), copies to target.
- All three use `_copy_items` which handles origin_id-based idempotency.

### Midnight job
`main.py` runs an APScheduler job at 00:00 calling `rollover_all()`. This processes ALL workspaces across all users. It uses `SessionLocal()` directly (no auth, system-level). Manual rollover via the API is scoped to the current user.

## Stack

- **FastAPI** with sync SQLAlchemy 2.0 (not async)
- **SQLite** by default (configurable via `DATABASE_URL`)
- **Alembic** for migrations — `render_as_batch=True` in `alembic/env.py` for SQLite compatibility
- **bcrypt** for password hashing (direct, not via passlib)
- **APScheduler** for the midnight rollover cron
- **uv** as the package manager

## Running

```sh
uv sync
uv run alembic upgrade head
uv run uvicorn daylog.main:app --reload
```

Docs at `http://localhost:8000/docs`. The README has the full API reference.

## Migrations

4 migrations in order:
1. `d2b2c62b0590` — initial schema (workspace, day_entry, todo_item)
2. `3e2da3791ecc` — add `description` to todo_item
3. `e44cbf448a62` — add auth tables (user, user_session, personal_access_token) + `user_id` on workspace. Creates default `admin:changeme` user if existing data.
4. `5cced2756000` — add `origin_id` to todo_item, backfill existing rows with unique UUIDs

When writing new migrations for SQLite, always use `batch_alter_table` — plain `ALTER TABLE` is limited in SQLite.

## Gotchas

- SQLite FK enforcement requires a pragma (`db.py` sets `PRAGMA foreign_keys=ON` on every connection).
- Alembic batch mode renames tables to `*_old` during migration. If you add columns to a table that other tables reference via FK, the FKs can break. The `render_as_batch=True` setting in `env.py` mitigates this but test your migrations.
- CORS origins are configured via the `CORS_ORIGINS` env var (comma-separated). Defaults to `http://localhost:5173`.
- Item positions are 1-based. Reorder uses `enumerate(ids, start=1)`.

## Frontend

The React frontend lives at `../frontend/`. See the root `CLAUDE.md` for details.
