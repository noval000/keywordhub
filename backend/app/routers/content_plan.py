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
        "reviewing_doctor",
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
    if "doctor_approved" in payload:
            obj.doctor_approved = payload.get("doctor_approved")


async def check_content_plan_edit_access(db: AsyncSession, user: User, item: ContentPlanItem):
    """Проверяет права на редактирование записи контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 EDIT ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  User email: {user.email}")
    logger.info(f"  is_superuser: {user.is_superuser}")
    logger.info(f"  Item ID: {item.id}")
    logger.info(f"  Item author: {item.author}")
    logger.info(f"  Item created_by: {item.created_by}")

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser access granted")
        return True

    # Проверяем базовый доступ к странице
    await require_page_access(db, user, "content_plan", "viewer")

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"  Page role: {page_role}")

    # Admin и Editor могут редактировать все
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Admin/Editor access granted")
        return True

    # Author может редактировать только свои тексты
    if page_role == "author":
        user_id_str = str(user.id)
        is_owner = (item.author == user_id_str or item.created_by == user.id)

        logger.info(f"🔍 Author ownership check: user_id_str={user_id_str}, is_owner={is_owner}")

        if is_owner:
            logger.info(f"✅ Author owner access granted")
            return True
        else:
            logger.error(f"❌ Author access denied: not owner")
            raise HTTPException(403, "Author может редактировать только свои записи")

    # Viewer не может редактировать
    logger.error(f"❌ Access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на редактирование")


async def check_content_plan_create_access(db: AsyncSession, user: User):
    """Проверяет права на создание записей контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser create access granted for user {user.id}")
        return True

    # Проверяем базовый доступ к странице
    await require_page_access(db, user, "content_plan", "viewer")

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 CREATE ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Admin, Editor и Author могут создавать записи
    if page_role in ("admin", "editor", "author"):
        logger.info(f"✅ Create access granted for role: {page_role}")
        return True

    # Viewer не может создавать
    logger.info(f"❌ Create access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на создание записей контент-плана")


async def check_content_plan_delete_access(db: AsyncSession, user: User, item: ContentPlanItem):
    """Проверяет права на удаление записи контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser delete access granted")
        return True

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 DELETE ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Только Admin и Editor могут удалять
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Delete access granted for role: {page_role}")
        return True

    # Author и Viewer не могут удалять
    logger.info(f"❌ Delete access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на удаление записей")


async def check_content_plan_import_access(db: AsyncSession, user: User):
    """Проверяет права на импорт записей контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser import access granted")
        return True

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 IMPORT ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Только Admin и Editor могут импортировать
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Import access granted for role: {page_role}")
        return True

    # Author и Viewer не могут импортировать
    logger.info(f"❌ Import access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на импорт записей")


async def check_content_plan_edit_access(db: AsyncSession, user: User, item: ContentPlanItem):
    """Проверяет права на редактирование записи контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    logger.info(f"🔍 EDIT ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  User email: {user.email}")
    logger.info(f"  is_superuser: {user.is_superuser}")
    logger.info(f"  Item ID: {item.id}")
    logger.info(f"  Item author: {item.author}")
    logger.info(f"  Item created_by: {item.created_by}")

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser access granted")
        return True

    # Проверяем базовый доступ к странице
    await require_page_access(db, user, "content_plan", "viewer")

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"  Page role: {page_role}")

    # Admin и Editor могут редактировать все
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Admin/Editor access granted")
        return True

    # Author может редактировать только свои тексты
    if page_role == "author":
        user_id_str = str(user.id)
        is_owner = (item.author == user_id_str or item.created_by == user.id)

        logger.info(f"🔍 Author ownership check: user_id_str={user_id_str}, is_owner={is_owner}")

        if is_owner:
            logger.info(f"✅ Author owner access granted")
            return True
        else:
            logger.error(f"❌ Author access denied: not owner")
            raise HTTPException(403, "Author может редактировать только свои записи")

    # Viewer не может редактировать
    logger.error(f"❌ Access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на редактирование")


async def check_content_plan_create_access(db: AsyncSession, user: User):
    """Проверяет права на создание записей контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser create access granted for user {user.id}")
        return True

    # Проверяем базовый доступ к странице
    await require_page_access(db, user, "content_plan", "viewer")

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 CREATE ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Admin, Editor и Author могут создавать записи
    if page_role in ("admin", "editor", "author"):
        logger.info(f"✅ Create access granted for role: {page_role}")
        return True

    # Viewer не может создавать
    logger.info(f"❌ Create access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на создание записей контент-плана")


