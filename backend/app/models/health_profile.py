import uuid

from sqlalchemy import Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class HealthProfile(Base):
    __tablename__ = "health_profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        unique=True,
        nullable=False
    )

    height: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    weight: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    sleep_hours: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    exercise_days: Mapped[int] = mapped_column(
        Integer,
        default=0
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="health_profile"
    )