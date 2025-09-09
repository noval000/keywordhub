from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import json
import asyncio
import logging
from io import StringIO
import csv
from datetime import datetime

from ..db import get_db
from ..models import DoctorProfile, ParsingTask
from ..services.doctor_parser import DoctorParser

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/parser", tags=["Doctor Parser"])

# Pydantic модели для API
from pydantic import BaseModel

class ParseURLsRequest(BaseModel):
    urls: List[str]
    task_name: str
    proxy_list: Optional[List[str]] = []
    batch_size: Optional[int] = 5
    delay_between_requests: Optional[float] = 2.0

class TaskStatus(BaseModel):
    id: int
    task_id: str  # Изменено на str для UUID
    task_name: str
    total_profiles: int  # Исправлено название поля
    processed_profiles: int  # Исправлено название поля
    status: str
    progress_percentage: float
    created_at: str
    completed_at: Optional[str] = None
    error_message: Optional[str] = None

async def run_parsing_task(urls: List[str], task_uuid: str, batch_size: int, delay: float, proxy_list: List[str] = []):
    """Фоновая задача парсинга с прокси"""
    from ..db import SessionLocal

    parser = DoctorParser()
    if proxy_list:
        parser.set_proxy_list(proxy_list)

    async with SessionLocal() as db:
        try:
            await parser.parse_urls_batch(urls, db, task_uuid, batch_size, delay)
        except Exception as e:
            logger.error(f"Ошибка в фоновой задаче парсинга: {e}")
            # Обновляем статус задачи при ошибке
            try:
                result = await db.execute(select(ParsingTask).where(ParsingTask.task_id == task_uuid))
                task = result.scalar_one_or_none()
                if task:
                    task.status = "failed"
                    task.error_message = str(e)
                    task.completed_at = datetime.utcnow()
                    await db.commit()
            except Exception as update_error:
                logger.error(f"Ошибка обновления статуса задачи: {update_error}")

