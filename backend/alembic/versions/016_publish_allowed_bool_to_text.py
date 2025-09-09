"""Safely convert content_plan_items.publish_allowed BOOLEAN <-> TEXT (no nested $$)

Revision ID: 018_safe_publish_allowed_bool_to_text_fix
Revises: <put_previous_revision_here>
Create Date: 2025-09-07 00:00:00
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "016_publish_allowed_bool_to_text"
down_revision = "015_publish_allowed_to_text"
branch_labels = None
depends_on = None

TABLE = "content_plan_items"
COLUMN = "publish_allowed"


def upgrade() -> None:
    op.execute(f"""
DO $do$
DECLARE
    v_type text;
    sql    text;
BEGIN
    SELECT data_type
      INTO v_type
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name   = '{TABLE}'
       AND column_name  = '{COLUMN}'
     LIMIT 1;

    IF v_type IS NULL THEN
        RAISE NOTICE 'Table/column %.% not found in schema %', '{TABLE}', '{COLUMN}', current_schema();
        RETURN;
    END IF;

    IF lower(v_type) = 'boolean' THEN
        -- Собираем динамический SQL без format()/вложенных $$
        sql :=
            'ALTER TABLE ' || quote_ident('{TABLE}') ||
            ' ALTER COLUMN ' || quote_ident('{COLUMN}') || ' TYPE TEXT ' ||
            ' USING CASE ' ||
            '   WHEN ' || quote_ident('{COLUMN}') || ' IS TRUE  THEN ''true'' ' ||
            '   WHEN ' || quote_ident('{COLUMN}') || ' IS FALSE THEN ''false'' ' ||
            '   ELSE NULL END';

        EXECUTE sql;
        RAISE NOTICE 'Upgraded %.% from BOOLEAN to TEXT', '{TABLE}', '{COLUMN}';
    ELSE
        RAISE NOTICE 'Skip upgrade: %.% is already %', '{TABLE}', '{COLUMN}', v_type;
    END IF;
END
$do$;
    """)


def downgrade() -> None:
    op.execute(f"""
DO $do$
DECLARE
    v_type text;
    sql    text;
BEGIN
    SELECT data_type
      INTO v_type
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name   = '{TABLE}'
       AND column_name  = '{COLUMN}'
     LIMIT 1;

    IF v_type IS NULL THEN
        RAISE NOTICE 'Table/column %.% not found in schema %', '{TABLE}', '{COLUMN}', current_schema();
        RETURN;
    END IF;

    IF lower(v_type) IN ('text', 'character varying', 'varchar') THEN
        sql :=
            'ALTER TABLE ' || quote_ident('{TABLE}') ||
            ' ALTER COLUMN ' || quote_ident('{COLUMN}') || ' TYPE BOOLEAN ' ||
            ' USING CASE ' ||
            '   WHEN ' || quote_ident('{COLUMN}') || ' IS NULL THEN NULL ' ||
            "   WHEN lower(" || quote_ident('{COLUMN}') || ") IN ('true','t','1','yes','y','ok','okay','approved','да','можно','ready') THEN TRUE " ||
            "   WHEN lower(" || quote_ident('{COLUMN}') || ") IN ('false','f','0','no','n','not ok','rejected','нет','нельзя') THEN FALSE " ||
            '   ELSE NULL END';

        EXECUTE sql;
        RAISE NOTICE 'Downgraded %.% from TEXT to BOOLEAN', '{TABLE}', '{COLUMN}';
    ELSE
        RAISE NOTICE 'Skip downgrade: %.% is % (not TEXT)', '{TABLE}', '{COLUMN}', v_type;
    END IF;
END
$do$;
    """)
