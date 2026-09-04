from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError
from sqlalchemy.orm import Session

from app.models.user import User

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

ALGORITHM = "HS256"


def get_secret_key() -> str:
    key = os.getenv("SECRET_KEY")
    if not key:
        raise RuntimeError(
            "SECRET_KEY environment variable is not set."
        )
    return key


def get_token_expiry_minutes() -> int:
    return int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    if not hashed_password:
        return False

    try:
        return pwd_context.verify(
            plain_password,
            hashed_password,
        )
    except (ValueError, UnknownHashError):
        return False


def create_access_token(
    user_id: UUID,
) -> str:
    expire = (
        datetime.now(timezone.utc)
        + timedelta(
            minutes=get_token_expiry_minutes()
        )
    )

    payload = {
        "sub": str(user_id),
        "exp": expire,
    }

    return jwt.encode(
        payload,
        get_secret_key(),
        algorithm=ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> UUID:
    try:
        payload = jwt.decode(
            token,
            get_secret_key(),
            algorithms=[ALGORITHM],
        )
    except JWTError:
        raise ValueError("Invalid or expired token.")

    subject = payload.get("sub")
    if subject is None:
        raise ValueError("Token missing subject.")

    try:
        return UUID(subject)
    except (ValueError, TypeError, AttributeError):
        raise ValueError("Invalid token subject.")


def authenticate_user(
    db: Session,
    email: str,
    password: str,
) -> User | None:
    user = (
        db.query(User)
        .filter(User.email == email)
        .first()
    )

    if user is None:
        return None

    if not verify_password(
        password,
        user.hashed_password,
    ):
        return None

    return user
