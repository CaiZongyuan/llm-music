"""Client request identity and business resource commit atomically."""

from alembic import op
import sqlalchemy as sa

revision = "0010_client_requests"
down_revision = "0009_device_pairing"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("client_requests",
                    sa.Column("request_id", sa.String(36), primary_key=True),
                    sa.Column("operation", sa.String(16), nullable=False),
                    sa.Column("target_project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT")),
                    sa.Column("source_job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT")),
                    sa.Column("input_digest", sa.String(64), nullable=False),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT")),
                    sa.Column("created_at", sa.String(40), nullable=False),
                    sa.CheckConstraint("operation IN ('create_project','generate','retry')", name="ck_request_operation"),
                    sa.CheckConstraint("(operation = 'create_project' AND target_project_id IS NULL AND source_job_id IS NULL AND job_id IS NULL) OR "
                                       "(operation = 'generate' AND target_project_id IS NOT NULL AND target_project_id = project_id AND source_job_id IS NULL AND job_id IS NOT NULL) OR "
                                       "(operation = 'retry' AND target_project_id IS NOT NULL AND target_project_id = project_id AND source_job_id IS NOT NULL AND job_id IS NOT NULL AND source_job_id != job_id)",
                                       name="ck_request_resource"))


def downgrade() -> None:
    raise RuntimeError("Accepted client request identity must be retained; restore a complete supported backup instead")
