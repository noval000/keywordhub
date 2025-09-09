"""Convert publish_allowed from BOOLEAN to TEXT (nullable)

Revision ID: 2a1b9f1e3c4d
Revises: <put_previous_revision_here>
Create Date: 2025-09-07 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# ----- Настройка ревизии -----
revision = "015_publish_allowed_to_text"
down_revision = "014_content_plan_items_new"
branch_labels = None
depends_on = None

# ----- Имя таблицы (поправь при необходимости) -----
TABLE_NAME = "content_plan_items"  # например: "content_plan_items"

def upgrade() -> None:
    """
    Меняем BOOLEAN -> TEXT.
    TRUE -> 'true', FALSE -> 'false', NULL -> NULL
    """
    op.alter_column(
        TABLE_NAME,
        "publish_allowed",
        type_=sa.Text(),
        existing_type=sa.Boolean(),
        existing_nullable=True,
        postgresql_using=(
            "CASE "
            "WHEN publish_allowed IS TRUE THEN 'true' "
            "WHEN publish_allowed IS FALSE THEN 'false' "
            "ELSE NULL "
            "END"
        ),
    )


def downgrade() -> None:
    """
    Возвращаем TEXT -> BOOLEAN.
    Строки, которые выглядят как true/yes/ok/да/1 -> TRUE,
    false/no/нет/0 -> FALSE, иначе -> NULL.
    """
    op.alter_column(
        TABLE_NAME,
        "publish_allowed",
        type_=sa.Boolean(),
        existing_type=sa.Text(),
        existing_nullable=True,
        postgresql_using=(
            "CASE "
            "WHEN publish_allowed IS NULL THEN NULL "
            "WHEN lower(publish_allowed) IN "
            "  ('true','t','1','yes','y','ok','okay','approved','да','можно','ready') "
            "THEN TRUE "
            "WHEN lower(publish_allowed) IN "
            "  ('false','f','0','no','n','not ok','rejected','нет','нельзя') "
            "THEN FALSE "
            "ELSE NULL "
            "END"
        ),
    )
