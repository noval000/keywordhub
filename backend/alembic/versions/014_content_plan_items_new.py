from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
import uuid

# revision identifiers, used by Alembic.
revision = "014_content_plan_items_new"
down_revision = "013_content_plan_items"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем таблицу с IF NOT EXISTS
    op.execute(text("""
        CREATE TABLE IF NOT EXISTS content_plan_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            period VARCHAR(32),
            section VARCHAR(255),
            direction VARCHAR(255),
            topic TEXT,
            tz TEXT,
            chars INTEGER,
            status VARCHAR(48),
            author VARCHAR(255),
            review VARCHAR(255),
            meta_seo TEXT,
            doctor_review BOOLEAN,
            publish_allowed BOOLEAN,
            comment TEXT,
            link VARCHAR(1024),
            publish_date DATE,
            version INTEGER NOT NULL DEFAULT 1,
            created_by UUID REFERENCES users(id) NOT NULL,
            updated_by UUID REFERENCES users(id) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
    """))

    # Создаем индексы с IF NOT EXISTS
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_content_plan_items_project ON content_plan_items (project_id);"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_content_plan_items_project_status ON content_plan_items (project_id, status);"))
    op.execute(text("CREATE INDEX IF NOT EXISTS idx_content_plan_items_period ON content_plan_items (project_id, period);"))


def downgrade() -> None:
    # Удаляем индексы и таблицу с IF EXISTS
    op.execute(text("DROP INDEX IF EXISTS idx_content_plan_items_period;"))
    op.execute(text("DROP INDEX IF EXISTS idx_content_plan_items_project_status;"))
    op.execute(text("DROP INDEX IF EXISTS idx_content_plan_items_project;"))
    # op.execute(text("DROP TABLE IF EXISTS content_plan_items;"))  # Раскомментируйте если нужно