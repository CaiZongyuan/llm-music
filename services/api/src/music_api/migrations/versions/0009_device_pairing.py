"""Retain a stable server identity and device pairing state."""

from alembic import op
import sqlalchemy as sa

revision = "0009_device_pairing"
down_revision = "0008_cover_sources"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("server_identity",
                    sa.Column("singleton", sa.Integer(), primary_key=True),
                    sa.Column("server_id", sa.String(36), nullable=False, unique=True),
                    sa.CheckConstraint("singleton = 1", name="ck_server_identity_singleton"))
    op.create_table("devices",
                    sa.Column("id", sa.String(36), primary_key=True),
                    sa.Column("name", sa.String(200), nullable=False),
                    sa.Column("token_digest", sa.String(64), nullable=False, unique=True),
                    sa.Column("created_at", sa.Float(), nullable=False),
                    sa.Column("revoked_at", sa.Float(), nullable=True))
    op.create_table("pairing_challenges",
                    sa.Column("sequence", sa.Integer(), primary_key=True, autoincrement=True),
                    sa.Column("id", sa.String(36), nullable=False, unique=True),
                    sa.Column("code_digest", sa.String(64), nullable=False),
                    sa.Column("created_at", sa.Float(), nullable=False),
                    sa.Column("expires_at", sa.Float(), nullable=False),
                    sa.Column("attempts", sa.Integer(), nullable=False),
                    sa.Column("status", sa.String(16), nullable=False),
                    sa.Column("claimed_device_id", sa.String(36), sa.ForeignKey("devices.id", ondelete="RESTRICT")),
                    sa.CheckConstraint("attempts >= 0 AND attempts <= 5", name="ck_pairing_attempts"),
                    sa.CheckConstraint("status IN ('active','closed','consumed','locked')", name="ck_pairing_status"))
    op.create_index("uq_pairing_active", "pairing_challenges", ["status"], unique=True,
                    sqlite_where=sa.text("status = 'active'"))


def downgrade() -> None:
    raise RuntimeError("Device authorization must be retained; restore a complete supported backup instead")
