from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete, exists, update, func
from sqlalchemy.exc import IntegrityError
from uuid import UUID
from typing import List, Set, Optional
from pydantic import BaseModel, Field

from app.db import get_db
from app.models import PageAccess, User
from ..deps import get_current_user
from ..schemas import UpdateUserAccessIn

router = APIRouter(prefix="/access", tags=["Access Control"])

PAGES = ["clusters", "content_plan"]

# Схемы для ролей страниц
class PageRoleIn(BaseModel):
    page: str = Field(..., pattern="^(clusters|content_plan)$")
    role: str = Field(..., pattern="^(viewer|editor|author|admin)$")  # Добавлен admin

class PageRoleOut(BaseModel):
    page: str
    role: str

class UpdateUserPagesWithRoles(BaseModel):
    pages_grant: Optional[List[str]] = []
    pages_revoke: Optional[List[str]] = []
    page_roles: Optional[List[PageRoleIn]] = []

# Временное хранилище ролей (в продакшене лучше использовать отдельную таблицу)
user_page_roles = {}  # user_id -> {page: role}


# ==== утилиты ====

async def ensure_user_exists(db: AsyncSession, user_id: UUID) -> User:
    """Проверяет существование пользователя."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")
    return user


async def require_page_access(db: AsyncSession, user, page: str, required_role: str = "viewer"):
    """Проверяет доступ пользователя к странице с определенной ролью."""
    if getattr(user, "is_superuser", False):
        return

    if page not in PAGES:
        raise HTTPException(400, f"Неизвестная страница: {page}")

    # Проверяем базовый доступ к странице
    has_access = (
        await db.execute(
            select(PageAccess)
            .where(PageAccess.user_id == user.id, PageAccess.page == page)
        )
    ).scalar_one_or_none()

    if not has_access:
        raise HTTPException(403, f"Нет доступа к странице {page}")

    # Получаем роль пользователя
    user_roles = user_page_roles.get(str(user.id), {})
    page_role = user_roles.get(page, "viewer")

    # Проверяем права согласно новой логике
    if page == "content_plan":
        if required_role == "viewer":
            # Все роли могут просматривать
            return
        elif required_role == "editor":
            # Для операций редактирования разрешаем admin, editor, author
            if page_role not in ("admin", "editor", "author"):
                raise HTTPException(403, f"Недостаточно прав для редактирования {page}")
        elif required_role == "admin":
            # Только admin может управлять ролями
            if page_role != "admin":
                raise HTTPException(403, f"Нужны права администратора для {page}")
    else:
        # Для других страниц используем старую логику
        if required_role == "editor" and page_role != "editor":
            raise HTTPException(403, f"Недостаточно прав для редактирования {page}")


async def get_user_pages(db: AsyncSession, user_id: UUID) -> Set[str]:
    """Получает список страниц, к которым у пользователя есть доступ."""
    pages = (
        await db.execute(
            select(PageAccess.page).where(PageAccess.user_id == user_id)
        )
    ).scalars().all()
    return set(pages)


def get_user_page_roles(user_id: UUID) -> dict:
    """Получает роли пользователя для страниц."""
    return user_page_roles.get(str(user_id), {})


def set_user_page_roles(user_id: UUID, page_roles: dict):
    """Устанавливает роли пользователя для страниц."""
    user_page_roles[str(user_id)] = page_roles


def check_role_permissions(page_role: str, action: str, is_owner: bool = False) -> bool:
    """
    Проверяет разрешения роли для конкретного действия.
    
    Args:
        page_role: Роль пользователя (viewer, author, editor, admin)
        action: Действие (view, create, edit, delete, import)
        is_owner: Является ли пользователь владельцем контента
    
    Returns:
        bool: Разрешено ли действие
    """
    permissions = {
        "admin": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "import": True,
        },
        "editor": {
            "view": True,
            "create": True,
            "edit": True,
            "delete": True,
            "import": True,
        },
        "author": {
            "view": True,  # Author может просматривать (с учетом фильтрации в content_plan)
            "create": True,  # Author может создавать записи
            "edit": lambda is_owner: is_owner,  # Author может редактировать только свои
            "delete": False,  # Author НЕ может удалять
            "import": False,  # Author НЕ может импортировать
        },
        "viewer": {
            "view": True,  # Viewer может только просматривать
            "create": False,
            "edit": False,
            "delete": False,
            "import": False,
        }
    }
    
    if page_role not in permissions:
        return False
    
    permission = permissions[page_role].get(action, False)
    
    # Для author некоторые разрешения зависят от владения
    if callable(permission):
        return permission(is_owner)
    
    return permission


# ==== ручки управления доступом ====

@router.get("/pages")
async def list_page_access(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Получить список страниц, к которым у пользователя есть доступ."""
    if user_id != current.id and not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    await ensure_user_exists(db, user_id)

    pages = await get_user_pages(db, user_id)
    page_roles = get_user_page_roles(user_id)

    return {
        "user_id": user_id,
        "pages": list(pages),
        "page_roles": [
            {"page": page, "role": role}
            for page, role in page_roles.items()
        ]
    }


