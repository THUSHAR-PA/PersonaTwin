import uuid

from sqlalchemy import String, Integer, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID

from app.database.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    full_name: Mapped[str] = mapped_column(String(100), nullable=False)

    email: Mapped[str] = mapped_column(
        String(120),
        unique=True,
        nullable=False
    )

    age: Mapped[int] = mapped_column(Integer)

    gender: Mapped[str] = mapped_column(String(20))

    country: Mapped[str] = mapped_column(String(50))

    education: Mapped[str] = mapped_column(String(100))

    university: Mapped[str] = mapped_column(String(150))

    cgpa: Mapped[float] = mapped_column(Float)

    career_goal: Mapped[str] = mapped_column(String(150))

    dream_country: Mapped[str] = mapped_column(String(100))

    risk_tolerance: Mapped[str] = mapped_column(String(20))

    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )