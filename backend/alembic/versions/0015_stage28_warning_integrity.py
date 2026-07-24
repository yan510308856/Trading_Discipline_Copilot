"""Add explicit classification decisions and warning dismissals.

Revision ID: 0015_stage28_warning_integrity
Revises: 0014_price_action_taxonomy
"""

from alembic import op
import sqlalchemy as sa

revision = "0015_stage28_warning_integrity"
down_revision = "0014_price_action_taxonomy"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.add_column(sa.Column("location_decision", sa.String(length=16), nullable=True))
        batch.add_column(sa.Column("reversal_confirmation", sa.String(length=16), nullable=True))

    op.execute(
        "UPDATE trades SET location_decision = 'selected' "
        "WHERE location_tags IS NOT NULL AND location_tags NOT IN ('[]', 'null', '')"
    )
    op.execute(
        "UPDATE trades SET reversal_confirmation = 'unconfirmed' "
        "WHERE is_unconfirmed_reversal = 1"
    )

    op.create_table(
        "warning_dismissals",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dismissal_key", sa.String(length=192), nullable=False),
        sa.Column("occurrence_key", sa.String(length=192), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=192), nullable=True),
        sa.Column("trade_id", sa.Integer(), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=True),
        sa.Column("rule_id", sa.String(length=128), nullable=True),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("dismissal_key"),
    )
    op.create_index("ix_warning_dismissals_dismissal_key", "warning_dismissals", ["dismissal_key"], unique=True)
    op.create_index("ix_warning_dismissals_trade_id", "warning_dismissals", ["trade_id"])
    op.create_index("ix_warning_dismissals_dismissed_at", "warning_dismissals", ["dismissed_at"])


def downgrade() -> None:
    op.drop_table("warning_dismissals")
    with op.batch_alter_table("trades") as batch:
        batch.drop_column("reversal_confirmation")
        batch.drop_column("location_decision")
