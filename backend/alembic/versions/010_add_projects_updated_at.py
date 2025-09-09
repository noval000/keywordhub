# alembic/versions/010_add_projects_updated_at.py
from alembic import op

# ревизии поправь под свои (ниже — пример)
revision = "010_add_projects_updated_at"
down_revision = "009_project_soft_delete"
branch_labels = None
depends_on = None

def upgrade():
    # Добавляем колонку, если её нет
    op.execute("""
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS updated_at timestamptz;
    """)
    # Бэкофилл: где null — проставим created_at
    op.execute("""
        UPDATE projects
        SET updated_at = created_at
        WHERE updated_at IS NULL;
    """)
    # Делаем обязательной и с дефолтом now()
    op.execute("""
        ALTER TABLE projects
        ALTER COLUMN updated_at SET DEFAULT now();
    """)
    op.execute("""
        ALTER TABLE projects
        ALTER COLUMN updated_at SET NOT NULL;
    """)

def downgrade():
    # откат — по вкусу (обычно не трогаем)
    op.execute("""
        ALTER TABLE projects
        DROP COLUMN IF EXISTS updated_at;
    """)
