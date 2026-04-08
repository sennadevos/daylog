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
    cd backend && uv run ruff check .
    cd backend && uv run python -m pytest

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
