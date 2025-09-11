# backend/app/models.py
from __future__ import annotations

import uuid
from datetime import datetime, date
from typing import Optional, List

from sqlalchemy import (
    func,
    UniqueConstraint,
    String,
    ForeignKey,
    Text,
    Boolean,
    TIMESTAMP,
    text,
    Integer,
    Column,
    Date,
    DateTime,
    JSON,
    Index
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB, UUID, ARRAY
from .db import Base


def uid() -> uuid.UUID:
    return uuid.uuid4()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    email: Mapped[str]
    name: Mapped[Optional[str]] = mapped_column(default=None)
    password_hash: Mapped[Optional[str]] = mapped_column(default=None)
    is_active: Mapped[bool] = mapped_column(default=True)
    is_superuser: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    can_view_all_content: Mapped[bool] = mapped_column(Boolean, default=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    archived_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)


class ProjectMember(Base):
    __tablename__ = "project_members"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    role: Mapped[str]  # 'viewer' | 'editor' | 'admin'


class Direction(Base):
    __tablename__ = "directions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )
    name: Mapped[str]

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_direction_project_name"),
    )


class Cluster(Base):
    __tablename__ = "clusters"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )
    name: Mapped[str]

    __table_args__ = (
        UniqueConstraint("project_id", "name", name="uq_cluster_project_name"),
    )


class Query(Base):
    __tablename__ = "queries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
    )
    direction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("directions.id"),
        default=None,
    )
    cluster_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clusters.id"),
        default=None,
    )

    phrase: Mapped[str]
    page: Mapped[Optional[str]] = mapped_column(default=None)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String()), default=list)
    page_type: Mapped[Optional[str]] = mapped_column(default=None)
    query_type: Mapped[Optional[str]] = mapped_column(default=None)
    ws_flag: Mapped[int] = mapped_column(default=0)

    # дата публикации страницы (храним как DATE, без времени и TZ)
    dt: Mapped[Optional[date]] = mapped_column(default=None)

    version: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), default=None)
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), default=None)
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("project_id", "direction_id", "phrase", name="uq_phrase_in_direction"),
    )

class ClusterRegistry(Base):
    __tablename__ = "cluster_registry"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uid)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )

    # Ключевые поля
    name: Mapped[str] = mapped_column(String(255), nullable=False)              # Кластер
    direction: Mapped[str | None] = mapped_column(String(255), nullable=True)   # Направление (по названию)
    page_type: Mapped[str | None] = mapped_column(String(120), nullable=True)   # Тип страницы

    # Статусы/метрики
    has_core: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))   # Ядро
    has_brief: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))  # ТЗ
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false")) # Размещено
    demand: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))          # Спрос (WS)

    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    __table_args__ = (UniqueConstraint("project_id", "name", name="uq_cluster_registry_project_name"),)

#  Контент-план: project_id необязателен
class ContentPlanItem(Base):
    __tablename__ = "content_plan_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    project_id = Column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
    )

    period = Column(String(32))
    section = Column(String(255))
    direction = Column(String(255))
    topic = Column(Text)
    tz = Column(Text)
    chars = Column(Integer)
    status = Column(String(48))
    author = Column(String(255))

    # На проверке у врача — ссылка (текст)
    review = Column(String(255))

    meta_seo = Column(Text)

    # Флаг «у врача» (оставляем)
    doctor_review = Column(Boolean)

    # publish_allowed — УДАЛЕНО из модели и из БД

    # НОВЫЕ ПОЛЯ:
    reviewing_doctor = Column(String(255))  # Имя проверяющего врача
    doctor_approved = Column(Boolean)       # Проверено врачом

    comment = Column(Text)
    link = Column(String(1024))
    publish_date = Column(Date)

    version = Column(Integer, nullable=False, default=1)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    technical_specification = relationship(
        "TechnicalSpecification",
        back_populates="content_plan_item",
        uselist=False  # Один к одному
    )


class PageAccess(Base):
    __tablename__ = "page_access"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    page: Mapped[str] = mapped_column(String(50), primary_key=True)

    __table_args__ = (
        UniqueConstraint("user_id", "page", name="uq_pageaccess_user_page"),
    )

class PageRole(Base):
    __tablename__ = "page_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    page = Column(String(50), nullable=False)  # "clusters" или "content_plan"
    role = Column(String(20), nullable=False, default="viewer")  # "viewer" или "editor"
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)  # Опционально для страниц проекта
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "page", "project_id", name="uq_user_page_project"),
    )



# парсинг врачей
class ParsingTask(Base):
    __tablename__ = "parsing_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(UUID(as_uuid=True), unique=True, index=True, default=uuid.uuid4)  # Изменено на UUID
    status = Column(String(50), default="pending")
    total_profiles = Column(Integer, default=0)
    processed_profiles = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)  # Изменено на DateTime
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    # Связь с профилями врачей
    doctor_profiles = relationship("DoctorProfile", back_populates="parsing_task")

class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(UUID(as_uuid=True), ForeignKey("parsing_tasks.task_id"), nullable=False, index=True)  # ДОБАВЛЕНО
    name = Column(String(255), nullable=False)
    specialization = Column(String(255))
    experience = Column(String(100))
    education = Column(Text)
    workplace = Column(String(500))
    rating = Column(String(10))
    reviews_count = Column(String(50))
    phone = Column(String(50))
    address = Column(String(500))
    profile_url = Column(String(1000))
    parsing_date = Column(DateTime, default=datetime.utcnow)  # Изменено на DateTime

    # Связь с задачей парсинга
    parsing_task = relationship("ParsingTask", back_populates="doctor_profiles")

    # Индексы для оптимизации
    __table_args__ = (
        Index('ix_doctor_profiles_task_id_parsing_date', 'task_id', 'parsing_date'),
        Index('ix_doctor_profiles_name_specialization', 'name', 'specialization'),
    )


class TechnicalSpecification(Base):
    __tablename__ = "technical_specifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    content_plan_id = Column(
        UUID(as_uuid=True),
        ForeignKey("content_plan_items.id", ondelete="CASCADE"),
        nullable=False,
        unique=True  # Одно ТЗ на одну запись КП
    )

    title = Column(String(500), nullable=False)
    author = Column(String(255))

    # JSON поля для гибкости
    blocks = Column(JSON, nullable=False, default=list)  # Массив блоков
    keywords = Column(JSON, nullable=False, default=list)  # Ключевые фразы
    lsi_phrases = Column(JSON, nullable=False, default=list)  # LSI фразы
    competitors = Column(JSON, nullable=False, default=list)  # Конкуренты

    # Простые поля
    count = Column(Integer)  # Количество символов
    usage_form = Column(Text)  # В какой форме использовать

    # Системные поля
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Добавить relationship
    content_plan_item = relationship(
        "ContentPlanItem",
        back_populates="technical_specification"
    )