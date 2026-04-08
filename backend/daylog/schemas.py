from datetime import date, datetime
from enum import Enum

from pydantic import BaseModel


# --- Auth ---


class UserCreate(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenCreate(BaseModel):
    name: str


class TokenOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenCreated(TokenOut):
    token: str


class ItemState(str, Enum):
    unchecked = "unchecked"
    checked = "checked"
    revoked = "revoked"


# --- Workspace ---


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceUpdate(BaseModel):
    name: str


class WorkspaceOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Todo Item ---


class ItemCreate(BaseModel):
    text: str
    description: str = ""
    position: int | None = None


class ItemUpdate(BaseModel):
    text: str | None = None
    description: str | None = None
    state: ItemState | None = None
    position: int | None = None


class ItemOut(BaseModel):
    id: int
    text: str
    description: str
    position: int
    state: ItemState
    origin_id: str

    model_config = {"from_attributes": True}


class ItemMove(BaseModel):
    to_date: date
    copy: bool = False


class ItemReorder(BaseModel):
    item_ids: list[int]


# --- Day Entry ---


class StoryUpdate(BaseModel):
    story: str


class DayEntryOut(BaseModel):
    id: int
    date: date
    story: str
    items: list[ItemOut]

    model_config = {"from_attributes": True}


# --- Rollover ---


class RolloverRequest(BaseModel):
    from_date: date
    to_date: date


class RolloverAllRequest(BaseModel):
    to_date: date


class RolloverResult(BaseModel):
    rolled_items: int


class RolloverAllResult(BaseModel):
    workspaces_processed: int
    total_items_rolled: int


# --- Carry Forward ---


class CarryForwardRequest(BaseModel):
    to_date: date


class CarryForwardResult(BaseModel):
    carried_items: int
