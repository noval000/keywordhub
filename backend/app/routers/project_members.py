from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Body
from pydantic import BaseModel, Field, validator
from sqlalchemy import select, insert, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from typing import List, Optional

from app.schemas import UserWithAccessOut, UpdateUserAccessIn
from app.db import get_db
from app.models import Project, User, ProjectMember
from ..deps import get_current_user, get_project_role

router = APIRouter(prefix="/projects", tags=["Projects: Members"])


# ==== схемы ====

class MemberAddPayload(BaseModel):
    user_id: UUID
    role: str = Field(default="viewer", pattern="^(viewer|editor)$")  # ИСПРАВЛЕНО: только viewer и editor

    @validator('role')
    def validate_role(cls, v):
        if v not in ('viewer', 'editor'):  # ИСПРАВЛЕНО: убрали admin
            raise ValueError('Role must be one of: viewer, editor')
        return v


class GrantLikePayload(BaseModel):
    from_user_id: UUID
    to_user_id: UUID

    @validator('to_user_id')
    def validate_different_users(cls, v, values):
        if 'from_user_id' in values and v == values['from_user_id']:
            raise ValueError('from_user_id and to_user_id must be different')
        return v


# ==== утилиты прав ====

async def ensure_project_exists(db: AsyncSession, project_id: UUID) -> Project:
    """Проверяет существование проекта и возвращает его."""
    proj = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return proj


