from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from daylog.models import DayEntry, TodoItem, Workspace


def _get_or_create_day(db: Session, workspace_id: int, target_date: date) -> DayEntry:
    target = db.query(DayEntry).filter(
        DayEntry.workspace_id == workspace_id, DayEntry.date == target_date
    ).first()
    if not target:
        target = DayEntry(workspace_id=workspace_id, date=target_date)
        db.add(target)
        db.flush()
    return target


def _existing_origin_ids(db: Session, day_entry_id: int) -> set[str]:
    return set(
        row[0] for row in db.query(TodoItem.origin_id).filter(
            TodoItem.day_entry_id == day_entry_id
        ).all()
    )


def _copy_items(db: Session, target: DayEntry, items: list[TodoItem]) -> int:
    """Copy items to target day, skipping origin_ids already present. Returns count copied."""
    existing = _existing_origin_ids(db, target.id)
    max_pos = db.query(func.max(TodoItem.position)).filter(
        TodoItem.day_entry_id == target.id
    ).scalar() or 0

    copied = 0
    for item in items:
        if item.origin_id in existing:
            continue
        copied += 1
        new_item = TodoItem(
            day_entry_id=target.id,
            text=item.text,
            description=item.description,
            position=max_pos + copied,
            state="unchecked",
            origin_id=item.origin_id,
        )
        db.add(new_item)

    return copied


def rollover_workspace(db: Session, workspace_id: int, from_date: date, to_date: date) -> int:
    """Copy unchecked items from from_date to to_date. Returns count of items rolled."""
    source = db.query(DayEntry).filter(
        DayEntry.workspace_id == workspace_id, DayEntry.date == from_date
    ).first()
    if not source:
        return 0

    unchecked = db.query(TodoItem).filter(
        TodoItem.day_entry_id == source.id, TodoItem.state == "unchecked"
    ).order_by(TodoItem.position).all()
    if not unchecked:
        return 0

    target = _get_or_create_day(db, workspace_id, to_date)
    return _copy_items(db, target, unchecked)


def rollover_all(db: Session, target_date: date, user_id: int | None = None) -> tuple[int, int]:
    """Roll over workspaces. If user_id is given, only that user's workspaces.
    Otherwise all workspaces (used by the midnight job).
    Returns (workspaces_processed, total_items_rolled).
    """
    q = db.query(Workspace)
    if user_id is not None:
        q = q.filter(Workspace.user_id == user_id)
    workspaces = q.all()
    total_workspaces = 0
    total_items = 0

    for ws in workspaces:
        # Find the most recent day_entry before target_date that has unchecked items
        latest = (
            db.query(DayEntry)
            .filter(DayEntry.workspace_id == ws.id, DayEntry.date < target_date)
            .order_by(DayEntry.date.desc())
            .all()
        )
        for day_entry in latest:
            has_unchecked = db.query(TodoItem).filter(
                TodoItem.day_entry_id == day_entry.id, TodoItem.state == "unchecked"
            ).first()
            if has_unchecked:
                rolled = rollover_workspace(db, ws.id, day_entry.date, target_date)
                if rolled > 0:
                    total_workspaces += 1
                    total_items += rolled
                break

    db.commit()
    return total_workspaces, total_items


def carry_from_yesterday(db: Session, workspace_id: int, target_date: date) -> int:
    """Carry unchecked items from the day immediately before target_date."""
    yesterday = target_date - timedelta(days=1)
    return rollover_workspace(db, workspace_id, yesterday, target_date)


def carry_backwards_sweep(db: Session, workspace_id: int, target_date: date) -> int:
    """Scan all previous days for unchecked items. Deduplicate by origin_id,
    keeping the latest version of each. Copy to target_date."""
    target = _get_or_create_day(db, workspace_id, target_date)

    # All unchecked items from all previous days, most recent first
    past_unchecked = (
        db.query(TodoItem)
        .join(DayEntry, TodoItem.day_entry_id == DayEntry.id)
        .filter(
            DayEntry.workspace_id == workspace_id,
            DayEntry.date < target_date,
            TodoItem.state == "unchecked",
        )
        .order_by(DayEntry.date.desc(), TodoItem.position.asc())
        .all()
    )

    # Deduplicate by origin_id: first occurrence wins (most recent day due to ordering)
    seen: set[str] = set()
    unique: list[TodoItem] = []
    for item in past_unchecked:
        if item.origin_id not in seen:
            seen.add(item.origin_id)
            unique.append(item)

    return _copy_items(db, target, unique)
