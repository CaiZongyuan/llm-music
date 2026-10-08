"""Retain Version-derived Reference origins and widen the shared Job operation."""

from alembic import op
import sqlalchemy as sa

revision = "0008_cover_sources"
down_revision = "0007_edited_scores"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("jobs", recreate="always") as batch:
        batch.drop_constraint("ck_job_operation", type_="check")
        batch.create_check_constraint("ck_job_operation", "operation IN ('Transcribe','Generate','GenerateFromScore','Cover')")
    op.create_table("reference_origins",
                    sa.Column("reference_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), primary_key=True),
                    sa.Column("source_version_id", sa.String(36), sa.ForeignKey("versions.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("source_asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("source_sha256", sa.String(64), nullable=False),
                    sa.Column("start_frame", sa.Integer(), nullable=False), sa.Column("frame_count", sa.Integer(), nullable=False),
                    sa.Column("sample_rate", sa.Integer(), nullable=False), sa.Column("derivation_version", sa.String(32), nullable=False),
                    sa.CheckConstraint("start_frame = 0 AND frame_count = 768000 AND sample_rate = 48000", name="ck_reference_origin_profile"))


def downgrade() -> None:
    raise RuntimeError("Cover sources must be retained; restore a complete supported backup instead")
