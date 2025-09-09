import os
import sys
from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context

# Позволяет импортировать app.models
sys.path.append(os.path.dirname(os.path.abspath(__file__)) + "/..")

from app.models import Base  # noqa

# Alembic Config object
config = context.config
fileConfig(config.config_file_name)

# URL для sync-движка (миграции)
ALEMBIC_DATABASE_URL = os.getenv("ALEMBIC_DATABASE_URL") or "postgresql+psycopg2://app:app@localhost:5432/keywordhub"

target_metadata = Base.metadata

def run_migrations_offline():
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
    connectable = create_engine(
        ALEMBIC_DATABASE_URL,
        poolclass=pool.NullPool,
        future=True,
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
