"""Add technical specifications table

Revision ID: 027_add_tz_table
Revises: 026_add_filter_doctor
Create Date: 2025-09-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '027_tz'
down_revision = '026_add_filter_doctor'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Создаем таблицу technical_specifications
    op.create_table('technical_specifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content_plan_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('author', sa.String(length=255), nullable=True),
        sa.Column('blocks', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('keywords', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('lsi_phrases', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('competitors', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('count', sa.Integer(), nullable=True),
        sa.Column('usage_form', sa.Text(), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['content_plan_id'], ['content_plan_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('content_plan_id')
    )

def downgrade() -> None:
    # Удаляем таблицу при откате миграции
    op.drop_table('technical_specifications')