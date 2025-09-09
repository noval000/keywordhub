from __future__ import annotations

import uuid
from datetime import date
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, Query as Q, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy import select, update, func, text, and_, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.sql import literal_column
from ..routers.access import require_page_access

from ..db import get_db
from ..models import Query, Direction, Cluster, User, Project, ProjectMember, ClusterRegistry
from ..schemas import (
    ImportRequest,
    QueryRowOut,
    BulkUpdate,
    VersionRow,
    UndoRequest,
    DeleteRequest,
    ImportRequestMulti,
    GlobalDeleteFilters,
    GlobalDeletePreviewOut,
    GlobalDeletePreviewRow,
    GlobalDeleteApplyIn,
    QueryItem,
    ImportItem,
)
from ..deps import get_current_user, require_project_role

router = APIRouter(prefix="/queries", tags=["queries"])


# ===== helpers =====

async def _ensure_member(project_id: uuid.UUID, user, db: AsyncSession):
    """Любой участник проекта имеет доступ, либо суперюзер."""
    if getattr(user, "is_superuser", False):
        return
    pm = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.user_id == user.id,
                ProjectMember.project_id == project_id,
            )
        )
    ).scalar_one_or_none()
    if not pm:
        raise HTTPException(status_code=403, detail="No access to project")


def _ws_to_int(val) -> int:
    """Парсит Wordstat в целое число >= 0."""
    if val is None:
        return 0
    s = str(val).strip().lower()
    if s in ("true", "t", "yes", "y", "да", "+"):
        return 1
    if s in ("false", "f", "no", "n", "нет", "-"):
        return 0
    s_clean = s.replace(" ", "").replace(",", "")
    try:
        n = int(float(s_clean))
        return n if n > 0 else 0
    except Exception:
        return 0


async def get_or_create_direction(db: AsyncSession, project_id: uuid.UUID, name: str) -> uuid.UUID:
    q = await db.execute(select(Direction).where(Direction.project_id == project_id, Direction.name == name))
    d = q.scalar_one_or_none()
    if d:
        return d.id
    d = Direction(project_id=project_id, name=name)
    db.add(d)
    await db.flush()
    return d.id


async def get_or_create_cluster(db: AsyncSession, project_id: uuid.UUID, name: str) -> uuid.UUID:
    q = await db.execute(select(Cluster).where(Cluster.project_id == project_id, Cluster.name == name))
    c = q.scalar_one_or_none()
    if c:
        return c.id
    c = Cluster(project_id=project_id, name=name)
    db.add(c)
    await db.flush()
    return c.id


def _ilike(s: str) -> str:
    return f"%{s.replace('%', '').replace('_', '')}%"