@router.get("/pages/{user_id}/roles", response_model=List[PageRoleOut])
async def get_user_page_roles_endpoint(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Получить роли пользователя для страниц."""
    if user_id != current.id and not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    await ensure_user_exists(db, user_id)

    page_roles = get_user_page_roles(user_id)
    return [
        PageRoleOut(page=page, role=role)
        for page, role in page_roles.items()
    ]


@router.post("/pages")
async def grant_page_access(
    user_id: UUID,
    page: str,
    role: str = "viewer",
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Предоставить доступ пользователю к странице с ролью."""
    if not getattr(current, "is_superuser", False):
        # Проверяем, что текущий пользователь имеет права admin для данной страницы
        user_roles = get_user_page_roles(current.id)
        current_role = user_roles.get(page, "viewer")
        if current_role != "admin":
            raise HTTPException(403, "Нужны права администратора для управления ролями")

    if page not in PAGES:
        raise HTTPException(400, f"Неизвестная страница: {page}")

    if role not in ("viewer", "editor", "author", "admin"):
        raise HTTPException(400, f"Недопустимая роль: {role}")

    await ensure_user_exists(db, user_id)

    try:
        # Проверяем, есть ли уже доступ
        has_access = await db.execute(
            select(exists().where(
                PageAccess.user_id == user_id,
                PageAccess.page == page
            ))
        )

        if not has_access.scalar():
            await db.execute(insert(PageAccess).values(user_id=user_id, page=page))

        # Устанавливаем роль
        user_roles = get_user_page_roles(user_id)
        user_roles[page] = role
        set_user_page_roles(user_id, user_roles)

        await db.commit()
        return {"ok": True, "message": f"Доступ предоставлен с ролью {role}"}

    except IntegrityError:
        await db.rollback()
        # Если доступ уже есть, просто обновляем роль
        user_roles = get_user_page_roles(user_id)
        user_roles[page] = role
        set_user_page_roles(user_id, user_roles)
        return {"ok": True, "message": f"Роль обновлена на {role}"}
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при предоставлении доступа: {str(e)}")


@router.delete("/pages")
async def revoke_page_access(
    user_id: UUID,
    page: str,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Отозвать доступ пользователя к странице."""
    if not getattr(current, "is_superuser", False):
        # Проверяем права admin
        user_roles = get_user_page_roles(current.id)
        current_role = user_roles.get(page, "viewer")
        if current_role != "admin":
            raise HTTPException(403, "Нужны права администратора для управления ролями")

    if page not in PAGES:
        raise HTTPException(400, f"Неизвестная страница: {page}")

    await ensure_user_exists(db, user_id)

    try:
        res = await db.execute(
            delete(PageAccess).where(
                PageAccess.user_id == user_id,
                PageAccess.page == page
            )
        )

        # Удаляем роль
        user_roles = get_user_page_roles(user_id)
        user_roles.pop(page, None)
        set_user_page_roles(user_id, user_roles)

        await db.commit()

        deleted = res.rowcount > 0
        message = "Доступ отозван" if deleted else "Доступ не был предоставлен"

        return {"ok": True, "deleted": deleted, "message": message}

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при отзыве доступа: {str(e)}")


@router.post("/pages/{user_id}/update")
async def update_user_pages(
    user_id: UUID,
    payload: UpdateUserPagesWithRoles,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Массовое обновление доступа пользователя к страницам с ролями."""
    if not getattr(current, "is_superuser", False):
        # Проверяем права admin для всех затрагиваемых страниц
        user_roles = get_user_page_roles(current.id)
        all_pages = set()
        
        if payload.pages_grant:
            all_pages.update(payload.pages_grant)
        if payload.pages_revoke:
            all_pages.update(payload.pages_revoke)
        if payload.page_roles:
            all_pages.update([pr.page for pr in payload.page_roles])
        
        for page in all_pages:
            current_role = user_roles.get(page, "viewer")
            if current_role != "admin":
                raise HTTPException(403, f"Нужны права администратора для управления ролями на странице {page}")

    await ensure_user_exists(db, user_id)

    try:
        current_pages = await get_user_pages(db, user_id)
        granted = 0
        revoked = 0

        # Предоставляем новые страницы
        if payload.pages_grant:
            for page in payload.pages_grant:
                if page not in PAGES:
                    continue

                if page not in current_pages:
                    exists_check = await db.execute(
                        select(exists().where(
                            PageAccess.user_id == user_id,
                            PageAccess.page == page
                        ))
                    )

                    if not exists_check.scalar():
                        await db.execute(
                            insert(PageAccess).values(user_id=user_id, page=page)
                        )
                        granted += 1
                        current_pages.add(page)

        # Отзываем страницы
        if payload.pages_revoke:
            for page in payload.pages_revoke:
                if page in current_pages:
                    res = await db.execute(
                        delete(PageAccess).where(
                            PageAccess.user_id == user_id,
                            PageAccess.page == page
                        )
                    )
                    if res.rowcount > 0:
                        revoked += 1
                        current_pages.discard(page)

        # Обновляем роли для страниц
        if payload.page_roles:
            user_roles = get_user_page_roles(user_id)
            for role_data in payload.page_roles:
                if role_data.page in current_pages:
                    user_roles[role_data.page] = role_data.role
            set_user_page_roles(user_id, user_roles)

        await db.commit()
        return {
            "ok": True,
            "granted": granted,
            "revoked": revoked,
            "current_pages": list(current_pages),
            "page_roles": get_user_page_roles(user_id),
            "message": f"Предоставлено: {granted}, Отозвано: {revoked}"
        }

    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(400, f"Ошибка целостности данных: {str(e)}")
    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при обновлении доступа: {str(e)}")


@router.get("/pages/{user_id}/all", response_model=List[str])
async def list_all_page_access(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Получить полный список страниц пользователя."""
    if user_id != current.id and not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    await ensure_user_exists(db, user_id)

    pages = await get_user_pages(db, user_id)
    return list(pages)


@router.post("/pages/{user_id}/sync")
async def sync_user_pages(
    user_id: UUID,
    pages: List[str],
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Синхронизировать список страниц пользователя (полная замена)."""
    if not getattr(current, "is_superuser", False):
        raise HTTPException(403, "Недостаточно прав")

    await ensure_user_exists(db, user_id)

    # Валидация страниц
    invalid_pages = [p for p in pages if p not in PAGES]
    if invalid_pages:
        raise HTTPException(400, f"Неизвестные страницы: {invalid_pages}")

    try:
        # Удаляем все текущие доступы
        await db.execute(
            delete(PageAccess).where(PageAccess.user_id == user_id)
        )

        # Очищаем роли
        set_user_page_roles(user_id, {})

        # Добавляем новые доступы
        granted = 0
        for page in set(pages):
            await db.execute(
                insert(PageAccess).values(user_id=user_id, page=page)
            )
            granted += 1

        await db.commit()
        return {
            "ok": True,
            "granted": granted,
            "pages": list(set(pages)),
            "message": f"Синхронизировано доступов: {granted}"
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(500, f"Ошибка при синхронизации доступа: {str(e)}")


# Новые эндпоинты для работы с ролями согласно ТЗ

@router.get("/permissions/{page}")
async def get_user_permissions(
    page: str,
    db: AsyncSession = Depends(get_db),
    current=Depends(get_current_user)
):
    """Получить разрешения текущего пользователя для страницы."""
    if page not in PAGES:
        raise HTTPException(400, f"Неизвестная страница: {page}")
    
    user_roles = get_user_page_roles(current.id)
    page_role = user_roles.get(page, "viewer")
    
    return {
        "role": page_role,
        "permissions": {
            "view": check_role_permissions(page_role, "view"),
            "create": check_role_permissions(page_role, "create"), 
            "edit": check_role_permissions(page_role, "edit"),
            "delete": check_role_permissions(page_role, "delete"),
            "import": check_role_permissions(page_role, "import"),
        }
    }


@router.get("/role-info")
async def get_role_info():
    """Получить информацию о ролях и их возможностях."""
    return {
        "roles": {
            "admin": {
                "name": "Администратор", 
                "description": "Полный доступ ко всем функциям + управление ролями",
                "permissions": ["view", "create", "edit", "delete", "import", "manage_roles"]
            },
            "editor": {
                "name": "Редактор",
                "description": "Полный доступ ко всем записям контент-плана", 
                "permissions": ["view", "create", "edit", "delete", "import"]
            },
            "author": {
                "name": "Автор",
                "description": "Может создавать новые записи и редактировать только свои",
                "permissions": ["view", "create", "edit_own"]
            },
            "viewer": {
                "name": "Наблюдатель",
                "description": "Только просмотр всех записей",
                "permissions": ["view"]
            }
        }
    }