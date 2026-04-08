import hashlib
import secrets
from datetime import datetime, timedelta

import bcrypt
from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from daylog.config import settings
from daylog.db import get_db
from daylog.models import PersonalAccessToken, User, UserSession


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(db: Session, user_id: int) -> str:
    session_id = secrets.token_urlsafe(32)
    session = UserSession(
        id=session_id,
        user_id=user_id,
        expires_at=datetime.now() + timedelta(seconds=settings.session_max_age),
    )
    db.add(session)
    db.flush()
    return session_id


def _get_user_from_session(db: Session, session_id: str | None) -> User | None:
    if not session_id:
        return None
    session = db.get(UserSession, session_id)
    if not session or session.expires_at < datetime.now():
        if session:
            db.delete(session)
            db.flush()
        return None
    return session.user


def _get_user_from_bearer(db: Session, request: Request) -> User | None:
    auth = request.headers.get("authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    token_hash = hash_token(token)
    pat = db.query(PersonalAccessToken).filter(PersonalAccessToken.token_hash == token_hash).first()
    if not pat:
        return None
    return pat.user


def get_current_user(
    request: Request,
    session_id: str | None = Cookie(default=None, alias="session"),
    db: Session = Depends(get_db),
) -> User:
    user = _get_user_from_session(db, session_id)
    if not user:
        user = _get_user_from_bearer(db, request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user
