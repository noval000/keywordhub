"""Add can_view_all_content field to User model

Revision ID: 025_user_migration_new_class
Revises: 024_can_view_all_content
Create Date: 2025-09-10 12:36:32.123456

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '025_user_migration_new_class'
down_revision = '024_can_view_all_content'
branch_labels = None
depends_on = None


def _column_exists(connection, table_name: str, column_name: str) -> bool:
    """Проверяет существование колонки через SQL запрос"""
    try:
        result = connection.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = :table_name
                AND column_name = :column_name
            );
        """), {"table_name": table_name, "column_name": column_name})
        return result.scalar()
    except Exception:
        return False


def upgrade() -> None:
    # Получаем подключение
    bind = op.get_bind()

    # Проверяем, существует ли уже колонка
    if not _column_exists(bind, "users", "can_view_all_content"):
        # Добавляем колонку только если ее нет
        op.add_column('users', sa.Column('can_view_all_content', sa.Boolean(), nullable=True))

        # Устанавливаем значение по умолчанию для существующих пользователей
        op.execute(text("UPDATE users SET can_view_all_content = false WHERE can_view_all_content IS NULL"))

        # Делаем поле NOT NULL после установки значений по умолчанию
        op.alter_column('users', 'can_view_all_content', nullable=False)
    else:
        # Колонка уже существует, просто обновляем значения по умолчанию если нужно
        op.execute(text("UPDATE users SET can_view_all_content = false WHERE can_view_all_content IS NULL"))


def downgrade() -> None:
    # Получаем подключение
    bind = op.get_bind()

    # Удаляем колонку только если она существует
    if _column_exists(bind, "users", "can_view_all_content"):
        op.drop_column('users', 'can_view_all_content')