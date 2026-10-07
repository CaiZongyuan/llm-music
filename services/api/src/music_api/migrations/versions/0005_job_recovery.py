"""Retain original private Runtime ownership and a non-renewing recovery budget."""
from alembic import op
import sqlalchemy as sa

revision = "0005_job_recovery"
down_revision = "0004_job_cancellation"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("jobs", sa.Column("runtime_proof", sa.JSON(), nullable=True))
    op.add_column("jobs", sa.Column("recovery_cursor", sa.JSON(), nullable=True))

def downgrade() -> None:
    raise RuntimeError("Recovery proofs must be retained; restore a complete supported backup instead")
