from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "KeywordHub"
    CORS_ORIGINS: str = "*"

    # База данных
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "keywordhub"
    POSTGRES_USER: str = "app"
    POSTGRES_PASSWORD: str = "app"

    # ИСПРАВЛЕНО: Убираем f-строки из значений по умолчанию
    DATABASE_URL: str = "postgresql+asyncpg://app:app@db:5432/keywordhub"
    ALEMBIC_DATABASE_URL: str = "postgresql+psycopg2://app:app@db:5432/keywordhub"

    # JWT
    SECRET_KEY: str = "change-me-in-.env-this-is-not-secure"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12  # 12 часов

    # Настройки для парсера врачей
    PARSER_MAX_CONCURRENT_TASKS: int = 5
    PARSER_DEFAULT_DELAY: float = 2.0
    PARSER_MAX_RETRIES: int = 3
    PARSER_REQUEST_TIMEOUT: int = 30

    # Puppeteer настройки
    PUPPETEER_EXECUTABLE_PATH: Optional[str] = "/usr/bin/google-chrome-stable"
    PUPPETEER_HEADLESS: bool = True

    # Новые поля для миграций
    AUTO_MIGRATE: bool = Field(default=True, description="Автоматически применять миграции при запуске")
    FAIL_ON_MIGRATION_ERROR: bool = Field(default=True, description="Останавливать приложение при ошибке миграции")

    # Логирование
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Преобразует строку CORS_ORIGINS в список"""
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # ДОБАВЛЕНО: Property для динамической генерации URL
    @property
    def database_url_computed(self) -> str:
        """Динамически генерируем DATABASE_URL из компонентов"""
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def alembic_database_url_computed(self) -> str:
        """Динамически генерируем ALEMBIC_DATABASE_URL из компонентов"""
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()