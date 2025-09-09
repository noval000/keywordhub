"""init schema

Revision ID: 001_init
Revises:
Create Date: 2025-09-03 00:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "001_init"
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Расширения
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";')
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')

    # users (минимально, под аудит)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.Text(), nullable=False, unique=True),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
    )

    # projects
    op.create_table(
        "projects",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("domain", sa.Text(), nullable=True),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
    )

    # project_members (RBAC, задел)
    op.create_table(
        "project_members",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id")),
        sa.Column("role", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "project_id"),
    )

    # directions
    op.create_table(
        "directions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("project_id", "name", name="uq_direction_project_name"),
    )

    # clusters
    op.create_table(
        "clusters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.UniqueConstraint("project_id", "name", name="uq_cluster_project_name"),
    )

    # queries
    op.create_table(
        "queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE")),
        sa.Column("direction_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("directions.id")),
        sa.Column("cluster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clusters.id")),
        sa.Column("phrase", sa.Text(), nullable=False),
        sa.Column("page", sa.Text(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.Text()), server_default=sa.text("'{}'")),
        sa.Column("page_type", sa.Text(), nullable=True),
        sa.Column("query_type", sa.Text(), nullable=True),
        sa.Column("ws_flag", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("dt", sa.Date(), nullable=True),
        sa.Column("version", sa.Integer(), server_default=sa.text("1")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.UniqueConstraint("project_id", "direction_id", "phrase", name="uq_phrase_in_direction"),
    )

    # индексы под фильтры
    op.create_index("idx_queries_project", "queries", ["project_id"])
    op.create_index("idx_queries_direction", "queries", ["direction_id"])
    op.create_index("idx_queries_cluster", "queries", ["cluster_id"])
    op.create_index("idx_queries_tags", "queries", ["tags"], postgresql_using="gin")
    op.create_index(
        "idx_phrase_trgm",
        "queries",
        ["phrase"],
        postgresql_using="gin",
        postgresql_ops={"phrase": "gin_trgm_ops"},
    )


def downgrade():
    op.drop_table("queries")
    op.drop_table("clusters")
    op.drop_table("directions")
    op.drop_table("project_members")
    op.drop_table("projects")
    op.drop_table("users")
    # расширения оставим
