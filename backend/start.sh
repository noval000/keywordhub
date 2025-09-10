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

# Сначала подключаемся к postgres для создания БД если нужно
for i in range(30):
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname='postgres')
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{db}'")
        if not cur.fetchone():
            cur.execute(f'CREATE DATABASE "{db}"')
            print(f"✅ База данных {db} создана!")
        else:
            print(f"✅ База данных {db} уже существует!")
        cur.close()
        conn.close()
        break
    except Exception as e:
        print(f"Попытка {i+1}/30: {e}")
        time.sleep(1)
else:
    print("❌ База данных недоступна после 30 попыток")
    raise SystemExit("DB not ready")

# Теперь проверяем подключение к самой БД
for i in range(10):
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname=db)
        conn.close()
        print("✅ Подключение к БД успешно!")
        break
    except Exception as e:
        print(f"Подключение {i+1}/10: {e}")
        time.sleep(1)
PY

# Применяем миграции Alembic
echo "🔄 Применение миграций..."
alembic upgrade head

echo "🎯 Запуск FastAPI сервера..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info