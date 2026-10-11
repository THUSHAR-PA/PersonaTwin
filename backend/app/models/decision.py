from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import Base


class TwinState(Base):
    __tablename__ = "twin_states"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    source: Mapped[str] = mapped_column(String(40))
    data: Mapped[dict] = mapped_column(JSON)
    user = relationship("User", back_populates="twin_states")
    decisions = relationship("DecisionRun", cascade="all, delete-orphan", back_populates="state")


class DecisionRun(Base):
    __tablename__ = "decision_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    state_id: Mapped[UUID] = mapped_column(ForeignKey("twin_states.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    scenario: Mapped[str] = mapped_column(String(40))
    request: Mapped[dict] = mapped_column(JSON)
    result: Mapped[dict] = mapped_column(JSON)
    state = relationship("TwinState", back_populates="decisions")
    events = relationship("DecisionEvent", cascade="all, delete-orphan", back_populates="run")


class DecisionEvent(Base):
    __tablename__ = "decision_events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    run_id: Mapped[UUID] = mapped_column(ForeignKey("decision_runs.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    kind: Mapped[str] = mapped_column(String(20))
    data: Mapped[dict] = mapped_column(JSON)
    run = relationship("DecisionRun", back_populates="events")