@router.post("/start-parsing")
async def start_parsing(
    request: ParseURLsRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Запуск парсинга списка URL врачей"""
    try:
        # Создаем задачу парсинга с правильными полями
        parsing_task = ParsingTask(
            total_profiles=len(request.urls),  # Исправлено название поля
            status="pending"
        )

        db.add(parsing_task)
        await db.commit()
        await db.refresh(parsing_task)

        # Запускаем парсинг в фоне с task_id (UUID)
        background_tasks.add_task(
            run_parsing_task,
            request.urls,
            str(parsing_task.task_id),  # Передаем UUID как строку
            request.batch_size,
            request.delay_between_requests,
            request.proxy_list
        )

        return {
            "message": "Парсинг запущен",
            "task_id": str(parsing_task.task_id),  # Возвращаем UUID
            "urls_count": len(request.urls),
            "proxy_count": len(request.proxy_list)
        }

    except Exception as e:
        logger.error(f"Ошибка запуска парсинга: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка запуска парсинга: {str(e)}")

@router.post("/upload-urls")
async def upload_urls(
    file: UploadFile = File(...),
    task_name: str = "Imported URLs",
    proxy_list: str = "",
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db)
):
    """Загрузка URL из файла и запуск парсинга"""
    try:
        content = await file.read()

        if file.filename.endswith('.json'):
            data = json.loads(content.decode('utf-8'))
            urls = data.get('urls', []) if isinstance(data, dict) else data
        elif file.filename.endswith(('.csv', '.txt')):
            content_str = content.decode('utf-8')
            lines = content_str.strip().split('\n')
            urls = [line.strip() for line in lines if line.strip()]
        else:
            raise HTTPException(status_code=400, detail="Поддерживаются только JSON, CSV и TXT файлы")

        if not urls:
            raise HTTPException(status_code=400, detail="Не найдено URL в файле")

        # Парсим прокси
        proxies = []
        if proxy_list.strip():
            if ',' in proxy_list:
                proxy_strings = [p.strip() for p in proxy_list.split(',') if p.strip()]
            else:
                proxy_strings = [p.strip() for p in proxy_list.split('\n') if p.strip()]
            proxies = proxy_strings

        # Создаем задачу с правильными полями
        parsing_task = ParsingTask(
            total_profiles=len(urls),
            status="pending"
        )

        db.add(parsing_task)
        await db.commit()
        await db.refresh(parsing_task)

        background_tasks.add_task(
            run_parsing_task,
            urls,
            str(parsing_task.task_id),
            5,
            2.0,
            proxies
        )

        return {
            "message": "Файл загружен, парсинг запущен",
            "task_id": str(parsing_task.task_id),
            "urls_count": len(urls),
            "proxy_count": len(proxies),
            "normalized_proxies": proxies[:3] if proxies else []
        }

    except Exception as e:
        logger.error(f"Ошибка загрузки файла: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")

@router.get("/tasks")
async def get_parsing_tasks(
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Получить список задач парсинга"""
    try:
        query = select(ParsingTask).order_by(ParsingTask.created_at.desc()).limit(limit).offset(offset)
        result = await db.execute(query)
        tasks = result.scalars().all()

        tasks_data = []
        for task in tasks:
            progress = (task.processed_profiles / task.total_profiles * 100) if task.total_profiles > 0 else 0

            tasks_data.append(TaskStatus(
                id=task.id,
                task_id=str(task.task_id),  # Преобразуем UUID в строку
                task_name=f"Task {task.id}",  # Временное название, пока нет поля task_name
                total_profiles=task.total_profiles,
                processed_profiles=task.processed_profiles,
                status=task.status,
                progress_percentage=round(progress, 1),
                created_at=task.created_at.isoformat(),
                completed_at=task.completed_at.isoformat() if task.completed_at else None,
                error_message=task.error_message
            ))

        return {"tasks": tasks_data}

    except Exception as e:
        logger.error(f"Ошибка получения задач: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения задач: {str(e)}")

@router.get("/tasks/{task_id}")
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    """Получить статус конкретной задачи"""
    try:
        query = select(ParsingTask).where(ParsingTask.task_id == task_id)
        result = await db.execute(query)
        task = result.scalar_one_or_none()

        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")

        progress = (task.processed_profiles / task.total_profiles * 100) if task.total_profiles > 0 else 0

        return TaskStatus(
            id=task.id,
            task_id=str(task.task_id),
            task_name=f"Task {task.id}",
            total_profiles=task.total_profiles,
            processed_profiles=task.processed_profiles,
            status=task.status,
            progress_percentage=round(progress, 1),
            created_at=task.created_at.isoformat(),
            completed_at=task.completed_at.isoformat() if task.completed_at else None,
            error_message=task.error_message
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения статуса задачи: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения статуса: {str(e)}")

def create_csv_content(profiles: List[DoctorProfile]) -> str:
    """Создание CSV контента из профилей врачей с правильными полями"""
    output = StringIO()
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)

    # Заголовки CSV согласно текущей модели
    headers = [
        'ID',
        'Task ID',
        'Имя врача',
        'Специализация',
        'Опыт работы',
        'Образование',
        'Место работы',
        'Рейтинг',
        'Количество отзывов',
        'Телефон',
        'Адрес',
        'URL профиля',
        'Дата парсинга'
    ]
    writer.writerow(headers)

    # Данные согласно текущей модели DoctorProfile
    for profile in profiles:
        row = [
            profile.id,
            str(profile.task_id),
            profile.name or "",
            profile.specialization or "",
            profile.experience or "",
            profile.education or "",
            profile.workplace or "",
            profile.rating or "",
            profile.reviews_count or "",
            profile.phone or "",
            profile.address or "",
            profile.profile_url or "",
            profile.parsing_date.strftime("%Y-%m-%d %H:%M:%S") if profile.parsing_date else ""
        ]
        writer.writerow(row)

    return output.getvalue()

@router.get("/results/{task_id}")
async def get_parsing_results(
    task_id: str,  # Изменено на str для UUID
    format: str = "json",
    db: AsyncSession = Depends(get_db)
):
    """Получить результаты парсинга конкретной задачи"""
    try:
        # Проверяем существование задачи
        task_query = select(ParsingTask).where(ParsingTask.task_id == task_id)
        task_result = await db.execute(task_query)
        task = task_result.scalar_one_or_none()

        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")

        # Получаем профили этой задачи через relationship
        query = select(ParsingTask).options(
            selectinload(ParsingTask.doctor_profiles)
        ).where(ParsingTask.task_id == task_id)

        result = await db.execute(query)
        task_with_profiles = result.scalar_one_or_none()

        if not task_with_profiles:
            raise HTTPException(status_code=404, detail="Задача не найдена")

        profiles = task_with_profiles.doctor_profiles

        if format == "json":
            profiles_data = []
            for profile in profiles:
                profiles_data.append({
                    "id": profile.id,
                    "task_id": str(profile.task_id),
                    "name": profile.name,
                    "specialization": profile.specialization,
                    "experience": profile.experience,
                    "education": profile.education,
                    "workplace": profile.workplace,
                    "rating": profile.rating,
                    "reviews_count": profile.reviews_count,
                    "phone": profile.phone,
                    "address": profile.address,
                    "profile_url": profile.profile_url,
                    "parsing_date": profile.parsing_date.isoformat() if profile.parsing_date else None
                })

            return {"profiles": profiles_data, "total": len(profiles_data)}

        elif format == "csv":
            if not profiles:
                # Возвращаем пустой CSV с заголовками
                empty_csv = "ID,Task ID,Имя врача,Специализация,Опыт работы,Образование,Место работы,Рейтинг,Количество отзывов,Телефон,Адрес,URL профиля,Дата парсинга\n"
                return Response(
                    content=empty_csv.encode('utf-8-sig'),
                    media_type="text/csv; charset=utf-8",
                    headers={
                        "Content-Disposition": f"attachment; filename=doctor_profiles_{task_id}_empty.csv"
                    }
                )

            # Создаем CSV контент
            csv_content = create_csv_content(profiles)

            return Response(
                content=csv_content.encode('utf-8-sig'),
                media_type="text/csv; charset=utf-8",
                headers={
                    "Content-Disposition": f"attachment; filename=doctor_profiles_{task_id}.csv",
                    "Cache-Control": "no-cache",
                }
            )

        else:
            raise HTTPException(status_code=400, detail="Поддерживаются форматы: json, csv")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка получения результатов для задачи {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения результатов: {str(e)}")

@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, db: AsyncSession = Depends(get_db)):
    """Удалить задачу и связанные профили"""
    try:
        # Получаем задачу с профилями
        query = select(ParsingTask).options(
            selectinload(ParsingTask.doctor_profiles)
        ).where(ParsingTask.task_id == task_id)

        result = await db.execute(query)
        task = result.scalar_one_or_none()

        if not task:
            raise HTTPException(status_code=404, detail="Задача не найдена")

        # Удаляем связанные профили
        profiles_count = len(task.doctor_profiles)
        for profile in task.doctor_profiles:
            await db.delete(profile)

        # Удаляем задачу
        await db.delete(task)
        await db.commit()

        return {
            "message": f"Задача {task_id} удалена",
            "deleted_profiles": profiles_count
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ошибка удаления задачи: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка удаления: {str(e)}")

@router.get("/debug/profiles")
async def debug_profiles(db: AsyncSession = Depends(get_db)):
    """Отладочный endpoint для просмотра профилей"""
    try:
        query = select(DoctorProfile).order_by(DoctorProfile.parsing_date.desc()).limit(10)
        result = await db.execute(query)
        profiles = result.scalars().all()

        profiles_data = []
        for profile in profiles:
            profiles_data.append({
                "id": profile.id,
                "task_id": str(profile.task_id) if profile.task_id else None,
                "name": profile.name,
                "specialization": profile.specialization,
                "parsing_date": profile.parsing_date.isoformat() if profile.parsing_date else None,
            })

        return {"profiles": profiles_data, "total": len(profiles_data)}

    except Exception as e:
        logger.error(f"Ошибка отладки: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка отладки: {str(e)}")

# Добавим пример файлов без изменений
@router.get("/example-files/{format}")
async def download_example_file(format: str):
    """Скачать пример файла для загрузки URL"""
    if format == "json":
        example_data = {
            "urls": [
                "https://yandex.ru/search/?text=Иванов+Иван+Иванович+врач+кардиолог+москва",
                "https://yandex.ru/search/?text=Петров+Петр+Петрович+врач+терапевт+спб",
                "https://yandex.ru/search/?text=Сидоров+Сидор+Сидорович+врач+хирург+екатеринбург"
            ]
        }
        content = json.dumps(example_data, ensure_ascii=False, indent=2)
        return Response(
            content=content.encode('utf-8'),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=urls_example.json"}
        )
    elif format == "csv":
        content = """https://yandex.ru/search/?text=Иванов+Иван+Иванович+врач+кардиолог+москва
https://yandex.ru/search/?text=Петров+Петр+Петрович+врач+терапевт+спб
https://yandex.ru/search/?text=Сидоров+Сидор+Сидорович+врач+хирург+екатеринбург"""
        return Response(
            content=content.encode('utf-8'),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=urls_example.csv"}
        )
    elif format == "txt":
        content = """https://yandex.ru/search/?text=Иванов+Иван+Иванович+врач+кардиолог+москва
https://yandex.ru/search/?text=Петров+Петр+Петрович+врач+терапевт+спб
https://yandex.ru/search/?text=Сидоров+Сидор+Сидорович+врач+хирург+екатеринбург"""
        return Response(
            content=content.encode('utf-8'),
            media_type="text/plain",
            headers={"Content-Disposition": "attachment; filename=urls_example.txt"}
        )
    else:
        raise HTTPException(status_code=400, detail="Поддерживаемые форматы: json, csv, txt")