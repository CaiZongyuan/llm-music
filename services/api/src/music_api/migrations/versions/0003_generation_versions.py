"""Keep imported Candidates separate from explicit immutable saved Versions."""

from alembic import op
import sqlalchemy as sa

revision = "0003_generation_versions"
down_revision = "0002_job_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("candidates",
                    sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False, unique=True),
                    sa.Column("audio_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("score_id", sa.String(36), sa.ForeignKey("scores.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("inputs", sa.JSON(), nullable=False),
                    sa.Column("provenance", sa.JSON(), nullable=False),
                    sa.Column("output_snapshot", sa.JSON(), nullable=False),
                    sa.Column("created_at", sa.String(40), nullable=False))
    op.create_index("ix_candidates_project_id", "candidates", ["project_id"])
    op.create_table("versions",
                    sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("candidate_id", sa.String(36), sa.ForeignKey("candidates.id", ondelete="RESTRICT"), nullable=False, unique=True),
                    sa.Column("job_id", sa.String(36), sa.ForeignKey("jobs.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("name", sa.String(200), nullable=False),
                    sa.Column("parent_version_id", sa.String(36), sa.ForeignKey("versions.id", ondelete="RESTRICT"), nullable=True),
                    sa.Column("audio_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("score_id", sa.String(36), sa.ForeignKey("scores.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("inputs", sa.JSON(), nullable=False),
                    sa.Column("provenance", sa.JSON(), nullable=False),
                    sa.Column("output_snapshot", sa.JSON(), nullable=False),
                    sa.Column("created_at", sa.String(40), nullable=False))
    op.create_index("ix_versions_project_id", "versions", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_versions_project_id", table_name="versions")
    op.drop_table("versions")
    op.drop_index("ix_candidates_project_id", table_name="candidates")
    op.drop_table("candidates")
