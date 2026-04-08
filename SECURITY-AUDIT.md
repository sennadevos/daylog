# Security Audit Report -- Daylog

**Date:** 2026-04-08
**Scope:** Full-stack audit of `daylog/` (Python FastAPI backend) and `daylog-app/` (React/TypeScript frontend)
**Auditor:** Automated security review

---

## Executive Summary

Daylog is a personal daily todo/journal application with a FastAPI backend and React frontend. The application has a reasonable authentication system (session cookies + bearer tokens, bcrypt password hashing) and uses an ORM (SQLAlchemy) that prevents SQL injection. However, there are several issues that must be addressed before exposing this application on the public internet. The most critical concerns are: open user registration with no access controls, missing session cookie `Secure` flag, a hardcoded localhost CORS origin that will break in production (but is at least not wildcard), no rate limiting on authentication endpoints, no security headers, and the OpenAPI documentation being publicly exposed. There are no critical vulnerabilities that would allow immediate unauthorized data access given the current auth model, but the combination of medium-severity issues adds up to a significant risk.

---

## Findings

### CRITICAL

*No critical findings.*

---

### HIGH

#### H1. Session cookie missing `Secure` flag -- cookies sent over plain HTTP

**File:** `daylog/daylog/router/auth.py`, line 48-55
**Description:** The session cookie is set with `httponly=True` and `samesite="lax"`, but the `secure` flag is not set. In production over HTTPS, this means the cookie will also be sent over unencrypted HTTP connections if the user visits an HTTP URL, allowing an attacker on the network to steal the session.
**Recommendation:** Add `secure=True` to `response.set_cookie()` when running in production. Make this configurable, e.g. via an environment variable or by inferring it from the scheme. Example:
```python
response.set_cookie(
    key="session",
    value=session_id,
    max_age=settings.session_max_age,
    httponly=True,
    secure=True,  # Add this
    samesite="lax",
    domain=settings.cookie_domain,
)
```

#### H2. Open user registration -- anyone can create accounts

**File:** `daylog/daylog/router/auth.py`, lines 28-37
**Description:** The `/api/auth/register` endpoint is completely open with no restrictions. Anyone who discovers the application URL can create an account and start using it. For a personal productivity app on the public internet, this is likely unintended. An attacker could mass-register accounts to fill the database.
**Recommendation:** Add one of the following:
- A registration invite code / shared secret required to register
- An admin toggle to enable/disable registration
- Remove the registration endpoint entirely and manage users via CLI or admin panel
- At minimum, add rate limiting to this endpoint

#### H3. No rate limiting on authentication endpoints

**File:** `daylog/daylog/router/auth.py`, lines 28-37 (register), lines 40-56 (login)
**Description:** There is no rate limiting on `/api/auth/login` or `/api/auth/register`. An attacker can make unlimited brute-force login attempts or mass-register accounts. Bcrypt's computational cost provides some protection, but it is not sufficient on its own.
**Recommendation:** Add rate limiting using a middleware like `slowapi` or a reverse proxy (nginx, Caddy) rate limit configuration. A reasonable starting point: 5 login attempts per minute per IP, 3 registration attempts per hour per IP.

#### H4. No password strength requirements

**File:** `daylog/daylog/schemas.py`, lines 10-12 (UserCreate), lines 15-17 (LoginRequest)
**Description:** The `UserCreate` schema accepts any non-empty string as a password. There are no minimum length, complexity, or entropy requirements. Users could register with password "a".
**Recommendation:** Add Pydantic validation to enforce a minimum password length (at least 8 characters). Example:
```python
class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=8, max_length=128)
```

---

### MEDIUM

#### M1. CORS origin hardcoded to localhost -- will break or be insecure in production

