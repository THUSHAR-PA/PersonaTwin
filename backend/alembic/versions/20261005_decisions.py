"""Store historical twin states, reproducible decisions and feedback."""
from alembic import op
import sqlalchemy as sa

revision = "20261005_decisions"
down_revision = "20261003_wallet_snapshot"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "twin_states",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
    )
    op.create_index("ix_twin_states_user_id", "twin_states", ["user_id"])
    op.create_table(
        "decision_runs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("state_id", sa.Uuid(), sa.ForeignKey("twin_states.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scenario", sa.String(40), nullable=False),
        sa.Column("request", sa.JSON(), nullable=False),
        sa.Column("result", sa.JSON(), nullable=False),
    )
    op.create_index("ix_decision_runs_user_id", "decision_runs", ["user_id"])
    op.create_index("ix_decision_runs_state_id", "decision_runs", ["state_id"])
    op.create_table(
        "decision_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("run_id", sa.Uuid(), sa.ForeignKey("decision_runs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
    )
    op.create_index("ix_decision_events_run_id", "decision_events", ["run_id"])


def downgrade():
    op.drop_table("decision_events")
    op.drop_table("decision_runs")
    op.drop_table("twin_states")
