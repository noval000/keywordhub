"""ws_flag bool -> int

Revision ID: 004_ws_flag_int
Revises: 003_auth_rbac
Create Date: 2025-09-04 00:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = "004_ws_flag_int"
down_revision = "003_auth_rbac"
branch_labels = None
depends_on = None

def upgrade():
    # bool -> int USING CASE
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag DROP DEFAULT;
    """)
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag TYPE integer
        USING CASE WHEN ws_flag IS TRUE THEN 1 ELSE 0 END;
    """)
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag SET DEFAULT 0;
    """)

def downgrade():
    # int -> bool USING CASE
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag DROP DEFAULT;
    """)
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag TYPE boolean
        USING CASE WHEN ws_flag::int = 1 THEN TRUE ELSE FALSE END;
    """)
    op.execute("""
        ALTER TABLE queries
        ALTER COLUMN ws_flag SET DEFAULT FALSE;
    """)
