#!/usr/bin/env bash
set -e

echo "🚀 Запуск KeywordHub API..."

# Ждем БД
echo "⏳ Проверка готовности базы данных..."
python - <<'PY'
import os, time, psycopg2
host=os.getenv("POSTGRES_HOST","db")
port=int(os.getenv("POSTGRES_PORT","5432"))
user=os.getenv("POSTGRES_USER","app")
pwd=os.getenv("POSTGRES_PASSWORD","app")
db=os.getenv("POSTGRES_DB","keywordhub")
print(f"Подключение к {host}:{port} как {user} к БД {db}")
for i in range(30):
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
        conn.close()
        print("✅ База данных готова!")
        break
    except Exception as e:
        print(f"Попытка {i+1}/30: {e}")
        time.sleep(1)
else:
    print("❌ База данных недоступна после 30 попыток")
    raise SystemExit("DB not ready")
PY

# ИСПРАВЛЕНО: Очистка старых артефактов перед миграциями
echo "🧹 Очистка старых артефактов схемы..."
python - <<'PY'
import psycopg2
import os

try:
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST","db"),
        port=int(os.getenv("POSTGRES_PORT","5432")),
        user=os.getenv("POSTGRES_USER","app"),
        password=os.getenv("POSTGRES_PASSWORD","app"),
        dbname=os.getenv("POSTGRES_DB","keywordhub")
    )

    cur = conn.cursor()

    print("🗑️ Удаление старых индексов...")

    # Удаляем все старые проблемные индексы
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
            cur.execute(f'DROP INDEX IF EXISTS {index_name} CASCADE')
            print(f"✅ Dropped: {index_name}")
        except Exception as e:
            print(f"⚠️ {index_name}: {e}")

    print("📋 Обновление схемы таблиц...")

    # Проверяем существование таблиц и приводим к базовому состоянию
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'parsing_tasks'
        )
    """)

    if cur.fetchone()[0]:
        print("📝 Обновление parsing_tasks...")
        # Добавляем новые колонки к существующей таблице
        cur.execute("""
            DO $$
            BEGIN
                -- Добавляем task_id если его нет
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_name='parsing_tasks' AND column_name='task_id') THEN
                    ALTER TABLE parsing_tasks ADD COLUMN task_id UUID DEFAULT gen_random_uuid();
                    ALTER TABLE parsing_tasks ADD CONSTRAINT uq_parsing_tasks_task_id UNIQUE (task_id);
                END IF;

                -- Переименовываем старые колонки
                IF EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='parsing_tasks' AND column_name='urls_count') THEN
                    ALTER TABLE parsing_tasks RENAME COLUMN urls_count TO total_profiles;
                END IF;

                IF EXISTS (SELECT 1 FROM information_schema.columns
                          WHERE table_name='parsing_tasks' AND column_name='completed_count') THEN
                    ALTER TABLE parsing_tasks RENAME COLUMN completed_count TO processed_profiles;
                END IF;
            END $$;
        """)
    else:
        print("➕ Создание parsing_tasks...")
        # Создаем с новой структурой
        cur.execute('''
            CREATE TABLE parsing_tasks (
                id SERIAL PRIMARY KEY,
                task_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
                status VARCHAR(50) DEFAULT 'pending',
                total_profiles INTEGER DEFAULT 0,
                processed_profiles INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP NULL,
                error_message TEXT NULL
            );
        ''')

    # Аналогично для doctor_profiles
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = 'doctor_profiles'
        )
    """)

    if cur.fetchone()[0]:
        print("📝 Обновление doctor_profiles...")
        # Удаляем старые колонки и добавляем новые
        cur.execute("""
            DO $$
            BEGIN
                -- Удаляем старые колонки
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS url CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS clinic CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS descriptions CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS specializations CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS raw_html CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS is_parsed CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS parsed_at CASCADE;
                ALTER TABLE doctor_profiles DROP COLUMN IF EXISTS error_message CASCADE;

                -- Добавляем task_id если его нет
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                              WHERE table_name='doctor_profiles' AND column_name='task_id') THEN
                    ALTER TABLE doctor_profiles ADD COLUMN task_id UUID;
                END IF;

                -- Добавляем новые колонки
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS specialization VARCHAR(255);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS experience VARCHAR(100);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS education TEXT;
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS workplace VARCHAR(500);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS rating VARCHAR(10);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS reviews_count VARCHAR(50);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS address VARCHAR(500);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS profile_url VARCHAR(1000);
                ALTER TABLE doctor_profiles ADD COLUMN IF NOT EXISTS parsing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            END $$;
        """)
    else:
        print("➕ Создание doctor_profiles...")
        # Создаем с новой структурой
        cur.execute('''
            CREATE TABLE doctor_profiles (
                id SERIAL PRIMARY KEY,
                task_id UUID REFERENCES parsing_tasks(task_id),
                name VARCHAR(255) NOT NULL DEFAULT '',
                specialization VARCHAR(255),
                experience VARCHAR(100),
                education TEXT,
                workplace VARCHAR(500),
                rating VARCHAR(10),
                reviews_count VARCHAR(50),
                phone VARCHAR(50),
                address VARCHAR(500),
                profile_url VARCHAR(1000),
                parsing_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

    # Создаем только правильные индексы
    print("📇 Создание новых индексов...")
    new_indexes = [
        'CREATE INDEX IF NOT EXISTS ix_parsing_tasks_id ON parsing_tasks (id)',
        'CREATE INDEX IF NOT EXISTS ix_parsing_tasks_task_id ON parsing_tasks (task_id)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_id ON doctor_profiles (id)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_task_id ON doctor_profiles (task_id)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_name ON doctor_profiles (name)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_specialization ON doctor_profiles (specialization)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_parsing_date ON doctor_profiles (parsing_date)',
        'CREATE INDEX IF NOT EXISTS ix_doctor_profiles_profile_url ON doctor_profiles (profile_url)'
    ]

    for index_sql in new_indexes:
        try:
            cur.execute(index_sql)
        except Exception as e:
            print(f"⚠️ Index error: {e}")

    conn.commit()
    cur.close()
    conn.close()

    print("✅ Схема базы данных подготовлена")

except Exception as e:
    print(f"⚠️ Ошибка подготовки схемы: {e}")
PY

# Проверяем готовность Chromium для парсера
echo "🌐 Проверка готовности Chromium..."
python - <<'PY'
import os

# Проверяем наличие Chrome
chrome_paths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
]

chrome_found = False
for path in chrome_paths:
    if os.path.exists(path):
        print(f"✅ Chrome найден: {path}")
        os.environ['PUPPETEER_EXECUTABLE_PATH'] = path
        chrome_found = True
        break

if not chrome_found:
    print("⚠️ Chrome не найден, парсер может не работать")
else:
    print("✅ Chromium готов для парсинга")
PY

# Применяем миграции Alembic ПОСЛЕ подготовки схемы
echo "🔄 Применение миграций..."
alembic upgrade head || echo "⚠️ Миграции выполнены с предупреждениями"

echo "🎯 Запуск FastAPI сервера..."

# Запуск API
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info