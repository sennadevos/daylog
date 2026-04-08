from datetime import date
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from daylog.db import get_db
from daylog.dependencies import get_user_workspace
from daylog.models import DayEntry, TodoItem, Workspace
from daylog.schemas import ItemCreate, ItemMove, ItemOut, ItemReorder, ItemUpdate

router = APIRouter(prefix="/api/workspaces/{workspace_id}/days/{day}/items", tags=["items"])


def _get_or_create_day(db: Session, workspace: Workspace, day: date) -> DayEntry:
    entry = db.query(DayEntry).filter(DayEntry.workspace_id == workspace.id, DayEntry.date == day).first()
    if not entry:
        entry = DayEntry(workspace_id=workspace.id, date=day)
        db.add(entry)
        db.commit()
        db.refresh(entry)
    return entry


def _get_item(db: Session, day_entry: DayEntry, item_id: int) -> TodoItem:
    item = db.query(TodoItem).filter(TodoItem.id == item_id, TodoItem.day_entry_id == day_entry.id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    return item


@router.post("", response_model=ItemOut, status_code=201)
def create_item(day: date, body: ItemCreate, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Add a todo item. Appends to the end unless `position` is specified."""
    entry = _get_or_create_day(db, ws, day)
    if body.position is not None:
        position = body.position
    else:
        max_pos = db.query(func.max(TodoItem.position)).filter(TodoItem.day_entry_id == entry.id).scalar()
        position = (max_pos or 0) + 1
    item = TodoItem(day_entry_id=entry.id, text=body.text, description=body.description, position=position, origin_id=str(uuid4()))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(day: date, item_id: int, body: ItemUpdate, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Update an item's text, state, or position."""
    entry = _get_or_create_day(db, ws, day)
    item = _get_item(db, entry, item_id)
    if body.text is not None:
        item.text = body.text
    if body.description is not None:
        item.description = body.description
    if body.state is not None:
        item.state = body.state
    if body.position is not None:
        item.position = body.position
    db.commit()
    db.refresh(item)
    return item


@router.post("/{item_id}/move", response_model=ItemOut)
def move_item(day: date, item_id: int, body: ItemMove, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Move or copy (postpone) an item to another day within the same workspace."""
    entry = _get_or_create_day(db, ws, day)
    item = _get_item(db, entry, item_id)
    target = _get_or_create_day(db, ws, body.to_date)
    max_pos = db.query(func.max(TodoItem.position)).filter(TodoItem.day_entry_id == target.id).scalar()

    if body.copy:
        # Postpone: create a copy on the target day, leave original untouched.
        # Skip if an item with the same origin_id already exists on the target day.
        existing = db.query(TodoItem.id).filter(
            TodoItem.day_entry_id == target.id,
            TodoItem.origin_id == item.origin_id,
        ).first()
        if existing:
            raise HTTPException(409, "Item with this origin already exists on the target day")
        new_item = TodoItem(
            day_entry_id=target.id,
            text=item.text,
            description=item.description,
            position=(max_pos or 0) + 1,
            state="unchecked",
            origin_id=item.origin_id,
        )
        db.add(new_item)
        db.commit()
        db.refresh(new_item)
        return new_item
    else:
        # Hard move: relocate the item to the target day.
        item.day_entry_id = target.id
        item.position = (max_pos or 0) + 1
        db.commit()
        db.refresh(item)
        return item


@router.delete("/{item_id}", status_code=204)
def delete_item(day: date, item_id: int, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Hard-delete an item."""
    entry = _get_or_create_day(db, ws, day)
    item = _get_item(db, entry, item_id)
    db.delete(item)
    db.commit()


@router.put("/reorder", response_model=list[ItemOut])
def reorder_items(day: date, body: ItemReorder, ws: Workspace = Depends(get_user_workspace), db: Session = Depends(get_db)):
    """Set the order of items by providing the full list of item IDs in desired order."""
    entry = _get_or_create_day(db, ws, day)
    items = db.query(TodoItem).filter(TodoItem.day_entry_id == entry.id).all()
    item_map = {item.id: item for item in items}
    for pos, item_id in enumerate(body.item_ids, start=1):
        if item_id not in item_map:
            raise HTTPException(400, f"Item {item_id} not found in this day")
        item_map[item_id].position = pos
    db.commit()
    return db.query(TodoItem).filter(TodoItem.day_entry_id == entry.id).order_by(TodoItem.position).all()
