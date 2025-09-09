"""Create table page_access

Revision ID: 018_create_page_access
Revises: 017_drop_publish_allowed
Create Date: 2025-09-08 00:00:00
"""

from alembic import op

# ревизии
revision = "018_create_page_access"
down_revision = "017_drop_publish_allowed"
branch_labels = None
depends_on = None

TABLE = "page_access"

def upgrade() -> None:
    op.execute(f"""
DO $do$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name   = '{TABLE}'
    ) THEN
        CREATE TABLE {TABLE} (
            user_id UUID NOT NULL,
            page VARCHAR(50) NOT NULL,
            PRIMARY KEY (user_id, page)
        );
        CREATE UNIQUE INDEX uq_pageaccess_user_page ON {TABLE} (user_id, page);
        RAISE NOTICE 'Created table {TABLE}';
    ELSE
        RAISE NOTICE 'Table {TABLE} already exists, skip';
    END IF;
END
$do$;
    """)

def downgrade() -> None:
    op.execute(f"""
DO $do$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_name   = '{TABLE}'
    ) THEN
        DROP TABLE {TABLE};
        RAISE NOTICE 'Dropped table {TABLE}';
    ELSE
        RAISE NOTICE 'Table {TABLE} not found, skip';
    END IF;
END
$do$;
    """)
