# Daylog: Repository Combination Strategy

> Research and recommendations for merging `daylog` (backend) and `daylog-app` (frontend) into a single repository. Written 2026-04-08.

---

## 1. Current State Analysis

### What we have

| | Backend (`daylog/`) | Frontend (`daylog-app/`) |
|---|---|---|
| **Language** | Python 3.12+ | TypeScript 6.0 / React 19 |
| **Framework** | FastAPI (sync) | Vite 8 + React Router 7 |
| **Package manager** | uv (pyproject.toml) | npm (package.json) |
| **Database** | SQLite via SQLAlchemy 2.0 | n/a |
| **Migrations** | Alembic (batch mode for SQLite) | n/a |
| **UI library** | n/a | shadcn/ui (base-nova) + Tailwind 4 |
| **State management** | n/a | TanStack Query v5 |
| **Auth** | Session cookies + PAT (Bearer) | Cookie-based via `credentials: 'include'` |
| **Scheduler** | APScheduler (midnight rollover cron) | n/a |
| **Git remote** | `git@github.com:sennadevos/daylog.git` | `git@github.com:sennadevos/daylog-app.git` |
| **Commits** | 7 | 6 |
| **Source lines** | ~950 (Python) | ~2400 (TS/TSX) |
| **Tests** | None | None |
| **CI/CD** | None | None |
| **Docker** | None | None |

### How they connect

- The frontend hardcodes `BASE_URL = 'http://localhost:8000/api'` in `src/lib/api.ts`.
- The backend hardcodes CORS for `http://localhost:5173` in `daylog/main.py`.
- Auth works via httponly session cookies; the frontend sends `credentials: 'include'`.
- Types are manually duplicated: backend defines Pydantic schemas in `daylog/schemas.py`, frontend redefines them as TypeScript interfaces in `src/types/api.ts`.
- There is no shared config, no shared build, no API spec contract, no docker-compose. The two are started independently (`uv run uvicorn ...` and `npm run dev`).

### Type drift risk

The frontend `Item` type is already missing the `origin_id` field that the backend's `ItemOut` schema returns. This is exactly the kind of silent drift that a combined repo strategy should prevent.

---

## 2. Combination Strategies Evaluated

### A. Simple Single Repo (flatten into one `.git`)

**How:** Create a new repo, move both codebases into `backend/` and `frontend/` directories, commit, push. Optionally preserve history with `git filter-repo` to rewrite paths.

```
daylog/
  backend/          # was daylog/
    daylog/
    alembic/
    pyproject.toml
  frontend/         # was daylog-app/
    src/
    package.json
  .gitignore
  README.md
```

| Pros | Cons |
|------|------|
| Simplest possible approach | No tooling for cross-project orchestration |
| Single PR covers both sides of a change | Backend and frontend builds are fully independent |
| Easy to understand, no new tools to learn | Still need manual scripts for `dev` / `build` / `test` |
| Both repos are tiny (13 commits total) so history loss is barely noticeable | No dependency graph awareness |

### B. Git Subtree Merge (preserve full history)

**How:** Use `git subtree add` to pull each repo's history into a subdirectory of a new parent repo.

```bash
git subtree add --prefix=backend git@github.com:sennadevos/daylog.git main
git subtree add --prefix=frontend git@github.com:sennadevos/daylog-app.git main
```

| Pros | Cons |
|------|------|
| Preserves every commit from both repos | Interleaved history can be confusing to read |
| No external tools needed | Subtree merges pollute `git log` with merge commits |
| One-time operation, then it's a normal repo | Ongoing subtree pulls are awkward if you keep the originals alive |
| | Overkill for 13 total commits |

### C. Git Submodules (linked but separate)

**How:** Keep both repos as-is, create a parent repo that references them via `.gitmodules`.

```
daylog/
  .gitmodules
  backend/   -> git@github.com:sennadevos/daylog.git
  frontend/  -> git@github.com:sennadevos/daylog-app.git
```

| Pros | Cons |
|------|------|
| Each repo maintains its own history and releases | Submodules are universally hated for good reason |
| Useful when repos have different ownership/teams | `git clone --recursive`, detached HEADs, version pinning headaches |
| | A cross-cutting change requires commits in 3 repos (both subs + parent) |
| | Terrible developer experience for a solo/small team |
| | CI must handle submodule checkout logic |

### D. Monorepo with Workspaces (npm/pnpm + uv)

**How:** Single repo with workspace-aware package managers on both sides. pnpm workspaces for JS, uv workspaces for Python. A root `Makefile` or `justfile` orchestrates cross-language tasks.

