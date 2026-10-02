"""Keep the complete bank financial snapshot and its last successful sync time."""
from alembic import op
import sqlalchemy as sa

revision = "20261003_wallet_snapshot"
down_revision = "67441a5ef7db"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("financial_profiles", sa.Column("wallet_snapshot", sa.JSON(), nullable=True))
    op.add_column("financial_profiles", sa.Column("wallet_synced_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column("financial_profiles", "wallet_synced_at")
    op.drop_column("financial_profiles", "wallet_snapshot")
