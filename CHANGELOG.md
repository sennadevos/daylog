# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

### Backend
- Configurable CORS origins via `CORS_ORIGINS` env var (previously hardcoded)
- Alembic reads `DATABASE_URL` from app config instead of hardcoded `alembic.ini`
- Dockerfile for containerized deployment
- Item postpone endpoint (copy item to another day, preserving `origin_id`)

### Frontend
- Configurable API base URL via `VITE_API_BASE_URL` (defaults to `/api` for reverse proxy)
- Dockerfile with nginx for production serving
- Carry-forward UI (carry yesterday + backwards sweep)
- Day navigation improvements

### Infrastructure
- Docker Compose for running full stack (nginx reverse proxy on port 3000)
- Combined repo structure (`backend/` + `frontend/`)
- justfile task runner

## 2026-04-08

### Backend
- Add `origin_id` lineage tracking — each item gets a UUID that persists across copies
- Carry-forward operations: carry from yesterday, backwards sweep with dedup by `origin_id`
- Fix stale FK references caused by SQLite batch migrations

### Frontend
- Add authentication support (login/register, session cookies)
- Prefetch adjacent days for instant date navigation
- Fix TypeScript 6.0 compatibility issues

## 2026-04-07

### Backend
- Add session-based auth with personal access tokens (PAT)
- Add move-to-day endpoint for todo items
- Add optional description field to todo items
- Fix reorder position bug, correct rollover API contract

### Frontend
- Initial frontend implementation — React 19 + TypeScript + Vite + TanStack Query
- Workspace and day views with todo item management
- Item move, item descriptions, rollover-all support
- Drag-and-drop reordering via @dnd-kit
- Dark/light/system theme support
- shadcn/ui component library (base-nova style)

## 2026-04-06

### Backend
- Initial backend — FastAPI + SQLAlchemy + SQLite
- Workspace and day entry CRUD
- Todo item CRUD with position-based ordering
- Automatic midnight rollover via APScheduler
- Alembic migrations with SQLite batch mode
