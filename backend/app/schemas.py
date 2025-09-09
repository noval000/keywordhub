from __future__ import annotations

import uuid
import datetime as dt
from typing import Optional, Any, Dict, List
from pydantic import BaseModel, Field, field_validator

# ---------------- Projects ----------------

class ProjectCreate(BaseModel):
    name: str
    region: Optional[str] = None
    domain: Optional[str] = None

class ProjectOut(BaseModel):
    id: uuid.UUID
    name: str
    region: Optional[str] = None
    domain: Optional[str] = None
    is_archived: bool
    archived_at: Optional[dt.datetime] = None

    class Config:
        from_attributes = True

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    domain: Optional[str] = None
    is_archived: Optional[bool] = None

# ---------------- Dictionaries ----------------

class DirectionCreate(BaseModel):
    name: str

class ClusterCreate(BaseModel):
    name: str

# ---------------- Queries: import ядра (single-project) ----------------

class QueryItem(BaseModel):
    phrase: str
    direction: Optional[str] = None
    cluster: Optional[str] = None
    page: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    page_type: Optional[str] = None
    query_type: Optional[str] = None
    ws_flag: int | None = None
    date: Optional[str] = None  # YYYY-MM-DD

class ImportRequest(BaseModel):
    project_id: uuid.UUID
    default_direction: Optional[str] = None
    default_cluster: Optional[str] = None
    default_query_type: Optional[str] = None
    items: List[QueryItem]

class QueryRowOut(BaseModel):
    id: uuid.UUID
    phrase: str
    direction: Optional[str]
    cluster: Optional[str]
    page: Optional[str]
    tags: List[str]
    page_type: Optional[str]
    query_type: Optional[str]
    ws_flag: int
    dt: Optional[dt.date]

    class Config:
        from_attributes = True

# ---------------- Queries: bulk / versions / undo ----------------

class BulkUpdate(BaseModel):
    ids: List[uuid.UUID]
    set_cluster: Optional[str] = None
    set_direction: Optional[str] = None
    set_page: Optional[str] = None
    set_tags: Optional[List[str]] = None
    add_tags: Optional[List[str]] = None
    remove_tags: Optional[List[str]] = None
    set_page_type: Optional[str] = None
    set_query_type: Optional[str] = None
    set_ws_flag: int | None = None
    set_dt: str | None = None  # "YYYY-MM-DD"; None = не менять, "" = очистить

class VersionRow(BaseModel):
    version: int
    created_at: str
    author_id: uuid.UUID | None = None
    before: Dict[str, Any] | None = None
    after: Dict[str, Any] | None = None

class UndoRequest(BaseModel):
    ids: List[uuid.UUID]
    to_version: Optional[int] = None

# ---------------- Auth / Members ----------------

class UserCreate(BaseModel):
    email: str
    name: str | None = None
    password: str

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class MemberAdd(BaseModel):
    user_id: uuid.UUID
    role: str  # viewer|editor|admin

# ---------------- Delete rows ----------------

class DeleteRequest(BaseModel):
    ids: List[uuid.UUID]

# ---------------- Queries: Global Delete ----------------

class GlobalDeleteFilters(BaseModel):
    phrase_contains: Optional[str] = None
    page_contains: Optional[str] = None
    tag_contains: Optional[str] = None
    direction_contains: Optional[str] = None
    cluster_contains: Optional[str] = None
    ws_min: Optional[int] = None
    ws_max: Optional[int] = None
    date_from: Optional[str] = None  # YYYY-MM-DD
    date_to: Optional[str] = None    # YYYY-MM-DD

class GlobalDeletePreviewRow(BaseModel):
    project_id: uuid.UUID
    project_name: str
    count: int

class GlobalDeletePreviewOut(BaseModel):
    total: int
    per_project: list[GlobalDeletePreviewRow]

class GlobalDeleteApplyIn(BaseModel):
    project_ids: list[uuid.UUID] = Field(..., min_items=1)
    filters: GlobalDeleteFilters
    confirm: str

    @field_validator("confirm")
    @classmethod
    def _confirm_must_be_delete(cls, v: str) -> str:
        if (v or "").strip().upper() != "DELETE":
            raise ValueError("confirm must be 'DELETE'")
        return v

