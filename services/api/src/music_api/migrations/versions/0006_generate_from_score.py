"""Extend operation checks while retaining every existing Job and its children."""

from alembic import op
import sqlalchemy as sa

revision = "0006_generate_from_score"
down_revision = "0005_job_recovery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SQLite omits unnamed reflected checks during recreation. Restate every
    # shipped invariant, widening only the operation set.
    constraints = (
        sa.CheckConstraint("status IN ('queued','running','completed','failed','cancelled')", name="ck_job_status"),
        sa.CheckConstraint("operation IN ('Transcribe','Generate','GenerateFromScore')", name="ck_job_operation"),
        sa.CheckConstraint("progress IS NULL OR (progress >= 0 AND progress <= 1)", name="ck_job_progress"),
        sa.CheckConstraint("status != 'completed' OR result_refs IS NOT NULL", name="ck_job_completed_result"),
    )
    with op.batch_alter_table("jobs", recreate="always", table_args=constraints):
        pass


def downgrade() -> None:
    raise RuntimeError("Score generation provenance must be retained; restore a complete supported backup instead")
