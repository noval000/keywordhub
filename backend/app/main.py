from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
from contextlib import asynccontextmanager

from .config import settings
from .routers import (
    auth,
    projects,
    dictionaries,
    queries,
    cluster_registry,
    content_plan,
    project_members,
    access,
    analytics,
    doctor_parser
)

# Настройка логирования
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Функция для применения миграций
def run_migrations():
    """Автоматически применяет все неприменённые миграции"""

    if not settings.AUTO_MIGRATE:
        logger.info("ℹ️ Автоматические миграции отключены (AUTO_MIGRATE=false)")
        return True

    try:
        import subprocess
        import os

        logger.info("🔄 Применение миграций через subprocess...")

        # Применяем миграции через subprocess с таймаутом
        env = os.environ.copy()
        env['ALEMBIC_DATABASE_URL'] = settings.ALEMBIC_DATABASE_URL

        result = subprocess.run(
            ['alembic', 'upgrade', 'head'],
            capture_output=True,
            text=True,
            timeout=60,  # Таймаут 60 секунд
            env=env,
            cwd='/app'
        )

        if result.returncode == 0:
            logger.info("✅ Миграции успешно применены")
            if result.stdout:
                logger.info(f"📋 Вывод: {result.stdout}")
            return True
        else:
            logger.error(f"❌ Ошибка применения миграций: {result.stderr}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("⏰ Миграции превысили лимит времени (60 сек)")
        return False

    except Exception as e:
        logger.error(f"❌ Ошибка при применении миграций: {e}")

        if settings.FAIL_ON_MIGRATION_ERROR:
            raise
        else:
            logger.warning("⚠️ Продолжаем запуск несмотря на ошибку миграции")
            return False

# Lifespan контекст для управления жизненным циклом приложения
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting KeywordHub API...")

    # Применяем миграции перед инициализацией БД
    try:
        migration_success = run_migrations()
        if not migration_success:
            logger.warning("⚠️ Миграции не были применены, но продолжаем запуск")
    except Exception as e:
        logger.error(f"💥 Критическая ошибка при применении миграций: {e}")
        raise

    # Инициализируем базу данных
    try:
        from .db import init_db
        await init_db()
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"💥 Database initialization failed: {e}")
        raise

    logger.info("✅ Application startup completed")

    yield

    # Shutdown
    logger.info("🛑 Shutting down KeywordHub API...")
    try:
        from .db import close_db_connections
        await close_db_connections()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"⚠️ Error during shutdown: {e}")

# Создание FastAPI приложения с lifespan
app = FastAPI(
    title=settings.APP_NAME,
    description="API для управления кластерами, контент-планами и парсинга профилей врачей",
    version="1.0.0",
    lifespan=lifespan  # Используем lifespan вместо on_event
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров с префиксами
app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(dictionaries.router)
app.include_router(queries.router)
app.include_router(cluster_registry.router)
app.include_router(content_plan.router)
app.include_router(project_members.router)
app.include_router(access.router)
app.include_router(analytics.router)
app.include_router(doctor_parser.router)

@app.get("/")
async def root():
    """Базовый эндпоинт для проверки работы API"""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "status": "running",
        "version": "1.0.0",
        "features": [
            "Project Management",
            "Content Planning",
            "Analytics",
            "Doctor Parser"
        ]
    }

@app.get("/health")
async def health():
    """Проверка здоровья системы"""
    try:
        from .db import check_database_connection
        db_status = await check_database_connection()
        return {
            "status": "healthy" if db_status else "degraded",
            "database": "connected" if db_status else "disconnected",
            "services": {
                "api": "running",
                "database": "connected" if db_status else "disconnected",
                "parser": "available"
            },
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level=settings.LOG_LEVEL.lower()
    )