"""Persist owned conversations and immutable comparison messages."""

from alembic import op
import sqlalchemy as sa

revision = "20261010_chat"
down_revision = "20261005_decisions"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_conversations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("plan", sa.JSON(), nullable=False),
        sa.Column("messages", sa.JSON(), nullable=False),
    )
    op.create_index("ix_chat_conversations_user_id", "chat_conversations", ["user_id"])


def downgrade():
    op.drop_table("chat_conversations")
