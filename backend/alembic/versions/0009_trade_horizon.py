"""Add trade horizon to trades.

Revision ID: 0009
Revises: 0008
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trades",
        sa.Column(
            "trade_horizon",
            sa.String(length=16),
            nullable=False,
            server_default="intraday",
        ),
    )
    op.create_index("ix_trades_trade_horizon", "trades", ["trade_horizon"])


def downgrade() -> None:
    op.drop_index("ix_trades_trade_horizon", table_name="trades")
    op.drop_column("trades", "trade_horizon")
