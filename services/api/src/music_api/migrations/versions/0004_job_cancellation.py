"""Retain cancellation intent while native acknowledgement is not terminal proof."""

from alembic import op
import sqlalchemy as sa


revision = "0004_job_cancellation"
down_revision = "0003_generation_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch:
        batch.drop_column("cancel_requested")
