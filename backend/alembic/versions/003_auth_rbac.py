"""auth fields + rbac check

Revision ID: 003_auth_rbac
Revises: 002_audit_and_helpers
Create Date: 2025-09-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003_auth_rbac"
down_revision = "002_audit_and_helpers"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("users", sa.Column("password_hash", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    # Чек на роль (если его не было)
    op.create_check_constraint(
        "ck_project_members_role",
        "project_members",
        "role IN ('viewer','editor','admin')"
    )

def downgrade():
    op.drop_constraint("ck_project_members_role", "project_members", type_="check")
    op.drop_column("users", "is_superuser")
    op.drop_column("users", "is_active")
    op.drop_column("users", "password_hash")
