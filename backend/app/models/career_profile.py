import uuid

from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class CareerProfile(Base):
    __tablename__ = "career_profiles"

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

    current_role: Mapped[str] = mapped_column(
        String(100),
        default="Student"
    )

    years_of_experience: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    expected_salary: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    dream_role: Mapped[str] = mapped_column(
        String(100),
        default=""
    )

    skills: Mapped[list] = mapped_column(
        JSONB,
        default=list
    )

    certifications: Mapped[list] = mapped_column(
        JSONB,
        default=list
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="career_profile"
    )