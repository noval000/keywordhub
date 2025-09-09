# alembic/versions/011_projects_add_audit_cols.py
from alembic import op

revision = "011_projects_add_audit_cols"
down_revision = "010_add_projects_updated_at"  # подставь свой предыдущий id
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS created_by uuid NULL;
    """)
    op.execute("""
        ALTER TABLE projects
        ADD COLUMN IF NOT EXISTS updated_by uuid NULL;
    """)

def downgrade():
    op.execute("""
        ALTER TABLE projects
        DROP COLUMN IF EXISTS updated_by;
    """)
    op.execute("""
        ALTER TABLE projects
        DROP COLUMN IF EXISTS created_by;
    """)
