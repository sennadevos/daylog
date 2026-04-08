from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from daylog.auth import get_current_user
from daylog.db import get_db
from daylog.models import User, Workspace


def get_user_workspace(
    workspace_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Workspace:
    ws = db.query(Workspace).filter(
        Workspace.id == workspace_id,
        Workspace.user_id == current_user.id,
    ).first()
    if not ws:
        raise HTTPException(404, "Workspace not found")
    return ws
