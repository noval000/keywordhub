from alembic import op
import sqlalchemy as sa
import uuid

# revision identifiers, used by Alembic.
revision = "014_content_plan_items_new"
down_revision = "013_content_plan_items"
branch_labels = None
depends_on = None


def _has_index(insp, table: str, name: str) -> bool:
    try:
        return any(ix.get("name") == name for ix in insp.get_indexes(table))
    except Exception:
        return False


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Таблица
    if not insp.has_table("content_plan_items"):
        op.create_table(
            "content_plan_items",
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
            sa.Column("project_id", sa.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=True),
            sa.Column("period", sa.String(32)),
            sa.Column("section", sa.String(255)),
            sa.Column("direction", sa.String(255)),
            sa.Column("topic", sa.Text),
            sa.Column("tz", sa.Text),
            sa.Column("chars", sa.Integer),
            sa.Column("status", sa.String(48)),
            sa.Column("author", sa.String(255)),
            sa.Column("review", sa.String(255)),
            sa.Column("meta_seo", sa.Text),
            sa.Column("doctor_review", sa.Boolean),
            sa.Column("publish_allowed", sa.Boolean),
            sa.Column("comment", sa.Text),
            sa.Column("link", sa.String(1024)),
            sa.Column("publish_date", sa.Date),
            sa.Column("version", sa.Integer, nullable=False, server_default="1"),
            sa.Column("created_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("updated_by", sa.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
        )

    # Индексы (создаём, если отсутствуют)
    if insp.has_table("content_plan_items"):
        if not _has_index(insp, "content_plan_items", "idx_content_plan_items_project"):
            op.create_index("idx_content_plan_items_project", "content_plan_items", ["project_id"])
        if not _has_index(insp, "content_plan_items", "idx_content_plan_items_project_status"):
            op.create_index("idx_content_plan_items_project_status", "content_plan_items", ["project_id", "status"])
        if not _has_index(insp, "content_plan_items", "idx_content_plan_items_period"):
            op.create_index("idx_content_plan_items_period", "content_plan_items", ["project_id", "period"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Индексы удаляем, только если есть таблица и индексы
    if insp.has_table("content_plan_items"):
        if _has_index(insp, "content_plan_items", "idx_content_plan_items_period"):
            op.drop_index("idx_content_plan_items_period", table_name="content_plan_items")
        if _has_index(insp, "content_plan_items", "idx_content_plan_items_project_status"):
            op.drop_index("idx_content_plan_items_project_status", table_name="content_plan_items")
        if _has_index(insp, "content_plan_items", "idx_content_plan_items_project"):
            op.drop_index("idx_content_plan_items_project", table_name="content_plan_items")

        # Таблицу трогай только если действительно нужна полная откатка:
        # op.drop_table("content_plan_items")