async def ensure_user_exists(db: AsyncSession, user_id: UUID) -> User:
    """Проверяет существование пользователя и возвращает его."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


# ==== ручки ====

@router.get("/{project_id}/members")
async def list_members(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Получить список участников проекта."""
    await ensure_project_exists(db, project_id)

    # ИСПРАВЛЕНО: Любой участник может видеть список, суперпользователь тоже
    if not getattr(current, "is_superuser", False):
        role = await get_project_role(project_id, current, db)
        if role not in ("editor", "viewer"):
            raise HTTPException(403, "Недостаточно прав")

    q = (
        select(
            ProjectMember.user_id,
            ProjectMember.role,
            User.email,
            User.name,
        )
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.email.asc())
    )
    rows = (await db.execute(q)).all()
    return [
        {"user_id": r.user_id, "role": r.role, "email": r.email, "name": r.name}
        for r in rows
    ]


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    project_id: UUID,
    payload: MemberAddPayload,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Добавить или обновить участника проекта."""
    await ensure_project_exists(db, project_id)
    await ensure_user_exists(db, payload.user_id)

    # ИСПРАВЛЕНО: Только суперпользователи могут управлять участниками
    if not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может управлять участниками проектов")

    try:
        # Проверяем существование участника
        exists = (
            await db.execute(
                select(ProjectMember).where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == payload.user_id,
                )
            )
        ).scalar_one_or_none()

        if exists:
            # Обновляем существующую роль
            await db.execute(
                update(ProjectMember)
                .where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == payload.user_id
                )
                .values(role=payload.role)
            )
            await db.commit()
            return {"ok": True, "updated": True, "message": "Роль участника обновлена"}
        else:
            # Создаем нового участника
            await db.execute(
                insert(ProjectMember).values(
                    project_id=project_id,
                    user_id=payload.user_id,
                    role=payload.role,
                )
            )
            await db.commit()
            return {"ok": True, "created": True, "message": "Участник добавлен в проект"}

    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(400, f"Ошибка целостности данных: {str(e)}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Внутренняя ошибка сервера: {str(e)}")


@router.delete("/{project_id}/members/{user_id}")
async def remove_member(
    project_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Удалить участника из проекта."""
    await ensure_project_exists(db, project_id)

    # ИСПРАВЛЕНО: Только суперпользователи могут удалять участников
    if not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может удалять участников")

    # ИСПРАВЛЕНО: Проверяем существование участника перед удалением
    existing_member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not existing_member:
        raise HTTPException(404, "Участник не найден в проекте")

    try:
        res = await db.execute(
            delete(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
        await db.commit()

        return {"ok": True, "deleted": True, "message": "Участник удален из проекта"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при удалении участника: {str(e)}")


# Остальные функции остаются с минимальными изменениями...
@router.get("/{project_id}/members-with-access", response_model=List[UserWithAccessOut])
async def list_members_with_access(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Получить список участников проекта с информацией о доступе к страницам."""
    await ensure_project_exists(db, project_id)

    # ИСПРАВЛЕНО: Только суперпользователи могут видеть доступы
    if not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь может видеть права доступа")

    from app.models import PageAccess

    q = (
        select(
            ProjectMember.user_id,
            ProjectMember.role,
            User.email,
            User.name
        )
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
        .order_by(User.email.asc())
    )
    rows = (await db.execute(q)).all()

    # Собираем доступ к страницам
    result = []
    for r in rows:
        pages = (
            await db.execute(
                select(PageAccess.page).where(PageAccess.user_id == r.user_id)
            )
        ).scalars().all()
        result.append(UserWithAccessOut(
            user_id=r.user_id,
            email=r.email,
            name=r.name,
            role=r.role,
            pages=list(pages),
        ))
    return result


# Остальные функции с соответствующими правами...


@router.patch("/{project_id}/members/{user_id}")
async def update_member_access(
    project_id: UUID,
    user_id: UUID,
    payload: UpdateUserAccessIn,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Обновить роль и доступ участника проекта к страницам."""
    await ensure_project_exists(db, project_id)
    await ensure_user_exists(db, user_id)

    role = await get_project_role(project_id, current, db)
    if role != "admin" and not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    # Проверяем, что участник существует в проекте
    member = (
        await db.execute(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not member:
        raise HTTPException(404, "Участник не найден в проекте")

    try:
        # Обновляем роль, если указана
        if payload.role and payload.role != member.role:
            # Валидация роли
            if payload.role not in ('viewer', 'editor', 'admin'):
                raise HTTPException(400, "Недопустимая роль")

            await db.execute(
                update(ProjectMember)
                .where(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id
                )
                .values(role=payload.role)
            )

        # ИСПРАВЛЕНО: Импортируем функцию и передаем current пользователя
        from ..routers.access import update_user_pages
        await update_user_pages(user_id=user_id, payload=payload, db=db, current=current)

        await db.commit()
        return {"ok": True, "message": "Доступ участника обновлен"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при обновлении доступа: {str(e)}")


@router.post("/admin/grant-like-user")
async def grant_like_user(
    payload: GrantLikePayload,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user),
):
    """Скопировать права доступа от одного пользователя к другому (только для суперпользователя)."""
    if not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Только суперпользователь")

    await ensure_user_exists(db, payload.from_user_id)
    await ensure_user_exists(db, payload.to_user_id)

    try:
        donor_rows = (
            await db.execute(
                select(ProjectMember.project_id, ProjectMember.role)
                .where(ProjectMember.user_id == payload.from_user_id)
            )
        ).all()

        inserted = 0
        for proj_id, role in donor_rows:
            exists = (
                await db.execute(
                    select(ProjectMember).where(
                        ProjectMember.project_id == proj_id,
                        ProjectMember.user_id == payload.to_user_id,
                    )
                )
            ).scalar_one_or_none()

            if not exists:
                await db.execute(
                    insert(ProjectMember).values(
                        project_id=proj_id,
                        user_id=payload.to_user_id,
                        role=role,
                    )
                )
                inserted += 1

        await db.commit()
        return {"ok": True, "granted": inserted, "message": f"Скопировано прав доступа: {inserted}"}

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при копировании прав: {str(e)}")


@router.get("/user-memberships")
async def user_memberships(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Возвращает список проектов пользователя с ролями."""
    # Проверяем права доступа
    if user_id != current.id and not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    await ensure_user_exists(db, user_id)

    rows = (await db.execute(
        select(ProjectMember.project_id, ProjectMember.role, Project.name)
        .join(Project, Project.id == ProjectMember.project_id)
        .where(ProjectMember.user_id == user_id)
        .where(Project.is_archived == False)  # Исключаем архивные проекты
        .order_by(Project.name)
    )).all()

    return [
        {
            "project_id": str(r.project_id),
            "role": r.role,
            "project_name": r.name
        }
        for r in rows
    ]