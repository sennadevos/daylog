# Daylog

A daily todo/journal system with automatic rollover, item lineage tracking, and multi-user support.

## Project structure

```
daylog/
  backend/                 # Python FastAPI API server
  frontend/                # React + TypeScript SPA
  docker-compose.yml       # Full-stack Docker setup
  justfile                 # Task runner
  SECURITY-AUDIT.md        # Security review for public deployment
  REPO-STRATEGY.md         # Scaling roadmap
  CHANGELOG.md             # Feature history
```

## Backend (`backend/`)

FastAPI + SQLAlchemy + SQLite. Sync (not async). Manages users, workspaces, day entries, and todo items.

### Running

```sh
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn daylog.main:app --reload    # http://localhost:8000
```

Or via justfile from the root: `just dev-backend`

API docs: `http://localhost:8000/docs`

### Key files

| File | Purpose |
|------|---------|
| `backend/daylog/models.py` | SQLAlchemy models: User, Workspace, DayEntry, TodoItem |
| `backend/daylog/schemas.py` | Pydantic request/response schemas |
| `backend/daylog/auth.py` | Password hashing (bcrypt), session management, `get_current_user` |
| `backend/daylog/dependencies.py` | Shared dependencies (`get_user_workspace` ownership check) |
| `backend/daylog/rollover.py` | Rollover + carry-forward business logic |
| `backend/daylog/config.py` | pydantic-settings config (DATABASE_URL, session settings, CORS) |
| `backend/daylog/main.py` | FastAPI app, CORS, APScheduler midnight rollover job |
| `backend/daylog/router/auth.py` | Register, login, logout, PAT management |
| `backend/daylog/router/workspaces.py` | Workspace CRUD (scoped to current user) |
| `backend/daylog/router/days.py` | Day entry listing + story editing |
| `backend/daylog/router/items.py` | Item CRUD, move, postpone (copy), reorder |
| `backend/daylog/router/rollover.py` | Rollover + carry-forward endpoints |
| `backend/alembic/` | Database migrations (4 total, use `batch_alter_table` for SQLite) |

### Data model

```
User -> Workspace -> DayEntry -> TodoItem
```

- Each todo item has an `origin_id` (UUID) that persists across copies for lineage tracking and deduplication.
- Items have states: `unchecked`, `checked`, `revoked`.
- Move (`copy: false`) relocates an item between days. Postpone (`copy: true`) copies it (same `origin_id`, state reset to unchecked).

### Auth

Two methods: session cookies (browser) or bearer tokens (`Authorization: Bearer dlg_...`). All routes except register/login require auth. Workspace ownership enforced via `get_user_workspace`.

### API endpoints

See `backend/README.md` for the full API reference.

Core routes:
- `POST /api/auth/register|login|logout`, `GET /api/auth/me`
- `GET|POST /api/workspaces`, `GET|PATCH|DELETE /api/workspaces/{id}`
- `GET /api/workspaces/{id}/days`, `GET /api/workspaces/{id}/days/{date}`
- `POST|PATCH|DELETE /api/workspaces/{id}/days/{date}/items[/{item}]`
- `POST /api/workspaces/{id}/days/{date}/items/{item}/move` — `{ to_date, copy? }`
- `PUT /api/workspaces/{id}/days/{date}/items/reorder`
- `POST /api/workspaces/{id}/carry/yesterday` — carry from previous day
- `POST /api/workspaces/{id}/carry/sweep` — scan all history, deduplicate by origin_id
- `POST /api/workspaces/{id}/rollover` — manual rollover between specific dates

### Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite:///daylog.db` | SQLAlchemy database URL |
| `SESSION_SECRET` | random on startup | Secret for signing sessions |
| `SESSION_MAX_AGE` | `2592000` (30d) | Session lifetime in seconds |
| `COOKIE_DOMAIN` | `None` | Cookie domain for cross-subdomain |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |

## Frontend (`frontend/`)

React 19 + TypeScript 6 + Vite 8. Uses TanStack Query for data fetching, Tailwind CSS 4 for styling, shadcn/ui (base-nova style) for components.

### Running

```sh
cd frontend
npm install
npm run dev    # http://localhost:5173
```

Or via justfile from the root: `just dev-frontend`

### Key files

| File | Purpose |
|------|---------|
| `frontend/src/types/api.ts` | TypeScript interfaces matching backend schemas |
| `frontend/src/lib/api.ts` | Fetch wrapper, all API call functions |
| `frontend/src/lib/query-keys.ts` | TanStack Query key factory |
| `frontend/src/hooks/use-auth.ts` | Login/register/logout + session query |
| `frontend/src/hooks/use-workspaces.ts` | Workspace CRUD hooks |
| `frontend/src/hooks/use-items.ts` | Item CRUD, move, reorder hooks (optimistic updates) |
| `frontend/src/hooks/use-day-entry.ts` | Day entry query + adjacent-day prefetch + story mutation |
| `frontend/src/hooks/use-carry.ts` | Carry-yesterday and sweep mutation hooks |
| `frontend/src/hooks/use-theme.ts` | Light/dark/system theme |
| `frontend/src/pages/` | LoginPage, HomePage, WorkspacePage, DayPage |
| `frontend/src/components/layout/` | AppShell (auth gate + sidebar), Sidebar, ThemeToggle |
| `frontend/src/components/day/` | DayView (main content), DayNavigator (date picker) |
| `frontend/src/components/items/` | ItemList (drag-and-drop), ItemRow (single todo), ItemCreateInput |
| `frontend/src/components/story/` | StoryEditor (debounced textarea) |
| `frontend/src/components/ui/` | shadcn/ui primitives (button, checkbox, dialog, popover, etc.) |

### Stack

| Layer | Tech |
|-------|------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Routing | React Router 7 |
| Data | TanStack React Query v5 |
| Styling | Tailwind CSS 4 (oklch color system) |
| Components | shadcn/ui v4 (base-nova, built on @base-ui/react) |
| Icons | Lucide React |
| Drag & Drop | @dnd-kit |
| Dates | date-fns + react-day-picker v9 |

### Routes

- `/` — redirects to first workspace
- `/workspaces/:id` — today's day view
- `/workspaces/:id/days/:date` — specific date view

## Docker

```sh
docker compose up --build    # or: podman compose up --build
```

Serves the app at `http://localhost:3000`. Nginx reverse-proxies `/api/` to the backend, so everything is same-origin.

## Documentation

| Document | Location | Contents |
|----------|----------|----------|
| Backend CLAUDE.md | `backend/CLAUDE.md` | Architecture, data model, key concepts, gotchas |
| Backend README | `backend/README.md` | Full API reference with request/response examples |
| Security audit | `SECURITY-AUDIT.md` | Findings by severity, recommended fixes before public deploy |
| Repo strategy | `REPO-STRATEGY.md` | Scaling roadmap |
| Changelog | `CHANGELOG.md` | Feature history by date |

## Restoring after a fresh copy

```sh
just install         # or manually:
cd backend && uv sync && uv run alembic upgrade head
cd frontend && npm install
```
