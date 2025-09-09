import uuid
from typing import Optional, Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .db import get_db
from .models import User, ProjectMember

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    from .security import decode_access_token
    uid = decode_access_token(token)
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    row = await db.execute(select(User).where(User.id == uid))
    user = row.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive or not found")
    return user

async def require_project_role(project_id: uuid.UUID, user: User, db: AsyncSession, roles: Iterable[str]):
    if user.is_superuser:
        return
    q = await db.execute(
        select(ProjectMember.role).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id
        )
    )
    role = q.scalar_one_or_none()
    if not role or role not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")

async def get_async_session():
    async for s in get_db():
        yield s

async def get_project_role(project_id: uuid.UUID, user: User, db: AsyncSession) -> str:
    if user.is_superuser:
        return "admin"
    q = await db.execute(
        select(ProjectMember.role).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user.id
        )
    )
    role = q.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No access to project")
    return role
