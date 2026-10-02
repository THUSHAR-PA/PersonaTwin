"""Add hashed password to users

Revision ID: 67441a5ef7db
Revises: 45758687e8f0
Create Date: 2026-10-02 10:46:20.750618

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision = "67441a5ef7db"
down_revision = "45758687e8f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "hashed_password",
            sa.String(length=255),
            nullable=True,
            server_default=""
        )
    )

    op.alter_column(
        "users",
        "hashed_password",
        nullable=False,
        server_default=None
    )


def downgrade() -> None:
    op.drop_column("users", "hashed_password")
