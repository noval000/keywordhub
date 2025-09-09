# My App

## Описание проекта
[позже опишу]

## Технологии
- Backend: FastAPI + PostgreSQL + Alembic
- Frontend: Next.js + TypeScript React + Tailwind CSS

## Установка и запуск

### Backend
1. Перейдите в папку backend: `cd backend`
2. Создайте виртуальное окружение: `python -m venv venv`
3. Активируйте его: `source venv/bin/activate` (Linux/Mac) или `venv\Scripts\activate` (Windows)
4. Установите зависимости: `pip install -r requirements.txt`
5. Скопируйте .env.example в .env и заполните переменные
6. Запустите миграции: `alembic upgrade head`
7. Запустите сервер: `python app/main.py`

### Frontend
1. Перейдите в папку frontend: `cd frontend`
2. Установите зависимости: `npm install`
3. Скопируйте .env.local.example в .env.local и заполните переменные
4. Запустите сервер: `npm run dev`

## Структура проекта
- `backend/` - FastAPI приложение
- `frontend/` - Next.js приложение