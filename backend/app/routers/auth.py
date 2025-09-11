import uuid
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Form, Body
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from ..deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import UserCreate, TokenOut
from ..security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenOut)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # если первый пользователь в системе — делаем его суперюзером для удобного бутстрапа
    cnt = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    exists = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    u = User(
        id=uuid.uuid4(),
        email=payload.email.strip().lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_superuser=(cnt == 0),
        can_view_all_content=False,
    )
    db.add(u)
    await db.commit()

    # Если это первый пользователь (суперпользователь), даем ему admin роль на всех страницах
    if cnt == 0:
        from .access import set_user_page_roles, PAGES
        admin_roles = {page: "admin" for page in PAGES}
        set_user_page_roles(u.id, admin_roles)

        # Также добавляем доступ к страницам
        from app.models import PageAccess
        for page in PAGES:
            page_access = PageAccess(user_id=u.id, page=page)
            db.add(page_access)
        await db.commit()

    token = create_access_token(u.id)
    return TokenOut(access_token=token)

@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == form.username.strip().lower()))).scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    token = create_access_token(user.id)
    return TokenOut(access_token=token)

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), current=Depends(get_current_user)):
    # Суперпользователи могут видеть всех, остальные проверяем роли
    if not getattr(current, "is_superuser", False):
        # Проверяем, есть ли у пользователя admin роль хотя бы на одной странице
        from .access import get_user_page_roles
        user_roles = get_user_page_roles(current.id)
        has_admin_role = any(role == "admin" for role in user_roles.values())

        if not has_admin_role:
            raise HTTPException(403, "Недостаточно прав для просмотра списка пользователей")

    # Получаем всех пользователей с их ролями
    q = select(User.id, User.email, User.name, User.is_active, User.is_superuser, User.can_view_all_content)
    rows = (await db.execute(q)).all()

    from .access import get_user_page_roles
    result = []
    for r in rows:
        user_roles = get_user_page_roles(r.id)
        result.append({
            "id": str(r.id),
            "email": r.email,
            "name": r.name,
            "is_active": r.is_active,
            "is_superuser": r.is_superuser,
            "can_view_all_content": r.can_view_all_content,
            "page_roles": user_roles,  # Добавляем роли пользователя
        })

    return result

class UserContentAccessUpdate(BaseModel):
    can_view_all_content: bool

@router.get("/users/authors")
async def list_authors(db: AsyncSession = Depends(get_db), current=Depends(get_current_user)):
    # Для всех авторизованных пользователей (только активные)
    q = select(User.id, User.email, User.name).where(User.is_active == True)
    rows = (await db.execute(q)).all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "name": r.name,
            "full_name": r.name,  # Добавляем для совместимости с UserSelect компонентом
            "is_active": True,
        }
        for r in rows
    ]

@router.patch("/users/{user_id}/content-access")
async def update_user_content_access(
    user_id: UUID,
    payload: UserContentAccessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить настройку доступа пользователя к контенту"""

    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔄 Updating content access for user {user_id}")
    logger.info(f"  Payload: {payload}")  # ДОБАВЛЕНО: для отладки
    logger.info(f"  New can_view_all_content: {payload.can_view_all_content}")
    logger.info(f"  Requested by: {current_user.id}")

    # Проверяем права: суперпользователь или admin роль на content_plan
    if not current_user.is_superuser:
        from .access import get_user_page_roles
        user_roles = get_user_page_roles(current_user.id)
        content_plan_role = user_roles.get("content_plan", "viewer")

        if content_plan_role != "admin":
            raise HTTPException(403, "Нужны права администратора для изменения настроек доступа")

    # Получаем пользователя
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(404, "Пользователь не найден")

    logger.info(f"  Current can_view_all_content: {getattr(user, 'can_view_all_content', 'NOT_SET')}")

    # Обновляем поле
    user.can_view_all_content = payload.can_view_all_content

    try:
        await db.commit()
        await db.refresh(user)
        logger.info(f"  Successfully updated can_view_all_content: {user.can_view_all_content}")
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating user content access: {e}")
        raise HTTPException(500, f"Ошибка обновления настроек доступа: {str(e)}")

    return {
        "success": True,
        "can_view_all_content": user.can_view_all_content,
        "user_id": str(user_id)
    }

@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Получить информацию о текущем пользователе включая роли"""
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(current_user.id)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "name": current_user.name,
        "is_active": current_user.is_active,
        "is_superuser": current_user.is_superuser,
        "can_view_all_content": getattr(current_user, 'can_view_all_content', False),
        "page_roles": user_roles,
    }

@router.get("/users/{user_id}/permissions")
async def get_user_permissions(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить детальную информацию о правах пользователя"""

    # Проверяем права доступа
    if not current_user.is_superuser and current_user.id != user_id:
        from .access import get_user_page_roles
        user_roles = get_user_page_roles(current_user.id)
        has_admin_role = any(role == "admin" for role in user_roles.values())

        if not has_admin_role:
            raise HTTPException(403, "Недостаточно прав")

    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(404, "Пользователь не найден")

    from .access import get_user_page_roles, check_role_permissions, PAGES
    user_roles = get_user_page_roles(user_id)

    permissions = {}
    for page in PAGES:
        page_role = user_roles.get(page, "viewer")
        permissions[page] = {
            "role": page_role,
            "can_view": check_role_permissions(page_role, "view"),
            "can_create": check_role_permissions(page_role, "create"),
            "can_edit": check_role_permissions(page_role, "edit"),
            "can_delete": check_role_permissions(page_role, "delete"),
            "can_import": check_role_permissions(page_role, "import"),
        }

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "is_superuser": user.is_superuser,
            "can_view_all_content": getattr(user, 'can_view_all_content', False),
        },
        "permissions": permissions
    }
