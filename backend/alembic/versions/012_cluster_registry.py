# alembic/versions/010_cluster_registry.py
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "012_cluster_registry"
down_revision = "011_projects_add_audit_cols"

def upgrade():
    op.create_table(
        "cluster_registry",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("direction", sa.String(length=255), nullable=True),
        sa.Column("page_type", sa.String(length=120), nullable=True),
        sa.Column("has_core", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("has_brief", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("demand", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("project_id", "name", name="uq_cluster_registry_project_name"),
    )

def downgrade():
    op.drop_table("cluster_registry")
