from alembic import op
import sqlalchemy as sa

revision = "009_project_soft_delete"
down_revision = "008_unique_phrase_per_project"  # поправь под свою цепочку

def upgrade():
    op.add_column("projects", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("projects", sa.Column("archived_at", sa.TIMESTAMP(timezone=True), nullable=True))

def downgrade():
    op.drop_column("projects", "archived_at")
    op.drop_column("projects", "is_archived")
