"""Create the first supported application schema from an empty SQLite DB."""

from alembic import op
import sqlalchemy as sa

revision = "0001_project_audio"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("projects", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("name", sa.String(200), nullable=False),
                    sa.Column("description", sa.String(2000), nullable=False),
                    sa.Column("created_at", sa.String(40), nullable=False))
    op.create_table("assets", sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("project_id", sa.String(36), sa.ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False),
                    sa.Column("kind", sa.String(32), nullable=False),
                    sa.Column("original_name", sa.String(255), nullable=False),
                    sa.Column("storage_key", sa.String(100), unique=True, nullable=False),
                    sa.Column("format", sa.String(16), nullable=False),
                    sa.Column("media_type", sa.String(64), nullable=False),
                    sa.Column("size_bytes", sa.Integer(), nullable=False),
                    sa.Column("sha256", sa.String(64), nullable=False),
                    sa.Column("duration_seconds", sa.Float(), nullable=False),
                    sa.Column("channels", sa.Integer(), nullable=False),
                    sa.Column("sample_rate", sa.Integer(), nullable=False),
                    sa.Column("sample_width_bits", sa.Integer(), nullable=False),
                    sa.Column("created_at", sa.String(40), nullable=False),
                    sa.CheckConstraint("size_bytes > 0 AND duration_seconds > 0"),
                    sa.CheckConstraint("channels IN (1, 2) AND sample_rate > 0"))
    op.create_index("ix_assets_project_id", "assets", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_assets_project_id", table_name="assets")
    op.drop_table("assets")
    op.drop_table("projects")
