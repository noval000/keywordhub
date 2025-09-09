from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as psql

# revision identifiers, used by Alembic.
revision = "013_content_plan_items"
down_revision = "012_cluster_registry"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "content_plan_items",
        sa.Column("id", psql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("project_id", psql.UUID(as_uuid=True),
                  sa.ForeignKey("projects.id", ondelete="CASCADE"),
                  nullable=True),

        # бизнес-поля
        sa.Column("period", sa.String(32), nullable=True),
        sa.Column("section", sa.String(255), nullable=True),
        sa.Column("direction", sa.String(255), nullable=True),
        sa.Column("topic", sa.Text, nullable=True),
        sa.Column("tz", sa.Text, nullable=True),
        sa.Column("chars", sa.Integer, nullable=True),
        sa.Column("status", sa.String(48), nullable=True),
        sa.Column("author", sa.String(255), nullable=True),
        sa.Column("review", sa.String(255), nullable=True),
        sa.Column("meta_seo", sa.Text, nullable=True),
        sa.Column("doctor_review", sa.Boolean, nullable=True),
        sa.Column("publish_allowed", sa.Boolean, nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("link", sa.String(1024), nullable=True),
        sa.Column("publish_date", sa.Date, nullable=True),

        # техполя
        sa.Column("version", sa.Integer, nullable=False, server_default="1"),
        sa.Column("created_by", psql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("updated_by", psql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )

    op.create_index(
        "idx_content_plan_items_project",
        "content_plan_items",
        ["project_id"],
        unique=False,
    )
    op.create_index(
        "idx_content_plan_items_project_status",
        "content_plan_items",
        ["project_id", "status"],
        unique=False,
    )
    op.create_index(
        "idx_content_plan_items_period",
        "content_plan_items",
        ["project_id", "period"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_content_plan_items_period", table_name="content_plan_items")
    op.drop_index("idx_content_plan_items_project_status", table_name="content_plan_items")
    op.drop_index("idx_content_plan_items_project", table_name="content_plan_items")
    op.drop_table("content_plan_items")