```
daylog/
  backend/
    daylog/
    pyproject.toml
  frontend/
    src/
    package.json
  shared/            # optional: OpenAPI spec, shared constants
  pyproject.toml     # uv workspace root (if using uv workspaces)
  package.json       # pnpm workspace root (if adding more JS packages later)
  justfile           # task runner
```

| Pros | Cons |
|------|------|
| Single repo, single PR for cross-cutting changes | Two separate dependency ecosystems to manage |
| Workspace tooling handles dependency hoisting | uv workspaces are relatively new (but stable enough) |
| Natural place for shared packages (OpenAPI spec, types) | Slightly more complex project root |
| Scales to adding more services (CLI, worker, etc.) | |
| Both `uv` and `pnpm` are fast and modern | |

### E. Turborepo / Nx Monorepo

**How:** Use Turborepo or Nx to manage task orchestration, caching, and dependency graphs across both packages.

| Pros | Cons |
|------|------|
| Intelligent caching (only rebuild what changed) | Massive overkill for 2 packages totalling 3,350 lines |
| Parallel task execution with dependency awareness | Nx/Turborepo are JS-ecosystem tools; Python support is second-class |
| Great for 10+ packages | Adds significant configuration complexity |
| | Learning curve for a tool you don't need yet |

---

## 3. Recommendation: Simple Single Repo + justfile

For a project this size (13 commits, ~3,350 source lines, solo developer, no CI, no tests, no Docker), the right answer is the simplest one that removes friction. That means **option A (simple single repo)** with a `justfile` for task orchestration.

Do not use submodules. Do not use Turborepo. Do not use workspaces yet. These are tools for problems you don't have. When you have 5+ packages and a team of 4+, revisit.

### Why not preserve history?

Both repos are 2 days old with a combined 13 commits. The cost of `git subtree` or `filter-repo` gymnastics is not worth preserving history you can scroll through in 10 seconds. Start fresh. The old repos stay on GitHub as archives if you ever need to look back.

### Target structure

```
daylog/
  backend/
    daylog/              # Python package
      __init__.py
      main.py
      models.py
      schemas.py
      ...
      router/
    alembic/
    alembic.ini
    pyproject.toml
  frontend/
    src/
      components/
      hooks/
      lib/
      pages/
      types/
      App.tsx
      main.tsx
    index.html
    package.json
    vite.config.ts
    tsconfig.json
  .env.example
  .gitignore             # merged from both
  justfile               # task runner (see below)
  README.md
```

### Task runner: justfile