async def check_content_plan_delete_access(db: AsyncSession, user: User, item: ContentPlanItem):
    """Проверяет права на удаление записи контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser delete access granted")
        return True

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 DELETE ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Только Admin и Editor могут удалять
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Delete access granted for role: {page_role}")
        return True

    # Author и Viewer не могут удалять
    logger.info(f"❌ Delete access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на удаление записей")


async def check_content_plan_import_access(db: AsyncSession, user: User):
    """Проверяет права на импорт записей контент-плана"""
    import logging
    logger = logging.getLogger(__name__)

    # Суперпользователь может все
    if user.is_superuser:
        logger.info(f"✅ Superuser import access granted")
        return True

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    logger.info(f"🔍 IMPORT ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  Page role: {page_role}")

    # Только Admin и Editor могут импортировать
    if page_role in ("admin", "editor"):
        logger.info(f"✅ Import access granted for role: {page_role}")
        return True

    # Author и Viewer не могут импортировать
    logger.info(f"❌ Import access denied for role: {page_role}")
    raise HTTPException(403, "Нет прав на импорт записей")


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
    reviewing_doctor: Optional[str] = Q(default=None),
    limit: int = Q(default=50, ge=1, le=500),
    offset: int = Q(default=0, ge=0),
):
    import logging
    logger = logging.getLogger(__name__)

    await require_page_access(db, user, "content_plan", "viewer")
    if project_id:
        await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))

    stmt = select(ContentPlanItem).order_by(ContentPlanItem.created_at.desc())

    if project_id:
        stmt = stmt.where(ContentPlanItem.project_id == project_id)

    logger.info(f"🔍 LIST ACCESS CHECK:")
    logger.info(f"  User ID: {user.id}")
    logger.info(f"  is_superuser: {user.is_superuser}")

    # ИСПРАВЛЕННАЯ ЛОГИКА ФИЛЬТРАЦИИ
    if not user.is_superuser:
        from .access import get_user_page_roles
        user_roles = get_user_page_roles(user.id)
        page_role = user_roles.get("content_plan", "viewer")

        logger.info(f"  Page role: {page_role}")

        # Только для роли author применяем фильтрацию
        if page_role == "author":
            can_view_all = getattr(user, 'can_view_all_content', False)
            logger.info(f"  Author can_view_all_content: {can_view_all}")

            if not can_view_all:
                user_id_str = str(user.id)
                logger.info(f"  Filtering by author: {user_id_str}")

                stmt = stmt.where(
                    or_(
                        ContentPlanItem.author == user_id_str,
                        ContentPlanItem.created_by == user.id
                    )
                )
            else:
                logger.info(f"  Author can view all content - no filter applied")
        else:
            # Admin, Editor, Viewer - видят все записи без фильтрации
            logger.info(f"  Role {page_role} - no filter applied")

    # Остальные фильтры остаются без изменений
    if status:
        stmt = stmt.where(ContentPlanItem.status == status)
    if period:
        stmt = stmt.where(ContentPlanItem.period == period)
    if author:
        stmt = stmt.where(ContentPlanItem.author == author)
    if reviewing_doctor:
        stmt = stmt.where(ContentPlanItem.reviewing_doctor.ilike(f"%{reviewing_doctor}%"))
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

    logger.info(f"  Found {len(rows)} records after filtering")

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
    reviewing_doctor: Optional[str] = Q(default=None),
):
    await require_page_access(db, user, "content_plan", "viewer")
    if project_id:
        await require_project_role(project_id, user, db, roles=("viewer", "editor", "admin"))

    stmt = select(func.count(ContentPlanItem.id))

    if project_id:
        stmt = stmt.where(ContentPlanItem.project_id == project_id)

    # ИСПРАВЛЕННАЯ логика фильтрации
    if not user.is_superuser:
        from .access import get_user_page_roles
        user_roles = get_user_page_roles(user.id)
        page_role = user_roles.get("content_plan", "viewer")

        # Только для роли author применяем фильтрацию
        if page_role == "author":
            can_view_all = getattr(user, 'can_view_all_content', False)

            if not can_view_all:
                user_id_str = str(user.id)
                stmt = stmt.where(
                    or_(
                        ContentPlanItem.author == user_id_str,
                        ContentPlanItem.created_by == user.id
                    )
                )
        # Admin, Editor, Viewer - видят все записи без фильтрации

    # Остальные фильтры...
    if status:
        stmt = stmt.where(ContentPlanItem.status == status)
    if period:
        stmt = stmt.where(ContentPlanItem.period == period)
    if author:
        stmt = stmt.where(ContentPlanItem.author == author)
    if reviewing_doctor:
        stmt = stmt.where(ContentPlanItem.reviewing_doctor.ilike(f"%{reviewing_doctor}%"))
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
    return S.ContentPlanCountOut(total=total)  # ИСПРАВЛЕНО: используем правильную схему


# -----------------------
# CREATE
# -----------------------
@router.post("", response_model=List[S.ContentPlanItemOut])
async def create_content_plan_item(
    data: S.ContentPlanCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not data.project_ids:
        raise HTTPException(422, "project_ids is required")

    # Проверка прав на создание
    await check_content_plan_create_access(db, user)

    created_rows: List[ContentPlanItem] = []
    for pid in data.project_ids:
        await require_project_role(pid, user, db, roles=("viewer", "editor", "admin"))

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

        # При создании записи автор всегда = текущий пользователь
        row.author = str(user.id)

        if "doctor_review" in payload:
            row.doctor_review = payload.get("doctor_review")

        db.add(row)
        created_rows.append(row)

    await db.commit()
    for r in created_rows:
        await db.refresh(r)
    return created_rows


# -----------------------
# UPDATE
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

    # Проверка прав на редактирование
    await check_content_plan_edit_access(db, user, row)
    await require_project_role(row.project_id, user, db, roles=("viewer", "editor", "admin"))

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
# DELETE
# -----------------------
@router.delete("")
async def delete_content_plan_items(
    ids: List[uuid.UUID] = Body(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not ids:
        return {"deleted": 0}

    # Получаем все записи для проверки прав
    rows = (await db.execute(
        select(ContentPlanItem).where(ContentPlanItem.id.in_(ids))
    )).scalars().all()

    # Проверяем права на каждую запись
    for row in rows:
        # Проверка прав на удаление (только Admin и Editor)
        await check_content_plan_delete_access(db, user, row)
        await require_project_role(row.project_id, user, db, roles=("viewer", "editor", "admin"))

    await db.execute(delete(ContentPlanItem).where(ContentPlanItem.id.in_(ids)))
    await db.commit()
    return {"deleted": len(ids)}


# -----------------------
# IMPORT
# -----------------------
@router.post("/import", response_model=dict)
async def import_content_plan(
    data: S.ContentPlanImportRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Проверка прав на импорт (только Admin и Editor)
    await check_content_plan_import_access(db, user)

    created = 0
    for it in data.items:
        await require_page_access(db, user, "content_plan", "viewer")
        await require_project_role(it.project_id, user, db, roles=("viewer", "editor", "admin"))

        row = ContentPlanItem(
            id=uuid.uuid4(),
            project_id=it.project_id,
            version=1,
            created_by=user.id,
            updated_by=user.id,
        )
        payload = it.model_dump(exclude_unset=True)
        _apply_str_fields(row, payload)

        # При импорте автор может быть задан в данных или текущий пользователь
        author_name = payload.get("author")
        if author_name:
            row.author = author_name
        else:
            row.author = str(user.id)

        if "doctor_review" in payload:
            row.doctor_review = payload.get("doctor_review")

        db.add(row)
        created += 1

    await db.commit()
    return {"created": created, "duplicates": 0}


# временный эндпоинт для отладки

@router.get("/debug/{item_id}")
async def debug_edit_access(
    item_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Отладка прав редактирования для конкретной записи"""

    row = (await db.execute(
        select(ContentPlanItem).where(ContentPlanItem.id == item_id)
    )).scalar_one_or_none()

    if not row:
        return {"error": "Item not found"}

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    user_id_str = str(user.id)

    return {
        "item_id": str(item_id),
        "user": {
            "id": str(user.id),
            "is_superuser": user.is_superuser,
            "can_view_all_content": getattr(user, 'can_view_all_content', False),
            "page_role": page_role,
            "all_roles": user_roles
        },
        "item": {
            "author": row.author,
            "created_by": str(row.created_by) if row.created_by else None,
            "updated_by": str(row.updated_by) if row.updated_by else None
        },
        "ownership_check": {
            "user_id_str": user_id_str,
            "author_match": row.author == user_id_str,
            "created_by_match": row.created_by == user.id,
            "can_edit": (row.author == user_id_str or row.created_by == user.id)
        },
        "permissions": {
            "can_create": page_role in ("admin", "editor", "author"),
            "can_edit": page_role in ("admin", "editor") or (page_role == "author" and (row.author == user_id_str or row.created_by == user.id)),
            "can_delete": page_role in ("admin", "editor"),
            "can_import": page_role in ("admin", "editor")
        }
    }

@router.get("/debug")
async def debug_content_plan(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Получаем несколько записей для анализа
    stmt = select(ContentPlanItem).limit(10)
    rows = (await db.execute(stmt)).scalars().all()

    result = []
    for row in rows:
        result.append({
            "id": str(row.id),
            "author": row.author,
            "created_by": str(row.created_by) if row.created_by else None,
            "updated_by": str(row.updated_by) if row.updated_by else None,
        })

    # Получаем роль пользователя
    from .access import get_user_page_roles
    user_roles = get_user_page_roles(user.id)
    page_role = user_roles.get("content_plan", "viewer")

    return {
        "current_user": {
            "id": str(user.id),
            "name": user.name,
            "email": user.email,
            "can_view_all_content": getattr(user, 'can_view_all_content', False),
            "page_role": page_role,
            "all_roles": user_roles
        },
        "sample_records": result,
        "role_permissions": {
            "admin": "может все",
            "editor": "может все",
            "author": "редактирование только своих текстов, создание разрешено, удаление и импорт запрещены",
            "viewer": "только просмотр"
        }
    }