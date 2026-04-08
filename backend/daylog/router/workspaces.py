from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from daylog.auth import get_current_user
from daylog.db import get_db
from daylog.dependencies import get_user_workspace
from daylog.models import User, Workspace
from daylog.schemas import WorkspaceCreate, WorkspaceOut, WorkspaceUpdate

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


@router.get("", response_model=list[WorkspaceOut])
def list_workspaces(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all workspaces for the current user, ordered by name."""
    return db.query(Workspace).filter(Workspace.user_id == current_user.id).order_by(Workspace.name).all()


@router.post("", response_model=WorkspaceOut, status_code=201)
def create_workspace(body: WorkspaceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new workspace. Returns 409 if the name is already taken."""
    if db.query(Workspace).filter(Workspace.user_id == current_user.id, Workspace.name == body.name).first():
        raise HTTPException(409, "Workspace with this name already exists")
    ws = Workspace(user_id=current_user.id, name=body.name)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return ws


@router.get("/{workspace_id}", response_model=WorkspaceOut)
def get_workspace(ws: Workspace = Depends(get_user_workspace)):
    """Get a workspace by ID."""
    return ws


@router.patch("/{workspace_id}", response_model=WorkspaceOut)
def update_workspace(
    body: WorkspaceUpdate,
    ws: Workspace = Depends(get_user_workspace),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rename a workspace. Returns 409 if the new name is already taken."""
    existing = db.query(Workspace).filter(
        Workspace.user_id == current_user.id,
        Workspace.name == body.name,
        Workspace.id != ws.id,
    ).first()
    if existing:
        raise HTTPException(409, "Workspace with this name already exists")
    ws.name = body.name
    db.commit()
    db.refresh(ws)
    return ws


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Delete a workspace and all its day entries."""
    db.delete(ws)
    db.commit()
