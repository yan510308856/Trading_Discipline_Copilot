"""Stage 22 alerts, execution reasons, and structured options.

Revision ID: 0010_stage22
Revises: 0009
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_stage22"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.add_column(sa.Column("option_type", sa.String(8), nullable=True))
        batch.add_column(sa.Column("option_expiration", sa.Date(), nullable=True))
        batch.add_column(sa.Column("option_strike", sa.Float(), nullable=True))
    with op.batch_alter_table("trade_executions") as batch:
        batch.add_column(sa.Column("exit_reason", sa.String(32), nullable=True))
    op.create_table(
        "trade_price_alert_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("trade_id", sa.Integer(), sa.ForeignKey("trades.id", ondelete="CASCADE"), nullable=False),
        sa.Column("alert_kind", sa.String(16), nullable=False),
        sa.Column("threshold_price", sa.Float(), nullable=False),
        sa.Column("observed_price", sa.Float(), nullable=False),
        sa.Column("normalized_threshold_price", sa.String(32), nullable=False),
        sa.Column("dedupe_key", sa.String(128), nullable=False, unique=True),
        sa.Column("notification_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_trade_price_alert_events_trade_id", "trade_price_alert_events", ["trade_id"])
    op.create_index("ix_trade_price_alert_events_dedupe_key", "trade_price_alert_events", ["dedupe_key"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_trade_price_alert_events_dedupe_key", table_name="trade_price_alert_events")
    op.drop_index("ix_trade_price_alert_events_trade_id", table_name="trade_price_alert_events")
    op.drop_table("trade_price_alert_events")
    with op.batch_alter_table("trade_executions") as batch:
        batch.drop_column("exit_reason")
    with op.batch_alter_table("trades") as batch:
        batch.drop_column("option_strike")
        batch.drop_column("option_expiration")
        batch.drop_column("option_type")
