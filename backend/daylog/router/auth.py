import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from daylog.auth import (
    create_session,
    get_current_user,
    hash_password,
    hash_token,
    verify_password,
)
from daylog.config import settings
from daylog.db import get_db
from daylog.models import PersonalAccessToken, User, UserSession
from daylog.schemas import (
    LoginRequest,
    TokenCreate,
    TokenCreated,
    TokenOut,
    UserCreate,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(body: UserCreate, db: Session = Depends(get_db)):
    """Register a new user account."""
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(409, "Username already taken")
    user = User(username=body.username, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=UserOut)
def login(body: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate and set a session cookie."""
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Invalid credentials")
    session_id = create_session(db, user.id)
    db.commit()
    response.set_cookie(
        key="session",
        value=session_id,
        max_age=settings.session_max_age,
        httponly=True,
        samesite="lax",
        domain=settings.cookie_domain,
    )
    return user


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clear the session cookie and delete the server-side session."""
    # Delete all sessions for this user (simple approach)
    db.query(UserSession).filter(UserSession.user_id == current_user.id).delete()
    db.commit()
    response.delete_cookie(key="session", domain=settings.cookie_domain)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return current_user


# --- Personal Access Tokens ---


@router.post("/tokens", response_model=TokenCreated, status_code=201)
def create_token(
    body: TokenCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a personal access token. The plaintext token is returned only once."""
    raw_token = f"dlg_{secrets.token_urlsafe(32)}"
    pat = PersonalAccessToken(
        user_id=current_user.id,
        name=body.name,
        token_hash=hash_token(raw_token),
    )
    db.add(pat)
    db.commit()
    db.refresh(pat)
    return TokenCreated(
        id=pat.id,
        name=pat.name,
        created_at=pat.created_at,
        token=raw_token,
    )


@router.get("/tokens", response_model=list[TokenOut])
def list_tokens(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all personal access tokens for the current user (without the token values)."""
    return db.query(PersonalAccessToken).filter(
        PersonalAccessToken.user_id == current_user.id
    ).order_by(PersonalAccessToken.created_at).all()


@router.delete("/tokens/{token_id}", status_code=204)
def delete_token(
    token_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke a personal access token."""
    pat = db.query(PersonalAccessToken).filter(
        PersonalAccessToken.id == token_id,
        PersonalAccessToken.user_id == current_user.id,
    ).first()
    if not pat:
        raise HTTPException(404, "Token not found")
    db.delete(pat)
    db.commit()
