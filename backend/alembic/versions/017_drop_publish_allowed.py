"""Drop column publish_allowed from content_plan_items

Revision ID: 019_drop_publish_allowed
Revises: <put_previous_revision_here>
Create Date: 2025-09-07 00:00:00
"""

from alembic import op

# ревизии
revision = "017_drop_publish_allowed"
down_revision = "016_publish_allowed_bool_to_text"
branch_labels = None
depends_on = None

TABLE = "content_plan_items"
COLUMN = "publish_allowed"

def upgrade() -> None:
    # удаляем колонку, если существует
    op.execute(f"""
DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = '{TABLE}'
          AND column_name  = '{COLUMN}'
    ) THEN
        ALTER TABLE {TABLE} DROP COLUMN {COLUMN};
        RAISE NOTICE 'Dropped column {COLUMN} on {TABLE}';
    ELSE
        RAISE NOTICE 'Column {COLUMN} not found on {TABLE}, skip';
    END IF;
END
$do$;
    """)

def downgrade() -> None:
    # добавляем обратно как TEXT NULL (если вдруг откат)
    op.execute(f"""
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name   = '{TABLE}'
          AND column_name  = '{COLUMN}'
    ) THEN
        ALTER TABLE {TABLE} ADD COLUMN {COLUMN} TEXT NULL;
        RAISE NOTICE 'Recreated column {COLUMN} on {TABLE} (TEXT NULL)';
    ELSE
        RAISE NOTICE 'Column {COLUMN} already exists on {TABLE}, skip';
    END IF;
END
$do$;
    """)
