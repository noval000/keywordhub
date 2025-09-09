FROM python:3.11-slim

WORKDIR /app

# Системные зависимости для основного приложения и Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    wget \
    gnupg \
    ca-certificates \
    procps \
    # PostgreSQL клиент
    postgresql-client \
    # Зависимости для Chromium
    libxss1 \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxkbcommon0 \
    libgtk-3-0 \
    libnss3 \
    libxcursor1 \
    libxi6 \
    libxfixes3 \
    libatspi2.0-0 \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Google Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y --no-install-recommends google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Python зависимости
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Создаем скрипт для инициализации Chromium
RUN echo 'import asyncio\n\
import os\n\
import sys\n\
\n\
async def init_chromium():\n\
    try:\n\
        os.environ["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/google-chrome-stable"\n\
        from pyppeteer import launch\n\
        \n\
        browser = await launch({\n\
            "headless": True,\n\
            "executablePath": "/usr/bin/google-chrome-stable",\n\
            "args": [\n\
                "--no-sandbox",\n\
                "--disable-setuid-sandbox",\n\
                "--disable-dev-shm-usage",\n\
                "--disable-gpu"\n\
            ]\n\
        })\n\
        await browser.close()\n\
        print("✅ Chromium предварительно инициализирован")\n\
        \n\
    except Exception as e:\n\
        print(f"⚠️ Предупреждение: {e}")\n\
        print("Chromium будет загружен при первом использовании")\n\
\n\
asyncio.run(init_chromium())' > /tmp/init_chromium.py

# Запускаем инициализацию Chromium
RUN python /tmp/init_chromium.py || echo "⚠️ Chromium будет инициализирован при запуске"

# Удаляем временный скрипт
RUN rm /tmp/init_chromium.py

# Копируем файлы проекта
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY app /app/app
COPY start.sh /app/start.sh

# Переменные окружения
ENV PYTHONUNBUFFERED=1
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Делаем скрипт запуска исполняемым
RUN chmod +x /app/start.sh

EXPOSE 8000

CMD ["./start.sh"]
