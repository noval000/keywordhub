"""Clean restructure of parser models

Revision ID: 020_clean_restructure_parser
Revises: <previous_revision>
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '020_clean_restructure_parser'
down_revision = 'add_parser_tables'  # Замените на актуальный
branch_labels = None
depends_on = None

def upgrade():
    """Clean upgrade - drops old tables and creates new structure"""

    # Удаляем старые таблицы (если существуют)
    try:
        op.drop_table('doctor_profiles')
    except:
        pass

    try:
        op.drop_table('parsing_tasks')
    except:
        pass

    # Создаем новую структуру ParsingTask
    op.create_table('parsing_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('total_profiles', sa.Integer(), nullable=True),
        sa.Column('processed_profiles', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id')  # ДОБАВЛЕНО: уникальное ограничение
    )

    # Создаем индексы для ParsingTask
    op.create_index('ix_parsing_tasks_id', 'parsing_tasks', ['id'])
    op.create_index('ix_parsing_tasks_task_id', 'parsing_tasks', ['task_id'], unique=True)

    # Создаем новую структуру DoctorProfile
    op.create_table('doctor_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('specialization', sa.String(length=255), nullable=True),
        sa.Column('experience', sa.String(length=100), nullable=True),
        sa.Column('education', sa.Text(), nullable=True),
        sa.Column('workplace', sa.String(length=500), nullable=True),
        sa.Column('rating', sa.String(length=10), nullable=True),
        sa.Column('reviews_count', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('profile_url', sa.String(length=1000), nullable=True),
        sa.Column('parsing_date', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['task_id'], ['parsing_tasks.task_id'])
    )

    # Создаем индексы для DoctorProfile
    op.create_index('ix_doctor_profiles_id', 'doctor_profiles', ['id'])
    op.create_index('ix_doctor_profiles_task_id', 'doctor_profiles', ['task_id'])
    op.create_index('ix_doctor_profiles_name', 'doctor_profiles', ['name'])
    op.create_index('ix_doctor_profiles_specialization', 'doctor_profiles', ['specialization'])
    op.create_index('ix_doctor_profiles_parsing_date', 'doctor_profiles', ['parsing_date'])

    # Составные индексы для оптимизации
    op.create_index('ix_doctor_profiles_task_id_parsing_date', 'doctor_profiles', ['task_id', 'parsing_date'])
    op.create_index('ix_doctor_profiles_name_specialization', 'doctor_profiles', ['name', 'specialization'])

def downgrade():
    """Downgrade to old structure"""

    # Удаляем новые таблицы
    op.drop_table('doctor_profiles')
    op.drop_table('parsing_tasks')

    # Восстанавливаем старую структуру (если нужно)
    print("Downgrade completed. Old structure not restored - please create manually if needed.")