# ---------------- Cluster registry ----------------

class ClusterRegRowIn(BaseModel):
    project_id: uuid.UUID
    name: str
    direction: Optional[str] = None
    page_type: Optional[str] = None
    has_core: bool = False
    has_brief: bool = False
    is_published: bool = False
    demand: int = 0

class ClusterRegRowOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    direction: Optional[str]
    page_type: Optional[str]
    has_core: bool
    has_brief: bool
    is_published: bool
    demand: int
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True

class ClusterRegUpdate(BaseModel):
    direction: Optional[str] = None
    page_type: Optional[str] = None
    has_core: Optional[bool] = None
    has_brief: Optional[bool] = None
    is_published: Optional[bool] = None
    demand: Optional[int] = None

class ClusterRegBulkIn(BaseModel):
    project_id: uuid.UUID
    rows: List[ClusterRegRowIn] = Field(..., min_items=1)

# ---------------- Content Plan ----------------
# Базовые поля записи КП
class ContentPlanItemBase(BaseModel):
    period: Optional[str] = None
    section: Optional[str] = None
    direction: Optional[str] = None
    topic: Optional[str] = None
    tz: Optional[str] = None
    chars: Optional[int] = None
    status: Optional[str] = None
    author: Optional[str] = None
    review: Optional[str] = None
    meta_seo: Optional[str] = None
    doctor_review: Optional[bool] = None
    # ВАЖНО: было Optional[bool], меняем на строку — фронт шлёт текст
    publish_allowed: Optional[str] = None
    comment: Optional[str] = None
    link: Optional[str] = None
    publish_date: Optional[dt.date] = None

# Входная запись для create/update
class ContentPlanItemIn(ContentPlanItemBase):
    pass

# Входная запись для импорта (каждая строка — с явным project_id)
class ContentPlanItemInWithProject(ContentPlanItemBase):
    project_id: uuid.UUID

# Для одиночного создания через POST /content-plan
class ContentPlanCreate(BaseModel):
    project_ids: List[uuid.UUID] = Field(..., min_items=1)
    item: ContentPlanItemIn

# Для обновления одной записи
class ContentPlanUpdate(BaseModel):
    item: ContentPlanItemIn

# Для списка
class ContentPlanItemOut(ContentPlanItemBase):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    created_at: dt.datetime
    updated_at: dt.datetime

    class Config:
        from_attributes = True

class ContentPlanImportRequest(BaseModel):
    items: List[ContentPlanItemInWithProject] = Field(..., min_items=1)

class ContentPlanListFilters(BaseModel):
    project_id: Optional[uuid.UUID] = None
    search: Optional[str] = None
    status: Optional[str] = None
    period: Optional[str] = None
    author: Optional[str] = None
    limit: int = Field(50, ge=1, le=500)
    offset: int = Field(0, ge=0)

class ContentPlanCountOut(BaseModel):
    total: int

# ---------------- Queries: мульти-импорт (ВОЗВРАТИЛИ) ----------------

class ImportItem(BaseModel):
    phrase: str
    direction: Optional[str] = None
    cluster: Optional[str] = None
    page: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    page_type: Optional[str] = None
    query_type: Optional[str] = None
    ws_flag: Optional[int] = None
    date: Optional[str] = None  # YYYY-MM-DD

class ImportRequestMulti(BaseModel):
    project_ids: List[uuid.UUID] = Field(..., min_items=1)
    default_direction: Optional[str] = None
    default_cluster: Optional[str] = None
    default_query_type: Optional[str] = None
    items: List[ImportItem] = Field(..., min_items=1)

# ---------------- User + Page Access ----------------

class UserWithAccessOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: Optional[str]
    role: str  # viewer|editor|admin
    pages: List[str] = []

class UpdateUserAccessIn(BaseModel):
    role: Optional[str] = Field(None, pattern="^(viewer|editor|admin)$")
    pages_grant: Optional[List[str]] = None
    pages_revoke: Optional[List[str]] = None

class PageRoleUpdate(BaseModel):
    page: str
    role: str = Field(pattern="^(viewer|editor)$")
    project_id: Optional[UUID] = None