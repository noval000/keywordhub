"""Cleanup old schema artifacts

Revision ID: 023_cleanup_old_schema
Revises: <previous_revision>
Create Date: 2025-01-XX XX:XX:XX.XXXXXX

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '023_cleanup_old_schema'
down_revision = '020_clean_restructure_parser'  # Замените на актуальный
branch_labels = None
depends_on = None

def upgrade():
    """Clean up old schema artifacts"""

    # Удаляем старые индексы
    old_indexes = [
        'ix_doctor_profiles_url',
        'ix_doctor_profiles_clinic',
        'ix_doctor_profiles_descriptions',
        'ix_doctor_profiles_specializations',
        'ix_doctor_profiles_is_parsed',
        'ix_doctor_profiles_parsed_at'
    ]

    for index_name in old_indexes:
        try:
            op.execute(f"DROP INDEX IF EXISTS {index_name};")
            print(f"✅ Dropped index: {index_name}")
        except Exception as e:
            print(f"⚠️ Index {index_name} not found: {e}")

    # Удаляем старые колонки если они существуют
    old_columns = [
        'url', 'clinic', 'descriptions', 'specializations',
        'raw_html', 'is_parsed', 'parsed_at', 'error_message'
    ]

    for column_name in old_columns:
        try:
            # Проверяем существование колонки перед удалением
            op.execute(f"""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='doctor_profiles' AND column_name='{column_name}'
                    ) THEN
                        ALTER TABLE doctor_profiles DROP COLUMN {column_name};
                    END IF;
                END $$;
            """)
            print(f"✅ Processed column: {column_name}")
        except Exception as e:
            print(f"⚠️ Error with column {column_name}: {e}")

    # Убеждаемся что новые колонки существуют
    new_columns = [
        ('specialization', 'VARCHAR(255)'),
        ('experience', 'VARCHAR(100)'),
        ('workplace', 'VARCHAR(500)'),
        ('rating', 'VARCHAR(10)'),
        ('reviews_count', 'VARCHAR(50)'),
        ('phone', 'VARCHAR(50)'),
        ('address', 'VARCHAR(500)'),
        ('profile_url', 'VARCHAR(1000)')
    ]

    for column_name, column_type in new_columns:
        try:
            op.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name='doctor_profiles' AND column_name='{column_name}'
                    ) THEN
                        ALTER TABLE doctor_profiles ADD COLUMN {column_name} {column_type};
                    END IF;
                END $$;
            """)
            print(f"✅ Ensured column exists: {column_name}")
        except Exception as e:
            print(f"⚠️ Error adding column {column_name}: {e}")

def downgrade():
    """Downgrade (not implemented for safety)"""
    pass
