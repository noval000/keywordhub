import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Direction, Cluster, User
from ..schemas import DirectionCreate, ClusterCreate
from ..deps import get_current_user, require_project_role

router = APIRouter(prefix="/dicts", tags=["dictionaries"])

@router.get("/projects/{project_id}/directions")
async def list_directions(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))
    rows = (await db.execute(
        select(Direction.name).where(Direction.project_id==project_id).order_by(Direction.name.asc())
    )).scalars().all()
    return rows

@router.get("/projects/{project_id}/clusters")
async def list_clusters(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))
    rows = (await db.execute(
        select(Cluster.name).where(Cluster.project_id==project_id).order_by(Cluster.name.asc())
    )).scalars().all()
    return rows

@router.post("/projects/{project_id}/directions")
async def add_direction(
    project_id: uuid.UUID,
    payload: DirectionCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    await require_project_role(project_id, user, db, roles=("editor","admin"))
    q = await db.execute(select(Direction).where(Direction.project_id==project_id, Direction.name==payload.name))
    d = q.scalar_one_or_none()
    if not d:
        d = Direction(project_id=project_id, name=payload.name)
        db.add(d)
        await db.commit()
        await db.refresh(d)
    return {"id": str(d.id), "name": d.name}

@router.post("/projects/{project_id}/clusters")
async def add_cluster(
    project_id: uuid.UUID,
    payload: ClusterCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    await require_project_role(project_id, user, db, roles=("editor","admin"))
    q = await db.execute(select(Cluster).where(Cluster.project_id==project_id, Cluster.name==payload.name))
    c = q.scalar_one_or_none()
    if not c:
        c = Cluster(project_id=project_id, name=payload.name)
        db.add(c)
        await db.commit()
        await db.refresh(c)
    return {"id": str(c.id), "name": c.name}
