"""audit versions + helpers

Revision ID: 002_audit_and_helpers
Revises: 001_init
Create Date: 2025-09-03 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "002_audit_and_helpers"
down_revision = "001_init"
branch_labels = None
depends_on = None

def upgrade():
    # Таблица версий (аудит)
    op.create_table(
        "query_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("query_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("before", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("author_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()")),
        sa.Index("idx_qv_query_id_version", "query_id", "version"),
    )

    # Функция-триггер: сохраняем снимок "before/after" при UPDATE
    op.execute("""
    CREATE OR REPLACE FUNCTION trg_queries_version()
    RETURNS trigger AS $$
    DECLARE
      v_before jsonb;
      v_after  jsonb;
      v_ver    int;
    BEGIN
      v_ver := COALESCE(NEW.version, 1);
      v_before := jsonb_build_object(
        'project_id', OLD.project_id,
        'direction_id', OLD.direction_id,
        'cluster_id', OLD.cluster_id,
        'phrase', OLD.phrase,
        'page', OLD.page,
        'tags', to_jsonb(OLD.tags),
        'page_type', OLD.page_type,
        'query_type', OLD.query_type,
        'ws_flag', OLD.ws_flag,
        'dt', to_char(OLD.dt, 'YYYY-MM-DD'),
        'updated_at', to_char(OLD.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      v_after := jsonb_build_object(
        'project_id', NEW.project_id,
        'direction_id', NEW.direction_id,
        'cluster_id', NEW.cluster_id,
        'phrase', NEW.phrase,
        'page', NEW.page,
        'tags', to_jsonb(NEW.tags),
        'page_type', NEW.page_type,
        'query_type', NEW.query_type,
        'ws_flag', NEW.ws_flag,
        'dt', to_char(NEW.dt, 'YYYY-MM-DD'),
        'updated_at', to_char(NEW.updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      );
      INSERT INTO query_versions(id, query_id, version, before, after, author_id)
      VALUES (gen_random_uuid(), NEW.id, v_ver, v_before, v_after, NEW.updated_by);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    """)

    op.execute("""
    DROP TRIGGER IF EXISTS trg_queries_version ON queries;
    CREATE TRIGGER trg_queries_version
      AFTER UPDATE ON queries
      FOR EACH ROW
      WHEN (OLD.* IS DISTINCT FROM NEW.*)
      EXECUTE FUNCTION trg_queries_version();
    """)

def downgrade():
    op.execute("DROP TRIGGER IF EXISTS trg_queries_version ON queries;")
    op.execute("DROP FUNCTION IF EXISTS trg_queries_version();")
    op.drop_table("query_versions")
