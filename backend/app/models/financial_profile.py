import uuid

from sqlalchemy import Float, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class FinancialProfile(Base):
    __tablename__ = "financial_profiles"

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

    monthly_income: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    monthly_expense: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    current_savings: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    investments: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    debts: Mapped[float] = mapped_column(
        Float,
        default=0
    )

    user: Mapped["User"] = relationship(
        "User",
        back_populates="financial_profile"
    )