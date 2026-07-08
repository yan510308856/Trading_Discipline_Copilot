"""Add execution history and price excursion metrics.

Revision ID: 0006
Revises: 0005
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("mfe_r", sa.Float(), nullable=True))
    op.add_column("trades", sa.Column("mae_r", sa.Float(), nullable=True))
    op.create_table(
        "trade_executions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trade_id", sa.Integer(), nullable=False),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("execution_type", sa.String(length=16), nullable=False),
        sa.Column("price", sa.Float(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=True),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_trade_executions_trade_id"),
        "trade_executions",
        ["trade_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_trade_executions_trade_id"), table_name="trade_executions")
    op.drop_table("trade_executions")
    op.drop_column("trades", "mae_r")
    op.drop_column("trades", "mfe_r")
