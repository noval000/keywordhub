# backend/routers/analytics.py
from fastapi import APIRouter, Depends, Query as QueryParam, HTTPException
from sqlalchemy import func, case, select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
import logging

from ..db import get_db
from ..models import ContentPlanItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/report")
async def get_analytics_report(
    project_id: Optional[str] = QueryParam(None),
    db: AsyncSession = Depends(get_db)
):
    """
    Получить аналитический отчет по периодам из контент-плана

    Упрощенная логика на основе существующих полей:
    - ТЗ: есть ссылка на тз (поле tz)
    - Написано: есть ссылка на текст (поле review)
    - Готово: активен чекбокс "проверено врачом" (doctor_approved = true)
    - Прод: есть ссылка в link, статус "размещено" и есть publish_date
    """
    try:
        project_filter = ""
        if project_id:
            project_filter = f"WHERE project_id = '{project_id}'"

        # Основной запрос с упрощенной логикой
        sql_query = f"""
        WITH unique_items AS (
            SELECT DISTINCT ON (topic, period, direction, section)
                *
            FROM content_plan_items
            {project_filter}
        )
        SELECT
            period,
            COUNT(*) as total_themes,
            -- ТЗ: есть ссылка на тз
            SUM(CASE WHEN tz IS NOT NULL AND TRIM(tz) != '' THEN 1 ELSE 0 END) as tz_count,
            -- Написано: есть ссылка на текст (поле review)
            SUM(CASE WHEN review IS NOT NULL AND TRIM(review) != '' THEN 1 ELSE 0 END) as written_count,
            -- Готово: активен чекбокс "проверено врачом"
            SUM(CASE WHEN doctor_approved = TRUE THEN 1 ELSE 0 END) as ready_count,
            -- Прод: есть ссылка в link, статус "размещено" и есть publish_date
            SUM(CASE WHEN link IS NOT NULL AND TRIM(link) != ''
                     AND LOWER(status) = 'размещено' AND publish_date IS NOT NULL THEN 1 ELSE 0 END) as prod_count
        FROM unique_items
        GROUP BY period
        ORDER BY period
        """

        result = await db.execute(text(sql_query))
        periods_data = result.fetchall()

        # Направления
        sql_directions = f"""
        WITH unique_items AS (
            SELECT DISTINCT ON (topic, period, direction, section)
                *
            FROM content_plan_items
            {project_filter}
        )
        SELECT
            direction,
            COUNT(*) as total_themes,
            -- ТЗ: есть ссылка на тз
            SUM(CASE WHEN tz IS NOT NULL AND TRIM(tz) != '' THEN 1 ELSE 0 END) as tz_count,
            -- Написано: есть ссылка на текст (поле review)
            SUM(CASE WHEN review IS NOT NULL AND TRIM(review) != '' THEN 1 ELSE 0 END) as written_count,
            -- Готово: активен чекбокс "проверено врачом"
            SUM(CASE WHEN doctor_approved = TRUE THEN 1 ELSE 0 END) as ready_count,
            -- Прод: есть ссылка в link, статус "размещено" и есть publish_date
            SUM(CASE WHEN link IS NOT NULL AND TRIM(link) != ''
                     AND LOWER(status) = 'размещено' AND publish_date IS NOT NULL THEN 1 ELSE 0 END) as prod_count
        FROM unique_items
        WHERE direction IS NOT NULL AND TRIM(direction) != ''
        GROUP BY direction
        ORDER BY direction
        """

        result = await db.execute(text(sql_directions))
        directions_data = result.fetchall()

        # Общие итоги
        sql_totals = f"""
        WITH unique_items AS (
            SELECT DISTINCT ON (topic, period, direction, section)
                *
            FROM content_plan_items
            {project_filter}
        )
        SELECT
            COUNT(*) as total_themes,
            -- ТЗ: есть ссылка на тз
            SUM(CASE WHEN tz IS NOT NULL AND TRIM(tz) != '' THEN 1 ELSE 0 END) as tz_count,
            -- Написано: есть ссылка на текст (поле review)
            SUM(CASE WHEN review IS NOT NULL AND TRIM(review) != '' THEN 1 ELSE 0 END) as written_count,
            -- Готово: активен чекбокс "проверено врачом"
            SUM(CASE WHEN doctor_approved = TRUE THEN 1 ELSE 0 END) as ready_count,
            -- Прод: есть ссылка в link, статус "размещено" и есть publish_date
            SUM(CASE WHEN link IS NOT NULL AND TRIM(link) != ''
                     AND LOWER(status) = 'размещено' AND publish_date IS NOT NULL THEN 1 ELSE 0 END) as prod_count
        FROM unique_items
        """

        result = await db.execute(text(sql_totals))
        totals_row = result.fetchone()

        # Обработка данных (остается без изменений)
        periods_analytics = []
        for item in periods_data:
            analytics_item = {
                "period": item.period or "Не указан",
                "direction": "",
                "total_themes": item.total_themes,
                "tz_count": item.tz_count or 0,
                "written_count": item.written_count or 0,
                "ready_count": item.ready_count or 0,
                "prod_count": item.prod_count or 0,
                "tz_progress": round(((item.tz_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "written_progress": round(((item.written_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "ready_progress": round(((item.ready_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "prod_progress": round(((item.prod_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0
            }
            periods_analytics.append(analytics_item)

        directions_analytics = []
        for item in directions_data:
            analytics_item = {
                "period": "",
                "direction": item.direction,
                "total_themes": item.total_themes,
                "tz_count": item.tz_count or 0,
                "written_count": item.written_count or 0,
                "ready_count": item.ready_count or 0,
                "prod_count": item.prod_count or 0,
                "tz_progress": round(((item.tz_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "written_progress": round(((item.written_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "ready_progress": round(((item.ready_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0,
                "prod_progress": round(((item.prod_count or 0) / item.total_themes * 100), 1) if item.total_themes > 0 else 0
            }
            directions_analytics.append(analytics_item)

        totals = {
            "total_themes": totals_row.total_themes or 0 if totals_row else 0,
            "tz_count": totals_row.tz_count or 0 if totals_row else 0,
            "written_count": totals_row.written_count or 0 if totals_row else 0,
            "ready_count": totals_row.ready_count or 0 if totals_row else 0,
            "prod_count": totals_row.prod_count or 0 if totals_row else 0,
            "tz_progress": round(((totals_row.tz_count or 0) / (totals_row.total_themes or 1) * 100), 1) if totals_row and totals_row.total_themes > 0 else 0,
            "written_progress": round(((totals_row.written_count or 0) / (totals_row.total_themes or 1) * 100), 1) if totals_row and totals_row.total_themes > 0 else 0,
            "ready_progress": round(((totals_row.ready_count or 0) / (totals_row.total_themes or 1) * 100), 1) if totals_row and totals_row.total_themes > 0 else 0,
            "prod_progress": round(((totals_row.prod_count or 0) / (totals_row.total_themes or 1) * 100), 1) if totals_row and totals_row.total_themes > 0 else 0
        }

        return {
            "periods": periods_analytics,
            "directions": directions_analytics,
            "totals": totals
        }

    except Exception as e:
        logger.error(f"Ошибка получения аналитики: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения аналитики: {str(e)}")