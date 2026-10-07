"""Retain cancellation intent while native acknowledgement is not terminal proof."""

from alembic import op
import sqlalchemy as sa


revision = "0004_job_cancellation"
down_revision = "0003_generation_versions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("cancel_requested", sa.Boolean(), nullable=False, server_default=sa.false()))
    jobs = sa.table("jobs", sa.column("submission_state", sa.String()), sa.column("status", sa.String()),
                    sa.column("error", sa.JSON(none_as_null=True)))
    legacy = sa.and_(jobs.c.submission_state == "pending", jobs.c.status != "completed")
    # Pre-0004 submit wrote no dispatch-start marker. Its pending rows can include
    # accepted work after a crash or unexpected acknowledgement failure.
    op.get_bind().execute(sa.update(jobs).where(legacy, jobs.c.error.is_(None)).values(error={
        "code": "runtime_unavailable", "message": "Legacy pending work has no durable dispatch-start evidence.",
        "recovery": "Confirm the original Runtime attempt before cancellation or retry; this upgrade never resubmits it."}))
    op.get_bind().execute(sa.update(jobs).where(legacy).values(submission_state="unconfirmed"))


def downgrade() -> None:
    with op.batch_alter_table("jobs") as batch:
        batch.drop_column("cancel_requested")
