from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

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
    level=getattr(logging, settings.LOG_LEVEL),  # Используем настройку из config
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Создание FastAPI приложения
app = FastAPI(
    title=settings.APP_NAME,
    description="API для управления кластерами, контент-планами и парсинга профилей врачей",
    version="1.0.0"
)

# Настройка CORS - ИСПРАВЛЕНО
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,  # Используем property из config
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# События запуска и остановки
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting KeywordHub API...")

    try:
        from .db import init_db  # ИСПРАВЛЕНО: используем init_db
        await init_db()
        logger.info("✅ Application startup completed")
    except Exception as e:
        logger.warning(f"⚠️ Startup error: {e}, but continuing...")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("🛑 Shutting down KeywordHub API...")
    try:
        from .db import close_db_connections
        await close_db_connections()
        logger.info("✅ Database connections closed")
    except Exception as e:
        logger.error(f"⚠️ Error during shutdown: {e}")

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