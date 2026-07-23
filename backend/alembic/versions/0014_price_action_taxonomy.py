"""Add structured price-action taxonomy.

Revision ID: 0014_price_action_taxonomy
Revises: 0013_workflow_events
"""

from alembic import op
import sqlalchemy as sa

revision = "0014_price_action_taxonomy"
down_revision = "0013_workflow_events"
branch_labels = None
depends_on = None

CONTEXT = {"strong_trend": "strong_trend", "narrow_channel": "narrow_channel", "weak_trend": "broad_channel", "broad_channel": "broad_channel", "trading_range": "trading_range", "breakout_mode": "breakout_mode", "uncertain": "unclear", "opening_range": "unclear", "gap_open": "unclear"}
SETUP = {"breakout": ("breakout", "other"), "pullback": ("pullback_continuation", "other"), "failed_breakout": ("failed_breakout", "other"), "reversal": ("major_reversal", "other"), "left_side_bottom_pick": ("major_reversal", "other"), "early_reversal": ("major_reversal", "other"), "bottom_pick": ("major_reversal", "other"), "h1_h2_l1_l2": ("other", "h1_h2_l1_l2"), "wedge": ("other", "wedge"), "double_top_bottom": ("other", "double_top_bottom"), "inside_bar_triangle": ("other", "inside_bar_triangle"), "opening_range": ("other", "other"), "gap_open": ("other", "other"), "other": ("other", "other")}


def _legacy(setup, context):
    thesis, trigger = SETUP.get(setup, ("other", "other"))
    locations = [tag for tag in ("opening_range", "gap_open") if tag in {setup, context}]
    return {"market_state": CONTEXT.get(context, "unclear"), "trade_thesis": thesis,
            "entry_trigger": trigger, "location_tags": locations,
            "is_unconfirmed_reversal": setup in {"left_side_bottom_pick", "early_reversal", "bottom_pick"}}


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.add_column(sa.Column("market_state", sa.String(32), nullable=True))
        batch.add_column(sa.Column("trade_thesis", sa.String(32), nullable=True))
        batch.add_column(sa.Column("entry_trigger", sa.String(32), nullable=True))
        batch.add_column(sa.Column("location_tags", sa.JSON(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("is_unconfirmed_reversal", sa.Boolean(), nullable=False, server_default=sa.false()))

    connection = op.get_bind()
    trades = sa.table("trades", sa.column("id", sa.Integer()), sa.column("setup", sa.String()), sa.column("market_context", sa.String()),
                      sa.column("market_state", sa.String()), sa.column("trade_thesis", sa.String()), sa.column("entry_trigger", sa.String()),
                      sa.column("location_tags", sa.JSON()), sa.column("is_unconfirmed_reversal", sa.Boolean()))
    for row in connection.execute(sa.select(trades.c.id, trades.c.setup, trades.c.market_context)):
        values = _legacy(row.setup, row.market_context)
        connection.execute(trades.update().where(trades.c.id == row.id).values(**values))


def downgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.drop_column("is_unconfirmed_reversal")
        batch.drop_column("location_tags")
        batch.drop_column("entry_trigger")
        batch.drop_column("trade_thesis")
        batch.drop_column("market_state")
