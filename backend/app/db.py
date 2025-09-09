from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy import text
from .config import settings
import logging

logger = logging.getLogger(__name__)

# Создаем базовый класс для моделей
Base = declarative_base()

# Создаем движок с правильными параметрами для asyncpg
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    pool_recycle=3600,
)

# Создаем сессию
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False
)

async def get_db() -> AsyncSession:
    """Dependency для получения сессии базы данных"""
    async with SessionLocal() as session:
        try:
            yield session
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            await session.close()

async def check_database_connection():
    """Проверка подключения к базе данных"""
    try:
        # ИСПРАВЛЕНО: Используем SessionLocal вместо engine.begin()
        async with SessionLocal() as session:
            result = await session.execute(text("SELECT 1 as test"))
            row = result.fetchone()
            if row and row[0] == 1:
                logger.info("Database connection check successful")
                return True
            else:
                logger.error("Database connection test failed")
                return False
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False

async def close_db_connections():
    """Закрытие всех соединений с базой данных"""
    try:
        await engine.dispose()
        logger.info("Database connections disposed successfully")
    except Exception as e:
        logger.error(f"Error disposing database connections: {e}")

async def init_db():
    """Инициализация базы данных и импорт моделей"""
    try:
        # Импортируем модели для их регистрации
        from . import models  # noqa
        logger.info("Database models imported successfully")

        # Проверяем соединение
        if await check_database_connection():
            logger.info("✅ Database initialization successful")
        else:
            logger.warning("⚠️ Database connection failed during initialization")

    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        # НЕ поднимаем исключение, чтобы не ломать запуск
        pass