[just](https://github.com/casey/just) is a better `make` for polyglot projects. No tabs-vs-spaces nonsense, cross-platform, simple syntax.

```just
# Start both backend and frontend for development
dev:
    just dev-backend &
    just dev-frontend

dev-backend:
    cd backend && uv run uvicorn daylog.main:app --reload

dev-frontend:
    cd frontend && npm run dev

# Run all checks
check:
    just check-backend
    just check-frontend

check-backend:
    cd backend && uv run python -m pytest
    cd backend && uv run ruff check .

check-frontend:
    cd frontend && npm run lint
    cd frontend && npm run build

# Database
db-migrate:
    cd backend && uv run alembic upgrade head

db-revision name:
    cd backend && uv run alembic revision --autogenerate -m "{{name}}"

# Build frontend for production
build-frontend:
    cd frontend && npm run build

# Install all dependencies
install:
    cd backend && uv sync
    cd frontend && npm install
```

---

## 4. Scaling Considerations

### 4.1 Shared Type Definitions (OpenAPI Codegen)

**The problem:** The frontend's `src/types/api.ts` is a hand-written copy of the backend's Pydantic schemas. They've already drifted (`origin_id` is missing from the frontend `Item` type). This will get worse.

**The solution:** Generate TypeScript types from the backend's OpenAPI spec.

FastAPI auto-generates an OpenAPI 3.1 spec at `/openapi.json`. Use a tool like [openapi-typescript](https://openapi-ts.dev/) to generate TS types from it:

```just
# Generate TypeScript types from backend OpenAPI spec
generate-types:
    cd backend && uv run uvicorn daylog.main:app &
    sleep 2
    curl http://localhost:8000/openapi.json -o shared/openapi.json
    kill %1
    npx openapi-typescript shared/openapi.json -o frontend/src/types/api.generated.ts
```

Alternatively, export the spec statically without starting the server:

```python
# backend/scripts/export_openapi.py
import json
from daylog.main import app
print(json.dumps(app.openapi(), indent=2))
```

Then: `uv run python scripts/export_openapi.py > shared/openapi.json`

This belongs in CI as a check: if the generated types don't match what's committed, the build fails. This catches type drift at merge time, not at runtime.

**When to do this:** Soon. The types are already out of sync. This is a 30-minute setup with immediate payoff.

### 4.2 CI/CD Pipeline Design

**Current state:** No CI at all.

**Phase 1 — GitHub Actions basics (do this now):**

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: cd backend && uv sync
      - run: cd backend && uv run ruff check .
      - run: cd backend && uv run python -m pytest

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: cd frontend && npm ci
      - run: cd frontend && npm run lint
      - run: cd frontend && npm run build

  types-check:
    runs-on: ubuntu-latest
    needs: [backend]
    steps:
      - uses: actions/checkout@v4
      - uses: astral-sh/setup-uv@v5
      - run: cd backend && uv sync
      - run: cd backend && uv run python scripts/export_openapi.py > /tmp/openapi.json
      - run: diff /tmp/openapi.json shared/openapi.json  # fail if spec changed but types weren't regenerated
```

**Phase 2 — Deployment (when you have a server):**

- Build the frontend (`npm run build`), serve the `dist/` directory from the backend (or a reverse proxy like Caddy/nginx).
- Deploy the backend as a systemd service or container.
- Run `alembic upgrade head` as part of the deploy script.

**Phase 3 — Integration tests (when you have tests):**

- Spin up the backend in CI, run frontend E2E tests against it (Playwright).
- This is where docker-compose becomes useful (see below).

### 4.3 Development Workflow

**Now:** Two terminals, manual start. This is fine for solo work.

**Next step — docker-compose (when deploying or onboarding teammates):**

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    volumes:
      - ./backend:/app
      - db-data:/app/data
    environment:
      DATABASE_URL: sqlite:///data/daylog.db
      SESSION_SECRET: dev-secret

  frontend:
    build: ./frontend
    ports: ["5173:5173"]
    volumes:
      - ./frontend:/app
      - /app/node_modules

volumes:
  db-data:
```

**When to do this:** When you either (a) deploy somewhere, or (b) have a second developer. Not before.

**Vite proxy as an alternative to CORS:**

Instead of hardcoding CORS origins, configure Vite to proxy API requests:

```ts
// vite.config.ts
export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

Then the frontend calls `/api/...` without a full URL, and CORS goes away entirely in development. In production, a reverse proxy (Caddy, nginx) does the same thing. This is cleaner than maintaining CORS origin lists.

### 4.4 Documentation Structure

**Recommended layout:**

```
docs/
  adr/                      # Architecture Decision Records
    001-sqlite-default-db.md
    002-origin-id-lineage.md
    003-session-auth-over-jwt.md
  api.md                    # or just point to /docs (FastAPI auto-docs)
```

ADRs are the single most valuable documentation practice for a small project. Each one is 10-20 lines capturing *why* a decision was made. They cost almost nothing to write and save hours of "why did we do it this way?" later.

Don't write `api.md` by hand. FastAPI generates interactive docs at `/docs`. Point people there.

**When to do this:** Start the `docs/adr/` directory now, retroactively capturing the decisions you've already made (SQLite, session auth, origin_id lineage). Add new ones as you go.

### 4.5 Collaboration Documents

**When you add a second developer, create these:**

```
CONTRIBUTING.md             # How to set up, run, test, submit PRs
.github/
  ISSUE_TEMPLATE/
    bug.md
    feature.md
  PULL_REQUEST_TEMPLATE.md
```

**Don't create these yet.** Solo-developer projects with contribution guides are cargo cult. Write `CONTRIBUTING.md` the day someone asks "how do I contribute?" and not a day before.

### 4.6 Environment Management

**Current state:** A single `.env.example` with `DATABASE_URL` and `SESSION_SECRET`. Appropriate for the current stage.

**When you need dev/staging/prod:**

```
backend/
  .env.example              # template, committed
  .env                      # local overrides, gitignored
  .env.production           # production config, gitignored or in secrets manager
```

Use `pydantic-settings` (already in use) with environment variable precedence:

1. Actual environment variables (set by deployment platform)
2. `.env` file (local development)
3. Defaults in `Settings` class

**Key environment-specific settings to prepare for:**

| Setting | Dev | Production |
|---------|-----|------------|
| `DATABASE_URL` | `sqlite:///daylog.db` | PostgreSQL connection string |
| `SESSION_SECRET` | anything | cryptographically random, from secrets manager |
| `CORS_ORIGINS` | `http://localhost:5173` | your actual domain |
| `COOKIE_DOMAIN` | `None` | `.yourdomain.com` |
| `COOKIE_SECURE` | `False` | `True` |

**When to do this:** When you deploy to a server. The `pydantic-settings` foundation is already in place, so this is just adding more fields to `config.py`.

### 4.7 Database Migration Strategy at Scale

**Current state:** SQLite with Alembic, batch mode enabled. 4 migrations. This works perfectly for solo development.

**When SQLite stops being enough:**

SQLite is genuinely fine for a single-server deployment with modest traffic. It stops being fine when you need:
- Multiple server processes writing concurrently (WAL mode helps but has limits)
- Full-text search beyond basic `LIKE`
- A database server separate from the application server

**Migration to PostgreSQL:**

1. Add `psycopg[binary]` to dependencies.
2. Change `DATABASE_URL` to `postgresql://...`.
3. Re-run `alembic upgrade head` — the existing migrations should work because batch mode is a superset of standard ALTER TABLE.
4. Test the `PRAGMA foreign_keys=ON` listener in `db.py` — it's SQLite-specific and should be conditional:

```python
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    if engine.dialect.name == "sqlite":
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()
```

**Migration strategy at scale:**

- Always use Alembic autogenerate (`alembic revision --autogenerate`) but review the output.
- Run migrations as a separate step before deploying new code (not during app startup).
- In production, test migrations against a copy of the production database first.
- Consider adding a `just db-check` command that runs `alembic check` to verify the models match the current migration head.

### 4.8 Monitoring and Observability

**Not needed yet.** But when you deploy:

**Phase 1 — Structured logging:**

Replace `print`/basic logging with structured JSON logs. Use Python's `logging` module with a JSON formatter. This makes logs searchable.

```python
# config.py addition
import logging
logging.basicConfig(
    format='{"time":"%(asctime)s","level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}',
    level=logging.INFO,
)
```

**Phase 2 — Health check endpoint:**

```python
@app.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
```

Use this for uptime monitoring (UptimeRobot, Healthchecks.io, or similar).

**Phase 3 — Application Performance Monitoring (if/when needed):**

- Sentry for error tracking (free tier is generous).
- For metrics: start with just counting requests and latencies in logs. Don't add Prometheus/Grafana until you actually have performance problems to investigate.

---

## 5. Execution Plan

Ordered by priority. Do the top items now, the bottom items when they become relevant.

### Do now

1. **Combine repos** using the simple single-repo approach. Fresh `git init`, move files into `backend/` and `frontend/`, initial commit. Archive the old GitHub repos.

2. **Add a `justfile`** with `dev`, `install`, `check`, and `db-migrate` recipes.

3. **Merge `.gitignore` files** into a single root `.gitignore` covering both Python and Node artifacts.

4. **Set up Vite proxy** to remove hardcoded CORS origins. Change `api.ts` to use relative URLs (`/api/...` instead of `http://localhost:8000/api/...`).

5. **Fix the `origin_id` gap** in frontend types (it's already missing).

### Do soon

6. **Set up OpenAPI codegen** so frontend types are generated from the backend spec, not hand-maintained.

7. **Add ruff** for Python linting (`uv add --dev ruff`).

8. **Add pytest** with at least a smoke test for each endpoint.

9. **Set up GitHub Actions CI** with lint + build checks for both sides.

10. **Start `docs/adr/`** with 3-4 retroactive ADRs.

### Do when deploying

11. **Write Dockerfiles** for backend and frontend.

12. **Add `docker-compose.yml`** for local full-stack development.

13. **Add health check endpoint**.

14. **Set up Sentry** for error tracking.

15. **Configure environment-specific settings** in `config.py`.

### Do when adding team members

16. **Write `CONTRIBUTING.md`**.

17. **Add GitHub issue/PR templates**.

18. **Add Playwright E2E tests**.

19. **Consider PostgreSQL** if SQLite's concurrency limits become a problem.

---

## 6. What NOT to Do

- **Don't use git submodules.** They add complexity with no benefit at this scale.
- **Don't adopt Turborepo or Nx.** You have 2 packages. These tools shine at 20.
- **Don't write a CONTRIBUTING.md for yourself.** It's documentation theater.
- **Don't add Docker until you're deploying.** It slows down local dev for no reason when you're solo.
- **Don't switch to PostgreSQL proactively.** SQLite is not a toy database. It handles tens of thousands of requests per second. Switch when you have a concrete reason (multiple servers, need for concurrent writes from separate processes).
- **Don't add monitoring before you have something deployed to monitor.**
- **Don't over-engineer the CI pipeline.** Lint + build + test is enough. Add deployment, E2E, and type-checking stages as those things exist.
