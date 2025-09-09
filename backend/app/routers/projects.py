import uuid
import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..models import Project, ProjectMember, User
from ..schemas import ProjectCreate, ProjectOut, MemberAdd, ProjectUpdate
from ..deps import get_current_user, require_project_role

router = APIRouter(prefix="/projects", tags=["projects"])


# -----------------------
# CREATE PROJECT
# -----------------------
@router.post("", response_model=ProjectOut)
async def create_project(
    payload: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(400, "Название проекта не может быть пустым")

    project = Project(
        name=name,
        region=(payload.region or "").strip() or None,
        domain=(payload.domain or "").strip() or None,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(project)
    await db.flush()

    # ИСПРАВЛЕНО: Создателю проекта даём роль editor (не admin)
    db.add(ProjectMember(user_id=user.id, project_id=project.id, role="editor"))

    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


# -----------------------
# LIST PROJECTS
# -----------------------
@router.get("", response_model=List[ProjectOut])
async def list_projects(
    archived: Optional[bool] = Query(None, description="true=архивные, false=активные, null=все"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = select(Project)
    # Для обычных пользователей показываем только проекты, где есть членство
    if not getattr(user, "is_superuser", False):
        q = q.join(ProjectMember, ProjectMember.project_id == Project.id)\
             .where(ProjectMember.user_id == user.id)
    if archived is not None:
        q = q.where(Project.is_archived == archived)
    q = q.order_by(Project.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    return rows


# -----------------------
# UPDATE PROJECT
# -----------------------
@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ИСПРАВЛЕНО: Только суперпользователи или editors могут редактировать проект
    if not getattr(user, "is_superuser", False):
        await require_project_role(project_id, user, db, roles=("editor",))

    fields: dict = {}
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(400, "Название проекта не может быть пустым")
        fields["name"] = name

    if payload.region is not None:
        fields["region"] = payload.region.strip() or None

    if payload.domain is not None:
        fields["domain"] = payload.domain.strip() or None

    if payload.is_archived is not None:
        fields["is_archived"] = bool(payload.is_archived)
        fields["archived_at"] = func.now() if payload.is_archived else None

    if not fields:
        raise HTTPException(400, "Нет полей для обновления")

    stmt = (
        update(Project)
        .where(Project.id == project_id)
        .values(**fields, updated_at=func.now(), updated_by=user.id)
        .returning(Project)
    )
    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Проект не найден")

    await db.commit()
    return ProjectOut.model_validate(row)


# -----------------------
# DELETE PROJECT
# -----------------------
@router.delete("/{project_id}")
async def delete_project(
    project_id: uuid.UUID,
    hard: bool = Query(False, description="Жёсткое удаление с каскадом (опасно)"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ИСПРАВЛЕНО: Только суперпользователи могут удалять проекты
    if not getattr(user, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может удалять проекты")

    if not hard:
        # Мягкое удаление (архив)
        stmt = (
            update(Project)
            .where(Project.id == project_id)
            .values(is_archived=True, archived_at=func.now(), updated_at=func.now(), updated_by=user.id)
        )
        await db.execute(stmt)
        await db.commit()
        return {"status": "archived"}

    # HARD DELETE
    await db.execute(delete(Project).where(Project.id == project_id))
    await db.commit()
    return {"status": "deleted"}


# -----------------------
# ADD / UPSERT MEMBER
# -----------------------
@router.post("/{project_id}/members")
async def add_member(
    project_id: uuid.UUID,
    payload: MemberAdd,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ИСПРАВЛЕНО: Только суперпользователи могут управлять участниками проектов
    if not getattr(user, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может управлять участниками проектов")

    # ИСПРАВЛЕНО: Валидация только editor и viewer
    if payload.role not in ("viewer", "editor"):
        raise HTTPException(400, "Role must be viewer or editor")

    # Проверка существования пользователя
    u = (await db.execute(select(User).where(User.id == payload.user_id))).scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")

    # Upsert роли участника
    pm = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.user_id == payload.user_id,
                ProjectMember.project_id == project_id,
            )
        )
    ).scalar_one_or_none()

    if pm:
        pm.role = payload.role
    else:
        db.add(ProjectMember(user_id=payload.user_id, project_id=project_id, role=payload.role))

    await db.commit()
    return {"ok": True}


# -----------------------
# ARCHIVE / RESTORE PROJECT
# -----------------------
@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ИСПРАВЛЕНО: Только суперпользователи могут архивировать
    if not getattr(user, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может архивировать проекты")

    q = select(Project).where(Project.id == project_id)
    project = (await db.execute(q)).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project.is_archived = True
    project.archived_at = datetime.datetime.now(tz=ZoneInfo("UTC"))
    project.updated_by = user.id
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)


@router.post("/{project_id}/restore", response_model=ProjectOut)
async def restore_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ИСПРАВЛЕНО: Только суперпользователи могут восстанавливать
    if not getattr(user, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может восстанавливать проекты")

    q = select(Project).where(Project.id == project_id)
    project = (await db.execute(q)).scalar_one_or_none()
    if not project:
        raise HTTPException(404, "Project not found")

    project.is_archived = False
    project.archived_at = None
    project.updated_by = user.id
    await db.commit()
    await db.refresh(project)
    return ProjectOut.model_validate(project)
