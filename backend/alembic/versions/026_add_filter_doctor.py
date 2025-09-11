"""Add reviewing_doctor and doctor_approved to content_plan_items

Revision ID: [автоматически сгенерированный]
Revises: [предыдущая ревизия]
Create Date: [дата создания]

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '026_add_filter_doctor'
down_revision = '025_user_migration_new_class'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Добавляем новые колонки
    op.add_column('content_plan_items', sa.Column('reviewing_doctor', sa.String(255), nullable=True))
    op.add_column('content_plan_items', sa.Column('doctor_approved', sa.Boolean(), nullable=True))

def downgrade() -> None:
    # Удаляем колонки при откате миграции
    op.drop_column('content_plan_items', 'doctor_approved')
    op.drop_column('content_plan_items', 'reviewing_doctor')