**File:** `daylog/daylog/main.py`, lines 42-48
**Description:** CORS is configured with `allow_origins=["http://localhost:5173"]` and `allow_credentials=True`. This is correct for development, but for production deployment the origin must be changed to the actual production domain. If a developer changes this to `["*"]` to "fix" CORS in production, it will be a critical vulnerability (wildcard origin with credentials is rejected by browsers, but `allow_credentials=True` with a broad origin list is dangerous). The current config is safe but non-functional for production.
**Recommendation:** Make the allowed origin configurable via an environment variable:
```python
class Settings(BaseSettings):
    cors_origins: list[str] = ["http://localhost:5173"]
```
Then use `settings.cors_origins` in the middleware.

#### M2. API documentation (Swagger/ReDoc) exposed in production

**File:** `daylog/daylog/main.py`, line 40
**Description:** FastAPI serves interactive API documentation at `/docs` (Swagger UI) and `/redoc` (ReDoc) by default. These endpoints expose the full API schema to anyone who finds them, aiding attackers in understanding the attack surface.
**Recommendation:** Disable documentation in production:
```python
app = FastAPI(
    title="Daylog",
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
)
```

#### M3. Hardcoded database URL in alembic.ini

**File:** `daylog/alembic.ini`, line 89
**Description:** `sqlalchemy.url = sqlite:///daylog.db` is hardcoded in `alembic.ini`. While this is only used by Alembic for migrations, it means the database path is fixed regardless of the `DATABASE_URL` environment variable configured for the application, leading to potential confusion about which database is being migrated.
**Recommendation:** Override the URL in `alembic/env.py` from the application settings, or use Alembic's environment variable interpolation.

#### M4. Session secret regenerated on every restart when not configured

**File:** `daylog/daylog/config.py`, line 8
**Description:** `session_secret: str = secrets.token_urlsafe(32)` generates a new random secret each time the application starts if `SESSION_SECRET` is not set in the environment. This means all existing sessions are invalidated on restart. While this is not directly exploitable, it indicates the session secret is not used for cryptographic signing (sessions are random IDs stored server-side), making the `session_secret` config field misleading and unused.
**Impact:** Low direct impact, but the field name suggests it should be used for session security. If this is indeed unused, it should be removed to avoid confusion. If it is intended for future HMAC signing of cookies, it needs to actually be wired up.

#### M5. No security headers (CSP, HSTS, X-Frame-Options, etc.)

**File:** `daylog/daylog/main.py` (entire file -- headers not set anywhere)
**Description:** The API does not set any security response headers:
- No `Strict-Transport-Security` (HSTS)
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options: DENY`
- No `Content-Security-Policy`
- No `Referrer-Policy`

These headers protect against clickjacking, MIME-type sniffing, and help enforce HTTPS.
**Recommendation:** Add a middleware or use a reverse proxy to set these headers:
```python
from starlette.middleware import Middleware
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

#### M6. Frontend API base URL hardcoded to localhost

**File:** `daylog-app/src/lib/api.ts`, line 3
**Description:** `const BASE_URL = 'http://localhost:8000/api'` is hardcoded. In production, this will either not work at all (if the API is on a different host) or force plain HTTP communication even if the site is served over HTTPS, which means session cookies and all data transit in cleartext.
**Recommendation:** Use an environment variable via Vite:
```typescript
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'
```
Use a relative URL `/api` by default with a reverse proxy routing to the backend.

#### M7. No input length validation on text fields

**File:** `daylog/daylog/schemas.py`, lines 53-54, 73-74, 107-108
**Description:** The `WorkspaceCreate.name`, `ItemCreate.text`, `StoryUpdate.story`, and `ItemCreate.description` fields accept arbitrary-length strings. An attacker could submit a multi-megabyte workspace name, item text, or story to consume database storage and memory.
**Recommendation:** Add `Field(max_length=...)` constraints to all text input fields:
```python
class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)

class ItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    description: str = Field(default="", max_length=10000)

class StoryUpdate(BaseModel):
    story: str = Field(max_length=50000)
```

#### M8. No request body size limit

**File:** `daylog/daylog/main.py` (missing configuration)
**Description:** There is no explicit request body size limit configured. FastAPI/Starlette will read the entire request body into memory. An attacker could send very large JSON payloads (tens or hundreds of MB) to cause memory exhaustion.
**Recommendation:** Use a reverse proxy (nginx, Caddy) with a request body size limit, or add a custom middleware. Nginx example: `client_max_body_size 1m;`

