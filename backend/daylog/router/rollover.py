from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from daylog.auth import get_current_user
from daylog.db import get_db
from daylog.dependencies import get_user_workspace
from daylog.models import User, Workspace
from daylog.rollover import carry_backwards_sweep, carry_from_yesterday, rollover_all, rollover_workspace
from daylog.schemas import (
    CarryForwardRequest,
    CarryForwardResult,
    RolloverAllRequest,
    RolloverAllResult,
    RolloverRequest,
    RolloverResult,
)

router = APIRouter(prefix="/api", tags=["rollover"])


@router.post("/workspaces/{workspace_id}/rollover", response_model=RolloverResult)
def manual_rollover_workspace(body: RolloverRequest, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Roll over unchecked items from one date to another within a workspace."""
    rolled = rollover_workspace(db, ws.id, body.from_date, body.to_date)
    db.commit()
    return {"rolled_items": rolled}


@router.post("/rollover", response_model=RolloverAllResult)
def manual_rollover_all(body: RolloverAllRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Roll over all of the current user's workspaces, auto-detecting the most recent source day."""
    workspaces_processed, total_items = rollover_all(db, body.to_date, user_id=current_user.id)
    return {"workspaces_processed": workspaces_processed, "total_items_rolled": total_items}


@router.post("/workspaces/{workspace_id}/carry/yesterday", response_model=CarryForwardResult)
def carry_yesterday(body: CarryForwardRequest, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Carry unchecked items from yesterday to the target date."""
    carried = carry_from_yesterday(db, ws.id, body.to_date)
    db.commit()
    return {"carried_items": carried}


@router.post("/workspaces/{workspace_id}/carry/sweep", response_model=CarryForwardResult)
def carry_sweep(body: CarryForwardRequest, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Sweep all previous days for unchecked items, deduplicate by origin_id, carry latest version of each."""
    carried = carry_backwards_sweep(db, ws.id, body.to_date)
    db.commit()
    return {"carried_items": carried}
