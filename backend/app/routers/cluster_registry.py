from __future__ import annotations

import csv
import io
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..db import get_db
from ..models import ClusterRegistry, ProjectMember
from ..schemas import ClusterRegRowIn, ClusterRegRowOut, ClusterRegUpdate, ClusterRegBulkIn
from ..deps import get_current_user, require_project_role
from ..routers.access import require_page_access

router = APIRouter(prefix="/cluster-registry", tags=["cluster-registry"])


# -----------------------
# LIST (только просмотр)
# -----------------------
@router.get("", response_model=List[ClusterRegRowOut])
async def list_registry(
    project_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_page_access(db, user, "clusters", "viewer")
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))
    
    rows = (
        await db.execute(
            select(ClusterRegistry)
            .where(ClusterRegistry.project_id == project_id)
            .order_by(ClusterRegistry.name)
        )
    ).scalars().all()
    return [ClusterRegRowOut.model_validate(r) for r in rows]


# -----------------------
# UPSERT ROW (требует editor)
# -----------------------
@router.post("", response_model=ClusterRegRowOut)
async def upsert_row(
    payload: ClusterRegRowIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_page_access(db, user, "clusters", "editor")
    await require_project_role(payload.project_id, user, db, roles=("editor", "admin"))

    insert_stmt = pg_insert(ClusterRegistry).values(
        **{**payload.model_dump(), "demand": payload.demand or 0}
    )
    stmt = insert_stmt.on_conflict_do_update(
        index_elements=[ClusterRegistry.project_id, ClusterRegistry.name],
        set_={
            "direction": payload.direction,
            "page_type": payload.page_type,
            "has_core": payload.has_core,
            "has_brief": payload.has_brief,
            "is_published": payload.is_published,
            "demand": payload.demand or 0,
            "updated_at": func.now(),
        },
    ).returning(ClusterRegistry)

    row = (await db.execute(stmt)).scalars().first()
    await db.commit()
    return ClusterRegRowOut.model_validate(row)


# -----------------------
# UPDATE ROW (требует editor)
# -----------------------
@router.patch("/{row_id}", response_model=ClusterRegRowOut)
async def update_row(
    row_id: uuid.UUID,
    payload: ClusterRegUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    r = (await db.execute(select(ClusterRegistry).where(ClusterRegistry.id == row_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")

    await require_page_access(db, user, "clusters", "editor")
    await require_project_role(r.project_id, user, db, roles=("editor", "admin"))

    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    if upd:
        upd["updated_at"] = func.now()
        await db.execute(update(ClusterRegistry).where(ClusterRegistry.id == row_id).values(**upd))
        await db.commit()

    r = (await db.execute(select(ClusterRegistry).where(ClusterRegistry.id == row_id))).scalar_one()
    return ClusterRegRowOut.model_validate(r)


# -----------------------
# DELETE ROW (требует editor)
# -----------------------
@router.delete("/{row_id}")
async def delete_row(
    row_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user)
):
    r = (await db.execute(select(ClusterRegistry).where(ClusterRegistry.id == row_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(404, "Not found")

    await require_page_access(db, user, "clusters", "editor")
    await require_project_role(r.project_id, user, db, roles=("editor", "admin"))
    
    await db.execute(delete(ClusterRegistry).where(ClusterRegistry.id == row_id))
    await db.commit()
    return {"ok": True}


# -----------------------
# BULK UPSERT (требует editor)
# -----------------------
@router.post("/bulk")
async def bulk_upsert(
    payload: ClusterRegBulkIn,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_page_access(db, user, "clusters", "editor")
    await require_project_role(payload.project_id, user, db, roles=("editor", "admin"))

    for row in payload.rows:
        if row.project_id != payload.project_id:
            raise HTTPException(400, "All rows must have the same project_id")

        insert_stmt = pg_insert(ClusterRegistry).values(
            **{**row.model_dump(), "demand": row.demand or 0}
        )
        stmt = insert_stmt.on_conflict_do_update(
            index_elements=[ClusterRegistry.project_id, ClusterRegistry.name],
            set_={
                "direction": row.direction,
                "page_type": row.page_type,
                "has_core": row.has_core,
                "has_brief": row.has_brief,
                "is_published": row.is_published,
                "demand": row.demand or 0,
                "updated_at": func.now(),
            },
        )
        await db.execute(stmt)

    await db.commit()
    return {"ok": True}


# -----------------------
# CSV IMPORT (требует editor)
# -----------------------
def _parse_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    s = (str(v) if v is not None else "").strip().lower()
    return s in {"1", "true", "t", "yes", "y", "да", "истина", "on", "+"}


def _parse_int(v, default: int = 0) -> int:
    if v is None:
        return default
    s = str(v).strip()
    if s == "":
        return default
    try:
        return int(float(s.replace(" ", "")))
    except Exception:
        return default


@router.post("/import-csv")
async def import_csv(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    await require_page_access(db, user, "clusters", "editor")
    await require_project_role(project_id, user, db, roles=("editor", "admin"))

    raw = await file.read()
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("cp1251")

    reader = csv.DictReader(io.StringIO(text), delimiter=",")

    processed = created = updated = 0
    errors: list[str] = []

    existing_names = set(
        (await db.execute(select(ClusterRegistry.name).where(ClusterRegistry.project_id == project_id))).scalars().all()
    )

    for idx, row in enumerate(reader, start=2):
        name = (row.get("Кластер") or row.get("кластер") or "").strip()
        if not name:
            errors.append(f"Строка {idx}: пустое поле «Кластер»")
            continue

        direction = (row.get("Направление") or row.get("направление") or None)
        direction = direction.strip() if direction else None

        page_type = (row.get("Тип страницы") or row.get("тип страницы") or None)
        page_type = page_type.strip() if page_type else None

        has_core = _parse_bool(row.get("Ядро"))
        has_brief = _parse_bool(row.get("ТЗ"))
        is_published = _parse_bool(row.get("Размещено"))
        demand = _parse_int(row.get("Спрос"), default=0)

        stmt = (
            pg_insert(ClusterRegistry)
            .values(
                id=uuid.uuid4(),
                project_id=project_id,
                name=name,
                direction=direction,
                page_type=page_type,
                has_core=has_core,
                has_brief=has_brief,
                is_published=is_published,
                demand=demand,
            )
            .on_conflict_do_update(
                index_elements=[ClusterRegistry.project_id, ClusterRegistry.name],
                set_={
                    "direction": direction,
                    "page_type": page_type,
                    "has_core": has_core,
                    "has_brief": has_brief,
                    "is_published": is_published,
                    "demand": demand,
                    "updated_at": func.now(),
                },
            )
        )
        await db.execute(stmt)
        processed += 1

        if name in existing_names:
            updated += 1
        else:
            created += 1
            existing_names.add(name)

    await db.commit()
    return {
        "processed": processed,
        "created": created,
        "updated": updated,
        "errors": errors,
    }