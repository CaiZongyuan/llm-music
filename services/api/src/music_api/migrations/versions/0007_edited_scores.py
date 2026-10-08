"""Allow explicitly saved edits without fabricating an inference Job."""

from alembic import op
import sqlalchemy as sa

revision = "0007_edited_scores"
down_revision = "0006_generate_from_score"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("scores", recreate="always") as batch:
        batch.alter_column("job_id", existing_type=sa.String(36), nullable=True)
        batch.add_column(sa.Column("source_score_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("parent_version_id", sa.String(36), nullable=True))
        batch.create_foreign_key("fk_score_source", "scores", ["source_score_id"], ["id"], ondelete="RESTRICT")
        batch.create_foreign_key("fk_score_parent", "versions", ["parent_version_id"], ["id"], ondelete="RESTRICT")


def downgrade() -> None:
    raise RuntimeError("Edited Scores and their lineage must be retained; restore a complete supported backup instead")
