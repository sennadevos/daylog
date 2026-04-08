from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from daylog.db import get_db
from daylog.dependencies import get_user_workspace
from daylog.models import DayEntry, Workspace
from daylog.schemas import DayEntryOut, StoryUpdate

router = APIRouter(prefix="/api/workspaces/{workspace_id}/days", tags=["days"])


def _get_or_create_day(db: Session, workspace_id: int, day: date) -> DayEntry:
    entry = db.query(DayEntry).filter(DayEntry.workspace_id == workspace_id, DayEntry.date == day).first()
    if not entry:
        entry = DayEntry(workspace_id=workspace_id, date=day)
        db.add(entry)
        db.commit()
        db.refresh(entry)
    return entry


@router.get("", response_model=list[DayEntryOut])
def list_days(
    limit: int = Query(default=30, ge=1, le=365),
    before: date | None = None,
    ws: Workspace = Depends(get_user_workspace),
    db: Session = Depends(get_db),
):
    """List day entries for a workspace, newest first. Supports cursor pagination via `before`."""
    q = db.query(DayEntry).filter(DayEntry.workspace_id == ws.id)
    if before:
        q = q.filter(DayEntry.date < before)
    return q.order_by(DayEntry.date.desc()).limit(limit).all()


@router.get("/{day}", response_model=DayEntryOut)
def get_day(day: date, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Get a single day entry, creating it if it doesn't exist."""
    return _get_or_create_day(db, ws.id, day)


@router.put("/{day}/story", response_model=StoryUpdate)
def update_story(day: date, body: StoryUpdate, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Set the story (markdown) for a day entry."""
    entry = _get_or_create_day(db, ws.id, day)
    entry.story = body.story
    db.commit()
    return {"story": entry.story}
