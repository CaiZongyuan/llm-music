"""Extend the supported Project/upload schema without changing existing blobs."""

from alembic import op
import sqlalchemy as sa

revision = "0002_job_results"
down_revision = "0001_project_audio"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Initial CHECKs have no names; reflection omits them in a recreating batch.
    with op.batch_alter_table("assets", recreate="always") as batch:
        batch.alter_column("duration_seconds", existing_type=sa.Float(), nullable=True)
        batch.alter_column("channels", existing_type=sa.Integer(), nullable=True)
        batch.alter_column("sample_rate", existing_type=sa.Integer(), nullable=True)
        batch.alter_column("sample_width_bits", existing_type=sa.Integer(), nullable=True)
        batch.create_check_constraint("ck_asset_file_size", "size_bytes > 0")
        batch.create_check_constraint("ck_asset_audio_facts", "kind NOT IN ('reference_audio','generated_audio') OR (duration_seconds IS NOT NULL AND duration_seconds > 0 AND channels IS NOT NULL AND channels IN (1,2) AND sample_rate IS NOT NULL AND sample_rate > 0)")
        batch.create_check_constraint("ck_reference_width", "kind != 'reference_audio' OR sample_width_bits IN (8,16,24,32) AND sample_width_bits IS NOT NULL")
    op.create_table("application_namespace", sa.Column("id", sa.Integer(), primary_key=True),
                    sa.Column("runtime_mode", sa.String(16), nullable=False))
    op.create_table("jobs", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("operation", sa.String(32), nullable=False), sa.Column("inputs", sa.JSON(), nullable=False),
                    sa.Column("provenance", sa.JSON(), nullable=False), sa.Column("runtime_mode", sa.String(16), nullable=False),
                    sa.Column("attempt_id", sa.String(36), unique=True, nullable=False), sa.Column("runtime_handle", sa.String(200)),
                    sa.Column("submission_state", sa.String(32), nullable=False), sa.Column("status", sa.String(16), nullable=False),
                    sa.Column("phase", sa.String(32)), sa.Column("progress", sa.Float()), sa.Column("error", sa.JSON()),
                    sa.Column("result_refs", sa.JSON()), sa.Column("created_at", sa.String(40), nullable=False), sa.Column("updated_at", sa.String(40), nullable=False),
                    sa.CheckConstraint("status IN ('queued','running','completed','failed','cancelled')"),
                    sa.CheckConstraint("operation IN ('Transcribe','Generate')"), sa.CheckConstraint("progress IS NULL OR (progress >= 0 AND progress <= 1)"),
                    sa.CheckConstraint("status != 'completed' OR result_refs IS NOT NULL"))
    op.create_index("ix_jobs_project_id", "jobs", ["project_id"])
    op.create_table("scores", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT"), unique=True, nullable=False),
                    sa.Column("abc_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("source_reference_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT")),
                    sa.Column("created_at", sa.String(40), nullable=False))
    op.create_index("ix_scores_project_id", "scores", ["project_id"])
    op.create_table("job_results", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("role", sa.String(16), nullable=False), sa.UniqueConstraint("job_id", "role"))
    op.create_index("ix_job_results_job_id", "job_results", ["job_id"])


def downgrade() -> None:
    raise RuntimeError("Downgrade would discard generated results; restore a complete supported backup instead")
