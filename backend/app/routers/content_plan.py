from __future__ import annotations

import uuid
import datetime as dt
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query as Q, Body
from sqlalchemy import select, func, or_, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user, get_db, require_project_role
from ..models import ContentPlanItem, User
from .. import schemas as S
from ..routers.access import require_page_access

router = APIRouter(prefix="/content-plan", tags=["content-plan"])


def _str_or_none(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _apply_str_fields(obj, payload: dict):
    for attr in (
        "period",
        "section",
        "direction",
        "topic",
        "tz",
        "status",
        "author",
        "review",
        "meta_seo",
        "comment",
        "link",
    ):
        if attr in payload:
            setattr(obj, attr, _str_or_none(payload.get(attr)))
    if "chars" in payload:
        obj.chars = payload.get("chars")
    if "publish_date" in payload:
        obj.publish_date = payload.get("publish_date")


# -----------------------
# LIST (только просмотр)
# -----------------------
@router.get("", response_model=List[S.ContentPlanItemOut])
async def list_content_plan(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    project_id: Optional[uuid.UUID] = Q(default=None),
    search: Optional[str] = Q(default=None),
    status: Optional[str] = Q(default=None),
    period: Optional[str] = Q(default=None),
    author: Optional[str] = Q(default=None),
    limit: int = Q(default=50, ge=1, le=500),
    offset: int = Q(default=0, ge=0),
):
    await require_page_access(db, user, "content_plan", "viewer")
    if project_id:
        await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))

    stmt = select(ContentPlanItem).order_by(ContentPlanItem.created_at.desc())
    if project_id:
        stmt = stmt.where(ContentPlanItem.project_id == project_id)
    if status:
        stmt = stmt.where(ContentPlanItem.status == status)
    if period:
        stmt = stmt.where(ContentPlanItem.period == period)
    if author:
        stmt = stmt.where(ContentPlanItem.author == author)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                ContentPlanItem.topic.ilike(like),
                ContentPlanItem.section.ilike(like),
                ContentPlanItem.direction.ilike(like),
                ContentPlanItem.comment.ilike(like),
                ContentPlanItem.meta_seo.ilike(like),
                ContentPlanItem.author.ilike(like),
            )
        )
    rows = (await db.execute(stmt.limit(limit).offset(offset))).scalars().all()
    return rows


# -----------------------
# COUNT (только просмотр)
# -----------------------
@router.get("/count", response_model=S.ContentPlanCountOut)
async def count_content_plan(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    project_id: Optional[uuid.UUID] = Q(default=None),
    search: Optional[str] = Q(default=None),
    status: Optional[str] = Q(default=None),
    period: Optional[str] = Q(default=None),
    author: Optional[str] = Q(default=None),
):
    await require_page_access(db, user, "content_plan", "viewer")
    if project_id:
        await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))

    stmt = select(func.count(ContentPlanItem.id))
    if project_id:
        stmt = stmt.where(ContentPlanItem.project_id == project_id)
    if status:
        stmt = stmt.where(ContentPlanItem.status == status)
    if period:
        stmt = stmt.where(ContentPlanItem.period == period)
    if author:
        stmt = stmt.where(ContentPlanItem.author == author)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                ContentPlanItem.topic.ilike(like),
                ContentPlanItem.section.ilike(like),
                ContentPlanItem.direction.ilike(like),
                ContentPlanItem.comment.ilike(like),
                ContentPlanItem.meta_seo.ilike(like),
                ContentPlanItem.author.ilike(like),
            )
        )
    total = (await db.execute(stmt)).scalar_one()
    return S.ContentPlanCountOut(total=total)


# -----------------------
# CREATE (требует editor)
# -----------------------
@router.post("", response_model=List[S.ContentPlanItemOut])
async def create_content_plan_item(
    data: S.ContentPlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not data.project_ids:
        raise HTTPException(422, "project_ids is required")

    created_rows: List[ContentPlanItem] = []
    for pid in data.project_ids:
        await require_page_access(db, user, "content_plan", "editor")
        await require_project_role(pid, user, db, roles=("editor", "admin"))

        it = data.item
        row = ContentPlanItem(
            id=uuid.uuid4(),
            project_id=pid,
            version=1,
            created_by=user.id,
            updated_by=user.id,
        )
        payload = it.model_dump(exclude_unset=True)
        _apply_str_fields(row, payload)

        if "doctor_review" in payload:
            row.doctor_review = payload.get("doctor_review")

        db.add(row)
        created_rows.append(row)

    await db.commit()
    for r in created_rows:
        await db.refresh(r)
    return created_rows


# -----------------------
# UPDATE (требует editor)
# -----------------------
@router.patch("/{item_id}", response_model=S.ContentPlanItemOut)
async def update_content_plan_item(
    item_id: uuid.UUID,
    data: S.ContentPlanUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = (await db.execute(
        select(ContentPlanItem).where(ContentPlanItem.id == item_id)
    )).scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Item not found")

    await require_page_access(db, user, "content_plan", "editor")
    await require_project_role(row.project_id, user, db, roles=("editor", "admin"))

    payload = data.item.model_dump(exclude_unset=True)
    _apply_str_fields(row, payload)

    if "doctor_review" in payload:
        row.doctor_review = payload.get("doctor_review")

    row.updated_by = user.id
    row.version = (row.version or 1) + 1

    await db.commit()
    await db.refresh(row)
    return row


# -----------------------
# DELETE (требует editor)
# -----------------------
@router.delete("")
async def delete_content_plan_items(
    ids: List[uuid.UUID] = Body(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not ids:
        return {"deleted": 0}

    # проверка прав на каждый проект
    rows = (await db.execute(select(ContentPlanItem.project_id).where(ContentPlanItem.id.in_(ids)))).scalars().all()
    for pid in set(rows):
        await require_page_access(db, user, "content_plan", "editor")
        await require_project_role(pid, user, db, roles=("editor", "admin"))

    await db.execute(delete(ContentPlanItem).where(ContentPlanItem.id.in_(ids)))
    await db.commit()
    return {"deleted": len(ids)}


# -----------------------
# IMPORT (требует editor)
# -----------------------
@router.post("/import", response_model=dict)
async def import_content_plan(
    data: S.ContentPlanImportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    created = 0
    for it in data.items:
        await require_page_access(db, user, "content_plan", "editor")
        await require_project_role(it.project_id, user, db, roles=("editor", "admin"))

        row = ContentPlanItem(
            id=uuid.uuid4(),
            project_id=it.project_id,
            version=1,
            created_by=user.id,
            updated_by=user.id,
        )
        payload = it.model_dump(exclude_unset=True)
        _apply_str_fields(row, payload)
        if "doctor_review" in payload:
            row.doctor_review = payload.get("doctor_review")
        db.add(row)
        created += 1
    await db.commit()
    return {"created": created, "duplicates": 0}