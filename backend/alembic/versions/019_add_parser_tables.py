# migrations/versions/019_add_parser_tables.py
"""Add parser tables

Revision ID: add_parser_tables
Revises: <предыдущая_ревизия>
Create Date: 2025-01-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_parser_tables'
down_revision = '018_create_page_access'
branch_labels = None
depends_on = None


def upgrade():
    # Создание таблицы parsing_tasks
    op.create_table('parsing_tasks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('task_name', sa.String(), nullable=False),
    sa.Column('urls_count', sa.Integer(), nullable=False),
    sa.Column('completed_count', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_parsing_tasks_id'), 'parsing_tasks', ['id'], unique=False)

    # Создание таблицы doctor_profiles
    op.create_table('doctor_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('url', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=True),
    sa.Column('clinic', sa.String(), nullable=True),
    sa.Column('descriptions', sa.JSON(), nullable=True),
    sa.Column('education', sa.JSON(), nullable=True),
    sa.Column('specializations', sa.JSON(), nullable=True),
    sa.Column('raw_html', sa.Text(), nullable=True),
    sa.Column('parsed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('is_parsed', sa.Boolean(), nullable=True),
    sa.Column('error_message', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_doctor_profiles_id'), 'doctor_profiles', ['id'], unique=False)
    op.create_index(op.f('ix_doctor_profiles_url'), 'doctor_profiles', ['url'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_doctor_profiles_url'), table_name='doctor_profiles')
    op.drop_index(op.f('ix_doctor_profiles_id'), table_name='doctor_profiles')
    op.drop_table('doctor_profiles')
    op.drop_index(op.f('ix_parsing_tasks_id'), table_name='parsing_tasks')
    op.drop_table('parsing_tasks')