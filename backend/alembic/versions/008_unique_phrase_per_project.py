from alembic import op
import sqlalchemy as sa

revision = "008_unique_phrase_per_project"
down_revision = "004_ws_flag_int"  # поправь при необходимости
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname='public' AND indexname='uq_queries_project_phrase'
      ) THEN
        CREATE UNIQUE INDEX uq_queries_project_phrase
          ON queries (project_id, phrase);
      END IF;
    END $$;
    """)

def downgrade():
    op.execute("DROP INDEX IF EXISTS uq_queries_project_phrase;")