@router.get("/count")
async def count_queries(
    project_id: uuid.UUID = Q(...),
    direction: Optional[str] = Q(None),
    cluster: Optional[str] = Q(None),
    search: Optional[str] = Q(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("viewer","editor","admin"))
    D, C, Qr = Direction, Cluster, Query
    stmt = select(func.count(Qr.id)) \
        .select_from(Qr) \
        .join(D, D.id==Qr.direction_id, isouter=True) \
        .join(C, C.id==Qr.cluster_id, isouter=True) \
        .where(Qr.project_id==project_id)

    if direction:
        stmt = stmt.where(D.name==direction)
    if cluster:
        stmt = stmt.where(C.name==cluster)
    if search:
        stmt = stmt.where(Qr.phrase.ilike(_ilike(search)))

    total = (await db.execute(stmt)).scalar_one()
    return {"total": int(total)}

@router.get("/statistics")
async def get_queries_statistics(
    project_id: uuid.UUID = Q(...),
    direction: Optional[str] = Q(None),
    cluster: Optional[str] = Q(None),
    search: Optional[str] = Q(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Получить статистику по запросам проекта"""
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))

    D, C, Qr = Direction, Cluster, Query

    # Базовый запрос с JOIN для фильтрации
    stmt = (
        select(Qr.id, D.name.label('direction'), C.name.label('cluster'), Qr.page, Qr.tags)
        .select_from(Qr)
        .join(D, D.id == Qr.direction_id, isouter=True)
        .join(C, C.id == Qr.cluster_id, isouter=True)
        .where(Qr.project_id == project_id)
    )

    # Применяем фильтры
    if direction:
        stmt = stmt.where(D.name == direction)
    if cluster:
        stmt = stmt.where(C.name == cluster)
    if search:
        stmt = stmt.where(Qr.phrase.ilike(_ilike(search)))

    # Выполняем запрос и считаем на Python стороне
    rows = (await db.execute(stmt)).all()

    total = len(rows)
    with_direction = sum(1 for r in rows if r.direction is not None and r.direction.strip() != "")
    with_cluster = sum(1 for r in rows if r.cluster is not None and r.cluster.strip() != "")
    # Исправленная логика для страниц - считаем непустые и не None
    with_page = sum(1 for r in rows if r.page is not None and r.page.strip() != "")
    with_tags = sum(1 for r in rows if r.tags and len(r.tags) > 0)

    return {
        "total": total,
        "with_direction": with_direction,
        "with_cluster": with_cluster,
        "with_page": with_page,
        "with_tags": with_tags
    }

# ===== import (single project) =====
@router.post("/import")
async def import_queries(
    req: ImportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(req.project_id, user, db, roles=("editor", "admin"))
    # валидация наличия кластеров в реестре
    await _validate_clusters_exist(db, req.project_id, req.items, req.default_cluster)

    dir_cache: Dict[str, uuid.UUID] = {}
    clu_cache: Dict[str, uuid.UUID] = {}

    async def dir_id(name: Optional[str]):
        if not name:
            return None
        if name in dir_cache:
            return dir_cache[name]
        did = await get_or_create_direction(db, req.project_id, name)
        dir_cache[name] = did
        return did

    async def clu_id(name: Optional[str]):
        if not name:
            return None
        if name in clu_cache:
            return clu_cache[name]
        cid = await get_or_create_cluster(db, req.project_id, name)
        clu_cache[name] = cid
        return cid

    rows: List[dict] = []
    for it in req.items:
        phrase = (it.phrase or "").strip()
        if not phrase:
            continue

        dname = it.direction or req.default_direction
        cname = it.cluster or req.default_cluster
        did = await dir_id(dname) if dname else None
        cid = await clu_id(cname) if cname else None

        dval = date.fromisoformat(it.date) if it.date else None
        ws = _ws_to_int(getattr(it, "ws_flag", None))

        rows.append(
            dict(
                id=uuid.uuid4(),
                project_id=req.project_id,
                direction_id=did,
                cluster_id=cid,
                phrase=phrase,
                page=it.page,
                tags=it.tags or [],
                page_type=it.page_type,
                query_type=it.query_type or req.default_query_type,
                ws_flag=ws,
                dt=dval,
                created_by=user.id,
                updated_by=user.id,
            )
        )

    if not rows:
        return {"processed": 0}

    stmt = pg_insert(Query.__table__).values(rows)
    upsert = stmt.on_conflict_do_update(
        index_elements=["project_id", "direction_id", "phrase"],
        set_={
            "cluster_id": stmt.excluded.cluster_id,
            "page": stmt.excluded.page,
            "tags": stmt.excluded.tags,
            "page_type": stmt.excluded.page_type,
            "query_type": stmt.excluded.query_type,
            "ws_flag": stmt.excluded.ws_flag,
            "dt": stmt.excluded.dt,
            "updated_at": func.now(),
            "updated_by": user.id,
            "version": Query.version + 1,
        },
    )
    await db.execute(upsert)
    await db.commit()
    return {"processed": len(rows)}


# ===== list =====
@router.get("", response_model=list[QueryRowOut])
async def list_queries(
    project_id: uuid.UUID = Q(...),
    direction: Optional[str] = Q(None),
    cluster: Optional[str] = Q(None),
    search: Optional[str] = Q(None),
    limit: int = Q(50, ge=1, le=500),
    offset: int = Q(0, ge=0),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))
    D, C, Qr = Direction, Cluster, Query
    stmt = (
        select(
            Qr.id,
            Qr.phrase,
            Qr.page,
            Qr.tags,
            Qr.page_type,
            Qr.query_type,
            Qr.ws_flag,
            Qr.dt,
            D.name.label("direction"),
            C.name.label("cluster"),
        )
        .join(D, D.id == Qr.direction_id, isouter=True)
        .join(C, C.id == Qr.cluster_id, isouter=True)
        .where(Qr.project_id == project_id)
        .order_by(Qr.updated_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if direction:
        stmt = stmt.where(D.name == direction)
    if cluster:
        stmt = stmt.where(C.name == cluster)
    if search:
        stmt = stmt.where(Qr.phrase.ilike(_ilike(search)))

    rows = (await db.execute(stmt)).all()
    return [
        QueryRowOut(
            id=r.id,
            phrase=r.phrase,
            direction=r.direction,
            cluster=r.cluster,
            page=r.page,
            tags=r.tags or [],
            page_type=r.page_type,
            query_type=r.query_type,
            ws_flag=r.ws_flag,
            dt=r.dt,
        )
        for r in rows
    ]


# ===== bulk update =====

def _parse_dt(s: str | None):
    if s is None:
        return None  # поле не менять
    s = s.strip()
    if s == "":
        return ""  # маркер «очистить»
    try:
        return date.fromisoformat(s)  # ожидаем YYYY-MM-DD
    except Exception:
        return None  # игнорируем некорректный ввод


@router.post("/bulk")
async def bulk_update(
    payload: BulkUpdate,
    project_id: uuid.UUID = Q(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("editor", "admin"))
    if not payload.ids:
        return {"updated": 0}

    set_values = {
        "updated_at": func.now(),
        "version": Query.version + 1,
        "updated_by": user.id,
    }
    if payload.set_direction:
        did = await get_or_create_direction(db, project_id, payload.set_direction)
        set_values["direction_id"] = did
    if payload.set_cluster:
        cid = await get_or_create_cluster(db, project_id, payload.set_cluster)
        set_values["cluster_id"] = cid
    if payload.set_page is not None:
        if payload.set_page == "":
            pass  # не менять страницу (ссылка сохраняется)
        else:
            set_values["page"] = payload.set_page
    if payload.set_page_type is not None:
        set_values["page_type"] = payload.set_page_type
    if payload.set_query_type is not None:
        set_values["query_type"] = payload.set_query_type
    if payload.set_ws_flag is not None:
        try:
            set_values["ws_flag"] = max(0, int(payload.set_ws_flag))
        except Exception:
            set_values["ws_flag"] = 0
    if payload.set_tags is not None:
        set_values["tags"] = payload.set_tags
    if payload.set_dt is not None:
        parsed = _parse_dt(payload.set_dt)
        if parsed == "":
            set_values["dt"] = None  # очистка
        elif isinstance(parsed, date):
            set_values["dt"] = parsed  # установка даты

    updated = 0
    if len(set_values) > 3:
        stmt = update(Query).where(Query.project_id == project_id, Query.id.in_(payload.ids)).values(**set_values)
        res = await db.execute(stmt)
        updated = res.rowcount or 0

    if payload.add_tags:
        await db.execute(
            text(
                """
                UPDATE queries
                SET tags = array_cat(tags, :add),
                    updated_at = now(),
                    updated_by = :author,
                    version = version + 1
                WHERE project_id = :pid AND id = ANY(:ids)
            """
            ),
            {"add": payload.add_tags, "pid": str(project_id), "ids": payload.ids, "author": str(user.id)},
        )
        await db.execute(
            text(
                """
                UPDATE queries q
                SET tags = (
                    SELECT ARRAY(SELECT DISTINCT x FROM unnest(q.tags) AS x)
                ),
                    updated_at = now(),
                    updated_by = :author,
                    version = version + 1
                WHERE project_id = :pid AND id = ANY(:ids)
            """
            ),
            {"pid": str(project_id), "ids": payload.ids, "author": str(user.id)},
        )

    if payload.remove_tags:
        for tag in payload.remove_tags:
            await db.execute(
                text(
                    """
                    UPDATE queries
                    SET tags = array_remove(tags, :tag),
                        updated_at = now(),
                        updated_by = :author,
                        version = version + 1
                    WHERE project_id = :pid AND id = ANY(:ids)
                """
                ),
                {"tag": tag, "pid": str(project_id), "ids": payload.ids, "author": str(user.id)},
            )

    await db.commit()
    return {"updated": updated}


# ===== versions =====
@router.get("/{query_id}/versions", response_model=list[VersionRow])
async def get_versions(
    query_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = await db.execute(
        text(
            """
            SELECT version, created_at, author_id, before, after
            FROM query_versions
            WHERE query_id = :qid
            ORDER BY version DESC, created_at DESC
            LIMIT 200
        """
        ),
        {"qid": str(query_id)},
    )
    out: List[VersionRow] = []
    for r in rows:
        v, created_at, author_id, before, after = r
        out.append(
            VersionRow(
                version=v,
                created_at=str(created_at),
                author_id=uuid.UUID(author_id) if isinstance(author_id, str) else author_id,
                before=before,
                after=after,
            )
        )
    return out


# ===== undo =====
@router.post("/undo")
async def undo(
    payload: UndoRequest,
    project_id: uuid.UUID = Q(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("editor", "admin"))
    if not payload.ids:
        return {"reverted": 0}

    reverted = 0

    for qid in payload.ids:
        # подтягиваем нужный снимок
        if payload.to_version is None:
            row = await db.execute(
                text(
                    """
                    WITH mx AS (
                      SELECT COALESCE(MAX(version), 1) AS v
                      FROM query_versions
                      WHERE query_id = :qid
                    )
                    SELECT qv.version, qv.before
                    FROM query_versions qv, mx
                    WHERE qv.query_id = :qid
                      AND qv.version = mx.v
                    LIMIT 1
                """
                ),
                {"qid": str(qid)},
            )
        else:
            row = await db.execute(
                text(
                    """
                    SELECT version, before
                    FROM query_versions
                    WHERE query_id = :qid AND version = :ver
                    LIMIT 1
                """
                ),
                {"qid": str(qid), "ver": payload.to_version},
            )

        rec = row.first()
        if not rec:
            continue

        before = rec[1]
        if not before:
            continue

        ws_val = before.get("ws_flag")
        ws_int = ws_val if isinstance(ws_val, int) else _ws_to_int(ws_val)

        stmt = (
            update(Query)
            .where(and_(Query.id == qid, Query.project_id == project_id))
            .values(
                direction_id=before.get("direction_id"),
                cluster_id=before.get("cluster_id"),
                page=before.get("page"),
                tags=before.get("tags") or [],
                page_type=before.get("page_type"),
                query_type=before.get("query_type"),
                ws_flag=max(0, ws_int),
                dt=None if (before.get("dt") in (None, "")) else date.fromisoformat(before["dt"]),
                updated_at=func.now(),
                updated_by=user.id,
                version=Query.version + 1,
            )
        )
        res = await db.execute(stmt)
        reverted += res.rowcount or 0

    await db.commit()
    return {"reverted": reverted}


# ===== delete =====
@router.post("/delete")
async def bulk_delete(
    payload: DeleteRequest,
    project_id: uuid.UUID = Q(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("editor", "admin"))
    if not payload.ids:
        return {"deleted": 0}
    stmt = delete(Query).where(Query.project_id == project_id, Query.id.in_(payload.ids))
    res = await db.execute(stmt)
    await db.commit()
    return {"deleted": res.rowcount or 0}


# ===== export =====
@router.get("/export.csv")
async def export_csv(
    project_id: uuid.UUID = Q(...),
    direction: Optional[str] = Q(None),
    cluster: Optional[str] = Q(None),
    search: Optional[str] = Q(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_page_access(db, user, "clusters")
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))
    D, C, Qr = Direction, Cluster, Query
    stmt = (
        select(
            Qr.phrase,
            D.name.label("direction"),
            C.name.label("cluster"),
            Qr.page,
            Qr.tags,
            Qr.page_type,
            Qr.query_type,
            Qr.ws_flag,
            Qr.dt,
        )
        .join(D, D.id == Qr.direction_id, isouter=True)
        .join(C, C.id == Qr.cluster_id, isouter=True)
        .where(Qr.project_id == project_id)
        .order_by(Qr.phrase.asc())
    )
    if direction:
        stmt = stmt.where(D.name == direction)
    if cluster:
        stmt = stmt.where(C.name == cluster)
    if search:
        stmt = stmt.where(Qr.phrase.ilike(_ilike(search)))

    rows = (await db.execute(stmt)).all()

    def _iter():
        import csv, io

        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(["Фраза", "Направление", "Кластер", "Страница", "Теги", "Тип страницы", "Тип запроса", "WS", "Дата"])
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for r in rows:
            tags = ",".join(r.tags or [])
            ws = str(r.ws_flag or 0)
            dval = r.dt.isoformat() if r.dt else ""
            w.writerow([r.phrase, r.direction or "", r.cluster or "", r.page or "", tags, r.page_type or "", r.query_type or "", ws, dval])
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    filename = f"export_{project_id}.csv"
    return StreamingResponse(_iter(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


# ===== import to many projects =====
async def _missing_clusters_for_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    items: list[ImportItem] | list[QueryItem],
    default_cluster: str | None,
) -> set[str]:
    """Вернёт множество отсутствующих в реестре кластеров для проекта."""
    # собрать все нужные имена кластеров из items + default
    needed: set[str] = set()
    for it in items:
        name = (it.cluster or default_cluster or "").strip()
        if name:
            needed.add(name)
    if not needed:
        return set()

    have = set((await db.execute(
        select(ClusterRegistry.name).where(
            ClusterRegistry.project_id == project_id,
            ClusterRegistry.name.in_(list(needed))
        )
    )).scalars().all())
    return needed - have


async def _import_items_for_project(
    db: AsyncSession,
    project_id: uuid.UUID,
    items: list[ImportItem] | list[QueryItem],
    default_direction: str | None,
    default_cluster: str | None,
    default_query_type: str | None,
    user: User,
) -> tuple[int, int, int]:
    """
    Импорт в один проект. Возвращает (created, updated, skipped).
    Upsert по (project_id, phrase) — при конфликтах обновляем поля.
    """
    dir_cache: dict[str, uuid.UUID] = {}
    clu_cache: dict[str, uuid.UUID] = {}

    async def ensure_direction(name: str | None) -> uuid.UUID | None:
        if not name:
            return None
        if name in dir_cache:
            return dir_cache[name]
        row = await db.execute(
            pg_insert(Direction)
            .values(id=uuid.uuid4(), project_id=project_id, name=name)
            .on_conflict_do_nothing(index_elements=[Direction.project_id, Direction.name])
            .returning(Direction.id)
        )
        did = row.scalar_one_or_none()
        if did is None:
            did = (await db.execute(
                select(Direction.id).where(Direction.project_id == project_id, Direction.name == name)
            )).scalar_one()
        dir_cache[name] = did
        return did

    async def ensure_cluster(name: str | None) -> uuid.UUID | None:
        if not name:
            return None
        if name in clu_cache:
            return clu_cache[name]
        row = await db.execute(
            pg_insert(Cluster)
            .values(id=uuid.uuid4(), project_id=project_id, name=name)
            .on_conflict_do_nothing(index_elements=[Cluster.project_id, Cluster.name])
            .returning(Cluster.id)
        )
        cid = row.scalar_one_or_none()
        if cid is None:
            cid = (await db.execute(
                select(Cluster.id).where(Cluster.project_id == project_id, Cluster.name == name)
            )).scalar_one()
        clu_cache[name] = cid
        return cid

    def _norm_phrase(s: str | None) -> str:
        return (s or "").strip()

    def _is_empty(v) -> bool:
        return v is None or (isinstance(v, str) and v.strip() == "")

    skipped = 0

    # ---- сперва нормализуем и сконструируем строки, затем СЛИЯНИЕ ПО ФРАЗЕ ----
    merged: dict[str, dict] = {}  # phrase -> row

    for it in items:
        phrase = _norm_phrase(getattr(it, "phrase", None))
        if not phrase:
            skipped += 1
            continue

        did = await ensure_direction(getattr(it, "direction", None) or default_direction)
        cid = await ensure_cluster(getattr(it, "cluster", None) or default_cluster)

        # дата
        dt_val = None
        if getattr(it, "date", None):
            try:
                dt_val = date.fromisoformat(it.date)
            except Exception:
                dt_val = None

        # ws_flag -> неотрицательное целое
        ws = None
        if hasattr(it, "ws_flag") and getattr(it, "ws_flag") is not None:
            try:
                ws = max(0, int(getattr(it, "ws_flag")))
            except Exception:
                from_str = str(getattr(it, "ws_flag")).strip().lower()
                ws = 1 if from_str in ("1", "true", "t", "yes", "y", "да", "+") else 0

        row = dict(
            id=uuid.uuid4(),
            project_id=project_id,
            direction_id=did,
            cluster_id=cid,
            phrase=phrase,
            page=getattr(it, "page", None),
            tags=(getattr(it, "tags", None) or []),
            page_type=getattr(it, "page_type", None),
            query_type=(getattr(it, "query_type", None) or default_query_type),
            ws_flag=ws if ws is not None else 0,
            dt=dt_val,
            created_by=user.id,
            updated_by=user.id,
        )

        if phrase not in merged:
            merged[phrase] = row
        else:
            prev = merged[phrase]
            # последнее непустое побеждает
            for f in ("direction_id", "cluster_id", "page", "page_type", "query_type", "dt"):
                val = row.get(f)
                if not _is_empty(val):
                    prev[f] = val

            # ws_flag — если пришёл не None, берём его (последний по порядку)
            if row.get("ws_flag") is not None:
                prev["ws_flag"] = row["ws_flag"]

            # tags — объединение уникально с сохранением порядка
            prev_tags = prev.get("tags") or []
            new_tags = row.get("tags") or []
            if not isinstance(prev_tags, list):
                prev_tags = [prev_tags]
            if not isinstance(new_tags, list):
                new_tags = [new_tags]
            seen = set()
            combined = []
            for t in [*prev_tags, *new_tags]:
                if t not in seen:
                    combined.append(t)
                    seen.add(t)
            prev["tags"] = combined

    batch = list(merged.values())
    if not batch:
        return (0, 0, skipped)

    # ------ created/updated считаем по уникальным фразам ------
    phrases = list(merged.keys())
    existing_phrases = set((await db.execute(
        select(Query.phrase).where(Query.project_id == project_id, Query.phrase.in_(phrases))
    )).scalars().all())

    created = sum(1 for p in phrases if p not in existing_phrases)
    updated = sum(1 for p in phrases if p in existing_phrases)

    # ------ чанки для безопасного апсёрта ------
    cols_per_row = 16  # приблизительно
    max_binds = 60000
    CHUNK = max(200, min(1000, (max_binds // cols_per_row) - 10))

    for i in range(0, len(batch), CHUNK):
        part = batch[i:i + CHUNK]
        ins = pg_insert(Query).values(part)
        stmt = ins.on_conflict_do_update(
            index_elements=[Query.project_id, Query.phrase],
            set_={
                "direction_id": ins.excluded.direction_id,
                "cluster_id":   ins.excluded.cluster_id,
                "page":         ins.excluded.page,
                "tags":         ins.excluded.tags,
                "page_type":    ins.excluded.page_type,
                "query_type":   ins.excluded.query_type,
                "ws_flag":      ins.excluded.ws_flag,
                "dt":           ins.excluded.dt,
                "updated_at":   func.now(),
                "updated_by":   user.id,
                "version":      Query.version + 1,  # без лишнего bind
            }
        )
        await db.execute(stmt)

    return (created, updated, skipped)


@router.post("/import-multi")
async def import_multi(
    payload: ImportRequestMulti,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # 1) Доступ ко всем проектам
    for pid in payload.project_ids:
        await _ensure_member(pid, user, db)

    # 2) Проверка реестра кластеров по каждому проекту
    missing_by_project: dict[str, list[str]] = {}
    allowed_project_ids: list[str] = []

    for pid in payload.project_ids:
        missing = await _missing_clusters_for_project(
            db=db,
            project_id=pid,
            items=payload.items,
            default_cluster=payload.default_cluster,
        )
        if missing:
            missing_by_project[str(pid)] = sorted(missing)
        else:
            allowed_project_ids.append(str(pid))

    # 3) Есть куда грузить, но не во все — 207 (Multi-Status)
    if missing_by_project and allowed_project_ids:
        return JSONResponse(
            status_code=207,
            content={
                "allowed_project_ids": allowed_project_ids,
                "missing_by_project": missing_by_project,
                "message": "Не во всех проектах есть кластеры в реестре. Можно импортировать в доступные сейчас, или сначала дополнить реестр.",
            },
        )

    # 4) Грузить некуда — 400 с детальной ошибкой
    if missing_by_project and not allowed_project_ids:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "clusters_missing_by_project",
                "missing_by_project": missing_by_project,
                "message": "Во всех выбранных проектах отсутствуют некоторые кластеры в реестре.",
            },
        )

    # 5) Всё ок — импортируем во все выбранные проекты
    inserted_or_updated = 0
    for pid in payload.project_ids:
        _c, up, _s = await _import_items_for_project(
            db=db,
            project_id=pid,
            items=payload.items,
            default_direction=payload.default_direction,
            default_cluster=payload.default_cluster,
            default_query_type=payload.default_query_type,
            user=user,
        )
        inserted_or_updated += up

    await db.commit()
    return {
        "inserted_or_updated": inserted_or_updated,
        "projects": [str(x) for x in payload.project_ids],
    }



# ===== global delete =====
def _build_global_filters(f: GlobalDeleteFilters):
    conds = []

    # ILIKE по строковым полям
    if f.phrase_contains:
        conds.append(Query.phrase.ilike(f"%{f.phrase_contains.strip()}%"))
    if f.page_contains:
        conds.append((Query.page != None) & Query.page.ilike(f"%{f.page_contains.strip()}%"))

    # Теги (строковый поиск по объединённым тегам)
    if f.tag_contains:
        conds.append(func.array_to_string(Query.tags, ",").ilike(f"%{f.tag_contains.strip()}%"))

    # Диапазон ws_flag
    if f.ws_min is not None:
        conds.append(Query.ws_flag >= int(f.ws_min))
    if f.ws_max is not None:
        conds.append(Query.ws_flag <= int(f.ws_max))

    # Дата
    if f.date_from:
        conds.append(Query.dt >= f.date_from)
    if f.date_to:
        conds.append(Query.dt <= f.date_to)

    dir_name = f.direction_contains.strip() if f.direction_contains else None
    clu_name = f.cluster_contains.strip() if f.cluster_contains else None

    return conds, dir_name, clu_name


async def _limit_projects_visible_to_user(db: AsyncSession, user):
    """Возвращает список project_id, доступных пользователю. Для суперюзера — None (без ограничения)."""
    if getattr(user, "is_superuser", False):
        return None

    rows = await db.execute(select(ProjectMember.project_id).where(ProjectMember.user_id == user.id))
    ids = rows.scalars().all()
    return ids


@router.post("/global-delete/preview", response_model=GlobalDeletePreviewOut)
async def global_delete_preview(
    filters: GlobalDeleteFilters,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    visible = await _limit_projects_visible_to_user(db, user)
    conds, dir_name, clu_name = _build_global_filters(filters)

    q = select(Query.project_id, func.count(Query.id)).select_from(Query).join(Project, Project.id == Query.project_id)

    if dir_name:
        q = q.join(Direction, Direction.id == Query.direction_id, isouter=True).where(Direction.name.ilike(f"%{dir_name}%"))
    if clu_name:
        q = q.join(Cluster, Cluster.id == Query.cluster_id, isouter=True).where(Cluster.name.ilike(f"%{clu_name}%"))

    if visible is not None:
        if not visible:
            return {"total": 0, "per_project": []}  # <-- правильное поле
        q = q.where(Query.project_id.in_(visible))

    if conds:
        q = q.where(and_(*conds))

    if visible is not None and not getattr(user, "is_superuser", False):
        q = q.where(Query.project_id.in_(visible))

    q = q.group_by(Query.project_id)
    rows = (await db.execute(q)).all()

    id_to_name = dict(
        (await db.execute(select(Project.id, Project.name).where(Project.id.in_([r[0] for r in rows] or [uuid.uuid4()])))).all()
    )

    per = [GlobalDeletePreviewRow(project_id=pid, project_name=id_to_name.get(pid, "—"), count=cnt) for pid, cnt in rows]
    total = sum(r.count for r in per)

    return GlobalDeletePreviewOut(total=total, per_project=per)


@router.post("/global-delete/apply")
async def global_delete_apply(
    body: GlobalDeleteApplyIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.confirm.strip().upper() != "DELETE":
        raise HTTPException(400, "Нужно ввести подтверждение: DELETE")

    visible = await _limit_projects_visible_to_user(db, user)

    if not getattr(user, "is_superuser", False):
        allowed_ids = set(
            (
                await db.execute(
                    select(ProjectMember.project_id).where(
                        ProjectMember.user_id == user.id, ProjectMember.role.in_(("editor", "admin"))
                    )
                )
            )
            .scalars()
            .all()
        )
        not_allowed = [pid for pid in body.project_ids if pid not in allowed_ids]
        if not_allowed:
            raise HTTPException(403, f"Нет прав на проекты: {', '.join(str(x) for x in not_allowed)}")

    conds, dir_name, clu_name = _build_global_filters(body.filters)

    q = select(Query.id).select_from(Query)

    if visible is not None:
        if not visible:
            return {"deleted": 0}
        q = q.where(Query.project_id.in_(visible))

    if dir_name:
        q = q.join(Direction, Direction.id == Query.direction_id, isouter=True).where(Direction.name.ilike(f"%{dir_name}%"))
    if clu_name:
        q = q.join(Cluster, Cluster.id == Query.cluster_id, isouter=True).where(Cluster.name.ilike(f"%{clu_name}%"))

    q = q.where(Query.project_id.in_(body.project_ids))
    if conds:
        q = q.where(and_(*conds))

    ids = (await db.execute(q)).scalars().all()
    if not ids:
        return {"deleted": 0}

    CHUNK = 2000
    deleted_cnt = 0
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i : i + CHUNK]
        d = delete(Query).where(Query.id.in_(chunk))
        await db.execute(d)
        deleted_cnt += len(chunk)

    await db.commit()
    return {"deleted": deleted_cnt, "projects": body.project_ids}


# ===== validators =====
async def _validate_clusters_exist(
    db: AsyncSession,
    project_id: uuid.UUID,
    items: list[QueryItem | ImportItem],
    default_cluster: str | None,
) -> None:
    wanted: set[str] = set()
    for it in items:
        nm = (it.cluster or default_cluster or "").strip()
        if nm:
            wanted.add(nm)
    if not wanted:
        return
    rows = (
        await db.execute(
            select(ClusterRegistry.name).where(ClusterRegistry.project_id == project_id, ClusterRegistry.name.in_(list(wanted)))
        )
    ).scalars().all()
    have = set(rows)
    missing = sorted(wanted - have)
    if missing:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "cluster_registry_missing",
                "message": "Некоторые кластеры отсутствуют в реестре. Добавьте их в реестр или удалите из файла импорта.",
                "project_id": str(project_id),
                "missing": missing,
            },
        )
