from typing import Optional
import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user, get_db
from ..models import TechnicalSpecification, ContentPlanItem, User
from .. import schemas as S

router = APIRouter(prefix="/tz", tags=["technical-specifications"])

@router.post("", response_model=S.TechnicalSpecificationResponse)
async def create_tz(
    data: S.TechnicalSpecificationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Проверяем, что запись контент-плана существует
    cp_item = await db.execute(
        select(ContentPlanItem).where(ContentPlanItem.id == data.content_plan_id)
    )
    cp_item = cp_item.scalar_one_or_none()
    if not cp_item:
        raise HTTPException(404, "Content plan item not found")

    # Проверяем, что ТЗ еще не существует
    existing = await db.execute(
        select(TechnicalSpecification).where(
            TechnicalSpecification.content_plan_id == data.content_plan_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(400, "TZ already exists for this content plan item")

    # Создаем ТЗ
    tz = TechnicalSpecification(
        id=uuid.uuid4(),
        content_plan_id=data.content_plan_id,
        title=data.title,
        author=data.author,
        keywords=data.keywords or [],
        lsi_phrases=data.lsi_phrases or [],
        competitors=data.competitors or [],
        count=data.count,
        usage_form=data.usage_form,
        blocks=[block.model_dump() for block in data.blocks],  # JSON поле
        created_by=user.id,
        updated_by=user.id,
    )

    db.add(tz)
    await db.commit()
    await db.refresh(tz)

    return tz

@router.get("/content-plan/{content_plan_id}", response_model=S.TechnicalSpecificationResponse)
async def get_tz_by_content_plan(
    content_plan_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tz = await db.execute(
        select(TechnicalSpecification).where(
            TechnicalSpecification.content_plan_id == content_plan_id
        )
    )
    tz = tz.scalar_one_or_none()
    if not tz:
        raise HTTPException(404, "TZ not found")

    return tz

@router.get("/{tz_id}", response_model=S.TechnicalSpecificationResponse)
async def get_tz(
    tz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tz = await db.execute(
        select(TechnicalSpecification).where(TechnicalSpecification.id == tz_id)
    )
    tz = tz.scalar_one_or_none()
    if not tz:
        raise HTTPException(404, "TZ not found")

    return tz

@router.put("/{tz_id}", response_model=S.TechnicalSpecificationResponse)
async def update_tz(
    tz_id: UUID,
    data: S.TechnicalSpecificationUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tz = await db.execute(
        select(TechnicalSpecification).where(TechnicalSpecification.id == tz_id)
    )
    tz = tz.scalar_one_or_none()
    if not tz:
        raise HTTPException(404, "TZ not found")

    # Обновляем поля
    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        if field == "blocks" and value is not None:
            # Конвертируем блоки в JSON
            setattr(tz, field, [
                block.model_dump() if hasattr(block, 'model_dump') else block
                for block in value
            ])
        elif value is not None:
            setattr(tz, field, value)

    tz.updated_by = user.id

    await db.commit()
    await db.refresh(tz)

    return tz

@router.delete("/{tz_id}")
async def delete_tz(
    tz_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    tz = await db.execute(
        select(TechnicalSpecification).where(TechnicalSpecification.id == tz_id)
    )
    tz = tz.scalar_one_or_none()
    if not tz:
        raise HTTPException(404, "TZ not found")

    await db.delete(tz)
    await db.commit()

    return {"message": "TZ deleted successfully"}

@router.get("", response_model=S.TechnicalSpecificationList)
async def list_tz(
    page: int = 1,
    size: int = 50,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Подсчитываем общее количество
    count_result = await db.execute(
        select(TechnicalSpecification).count()
    )
    total = count_result.scalar()

    # Получаем записи с пагинацией
    offset = (page - 1) * size
    result = await db.execute(
        select(TechnicalSpecification)
        .offset(offset)
        .limit(size)
        .order_by(TechnicalSpecification.created_at.desc())
    )
    items = result.scalars().all()

    return S.TechnicalSpecificationList(
        items=items,
        total=total,
        page=page,
        size=size,
        pages=(total + size - 1) // size
    )