---

### LOW

#### L1. Default admin user with weak password in migration

**File:** `daylog/alembic/versions/e44cbf448a62_add_auth_tables_and_workspace_user_id.py`, lines 63-69
**Description:** The migration creates a default `admin` user with password `changeme` when migrating existing data. While the README documents this, there is no enforcement that the password be changed. If an operator forgets to change it, the admin account is trivially compromised.
**Recommendation:** Either:
- Force a password change on first login
- Print a generated random password during migration instead of using `changeme`
- Prompt the operator to set a password during migration

#### L2. Expired sessions cleaned lazily -- no periodic cleanup

**File:** `daylog/daylog/auth.py`, lines 38-47
**Description:** Expired sessions are only deleted when they are accessed (`_get_user_from_session`). If a user never hits the expired session again, it remains in the database indefinitely. Over time, this could lead to a large number of stale session rows.
**Recommendation:** Add a periodic cleanup job (e.g., an APScheduler task) that deletes expired sessions:
```python
def cleanup_expired_sessions():
    db = SessionLocal()
    try:
        db.query(UserSession).filter(UserSession.expires_at < datetime.now()).delete()
        db.commit()
    finally:
        db.close()
```

#### L3. Username enumeration possible via registration

**File:** `daylog/daylog/router/auth.py`, lines 31-32
**Description:** The registration endpoint returns HTTP 409 "Username already taken" for existing usernames. This allows an attacker to enumerate valid usernames. The login endpoint correctly returns a generic "Invalid credentials" for both wrong username and wrong password (line 45), which is good.
**Recommendation:** For a personal app this is low risk. To fix, return the same success response regardless of whether the username exists (but don't actually create a duplicate).

#### L4. SQLite database file in working directory

**File:** `daylog/daylog/config.py`, line 7
**Description:** The default database URL is `sqlite:///daylog.db`, which creates the file in the current working directory. If the working directory is web-accessible (e.g., served by a misconfigured reverse proxy), the entire database could be downloaded. Additionally, there is no WAL mode configured explicitly, which could affect concurrent access under load.
**Recommendation:** Store the database file in a non-web-accessible directory (e.g., `/var/lib/daylog/daylog.db`). Enable WAL mode for better concurrent performance:
```python
@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()
```

#### L5. Token deletion does not verify ownership robustly in path

**File:** `daylog/daylog/router/auth.py`, lines 116-130
**Description:** The delete token endpoint correctly filters by both `token_id` and `current_user.id`, so there is no authorization bypass. However, an attacker can probe for token IDs by sending delete requests and observing 404 vs 204 responses. This is very low risk since token IDs are sequential integers and the endpoint reveals nothing about other users' tokens.
**Recommendation:** No immediate action needed. This is acceptable for a personal app.

---

### INFO

#### I1. SQL injection risk is mitigated by SQLAlchemy ORM

**Files:** All router files and `daylog/daylog/rollover.py`
**Description:** All database queries use SQLAlchemy ORM methods (`db.query()`, `.filter()`, etc.) which automatically parameterize queries. The Alembic migrations use `sa.text()` with bound parameters. No raw string interpolation into SQL was found. This is correct and safe.

#### I2. No XSS vectors in frontend

**Files:** All `daylog-app/src/` files
**Description:** The React frontend does not use `dangerouslySetInnerHTML`, `innerHTML`, `eval()`, or `new Function()`. All user-provided text (item text, descriptions, story content, workspace names) is rendered through React's JSX which auto-escapes HTML. This is correct.

#### I3. localStorage usage is safe

**File:** `daylog-app/src/hooks/use-theme.ts`, lines 23, 38
**Description:** localStorage is only used to store the theme preference (`daylog-theme` with values `light`, `dark`, or `system`). No sensitive data (tokens, session IDs, user data) is stored in localStorage. Session management uses httpOnly cookies. This is correct.

#### I4. Workspace ownership is properly enforced

**File:** `daylog/daylog/dependencies.py`, lines 9-20
**Description:** The `get_user_workspace` dependency correctly filters by both `workspace_id` and `current_user.id`, preventing users from accessing other users' workspaces. All workspace-scoped routes use this dependency. This is correct.

#### I5. .env is gitignored

**File:** `daylog/.gitignore`, line 7
**Description:** `.env` is in the backend `.gitignore`. The frontend `.gitignore` does not explicitly list `.env` but includes `*.local` which covers `.env.local`. No `.env` files with secrets were found in the repository.

#### I6. Dependencies appear to use current versions

**Files:** `daylog/pyproject.toml`, `daylog-app/package.json`
**Description:** The Python dependencies use recent minimum versions (FastAPI >=0.115, SQLAlchemy >=2.0, bcrypt >=4.0). The frontend uses React 19, Vite 8, and recent versions of all packages. Both projects have lock files (`uv.lock`, `package-lock.json`). No known vulnerable versions were identified based on the version ranges specified.

#### I7. Frontend redirects after register do not auto-login

**File:** `daylog-app/src/hooks/use-auth.ts`, lines 27-33
**Description:** After registration, the frontend sets the user data in the query cache via `qc.setQueryData(queryKeys.auth.me, user)` but does not establish a session cookie (the register endpoint returns user data but does not set a cookie). The user would need to log in separately. This is a usability issue, not a security issue, but is worth noting.

---

## Summary Table

| ID | Severity | Finding | File |
|----|----------|---------|------|
| H1 | High | Session cookie missing `Secure` flag | `daylog/daylog/router/auth.py:48-55` |
| H2 | High | Open user registration | `daylog/daylog/router/auth.py:28-37` |
| H3 | High | No rate limiting on auth endpoints | `daylog/daylog/router/auth.py:28-56` |
| H4 | High | No password strength requirements | `daylog/daylog/schemas.py:10-12` |
| M1 | Medium | CORS origin hardcoded to localhost | `daylog/daylog/main.py:42-48` |
| M2 | Medium | API docs exposed in production | `daylog/daylog/main.py:40` |
| M3 | Medium | Hardcoded DB URL in alembic.ini | `daylog/alembic.ini:89` |
| M4 | Medium | Session secret regenerated per restart | `daylog/daylog/config.py:8` |
| M5 | Medium | No security headers | `daylog/daylog/main.py` |
| M6 | Medium | Frontend API URL hardcoded to localhost HTTP | `daylog-app/src/lib/api.ts:3` |
| M7 | Medium | No input length validation on text fields | `daylog/daylog/schemas.py` |
| M8 | Medium | No request body size limit | `daylog/daylog/main.py` |
| L1 | Low | Default admin user with weak password | `daylog/alembic/versions/e44cbf448a62_...py:63-69` |
| L2 | Low | No periodic session cleanup | `daylog/daylog/auth.py:38-47` |
| L3 | Low | Username enumeration via registration | `daylog/daylog/router/auth.py:31-32` |
| L4 | Low | SQLite file in working directory | `daylog/daylog/config.py:7` |
| L5 | Low | Token ID probing via delete endpoint | `daylog/daylog/router/auth.py:116-130` |

---

## Priority Recommendations for Production Deployment

Before deploying to the public internet, address at minimum:

1. **Add `secure=True` to the session cookie** (H1) -- one line change
2. **Restrict or disable registration** (H2) -- add an invite code or disable the endpoint
3. **Add rate limiting** (H3) -- use `slowapi` or a reverse proxy
4. **Enforce minimum password length** (H4) -- add Pydantic Field validation
5. **Make CORS origin configurable** (M1) -- use an environment variable
6. **Disable API docs in production** (M2) -- conditional `docs_url=None`
7. **Make frontend API URL configurable** (M6) -- use Vite env variable
8. **Add security headers** (M5) -- middleware or reverse proxy
9. **Add input length limits** (M7) -- Pydantic Field constraints
10. **Deploy behind a reverse proxy** (nginx/Caddy) with HTTPS, body size limits, and rate limiting
