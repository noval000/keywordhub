import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user
from ..db import get_db
from ..models import User
from ..schemas import UserCreate, TokenOut
from ..security import hash_password, verify_password, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenOut)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    # если первый пользователь в системе — делаем его суперюзером для удобного бутстрапа
    cnt = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    exists = (await db.execute(select(User).where(User.email == payload.email))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")

    u = User(
        id=uuid.uuid4(),
        email=payload.email.strip().lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        is_active=True,
        is_superuser=(cnt == 0),
    )
    db.add(u)
    await db.commit()
    token = create_access_token(u.id)
    return TokenOut(access_token=token)

@router.post("/login", response_model=TokenOut)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = (await db.execute(select(User).where(User.email == form.username.strip().lower()))).scalar_one_or_none()
    if not user or not user.password_hash or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    token = create_access_token(user.id)
    return TokenOut(access_token=token)

@router.get("/users")
async def list_users(db: AsyncSession = Depends(get_db), current=Depends(get_current_user)):
    # Только для админов и суперпользователей
    if not (getattr(current, "is_superuser", False)):
        raise HTTPException(403, "Only for superusers")
    q = select(User.id, User.email, User.name, User.is_active, User.is_superuser)
    rows = (await db.execute(q)).all()
    return [
        {
            "id": str(r.id),
            "email": r.email,
            "name": r.name,
            "is_active": r.is_active,
            "is_superuser": r.is_superuser,
        }
        for r in rows
    ]
