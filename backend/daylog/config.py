import secrets

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:///daylog.db"
    session_secret: str = secrets.token_urlsafe(32)
    session_max_age: int = 30 * 86400  # 30 days
    cookie_domain: str | None = None
    cors_origins: str = "http://localhost:5173"


settings = Settings()
