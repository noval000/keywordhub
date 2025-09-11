import os
import sys
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# URL для sync-движка (миграции)
ALEMBIC_DATABASE_URL = os.getenv("ALEMBIC_DATABASE_URL") or "postgresql://app:app@db:5432/keywordhub"

# Безопасный импорт моделей
def get_metadata():
    """Безопасно импортирует метаданные моделей"""
    try:
        # Добавляем путь к приложению
        app_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        if app_path not in sys.path:
            sys.path.insert(0, app_path)

        # Импортируем модели
        from app.models import Base
        return Base.metadata
    except Exception as e:
        print(f"⚠️ Ошибка импорта моделей: {e}")
        # Возвращаем None, чтобы миграции могли работать без автогенерации
        return None

target_metadata = get_metadata()

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    context.configure(
        url=ALEMBIC_DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode."""

    # Создаем движок с дополнительными настройками
    connectable = create_engine(
        ALEMBIC_DATABASE_URL,
        poolclass=pool.NullPool,
        pool_pre_ping=True,  # Проверка соединения
        connect_args={
            "connect_timeout": 10,  # Таймаут подключения
            "application_name": "alembic_migrations"
        }
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()