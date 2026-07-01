"""Create initial trade discipline tables.

Revision ID: 0001
Revises: None
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "trades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("symbol", sa.String(length=32), nullable=False),
        sa.Column("market", sa.String(length=32), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("setup", sa.String(length=64), nullable=False),
        sa.Column("market_context", sa.String(length=64), nullable=False),
        sa.Column("planned_entry", sa.Float(), nullable=False),
        sa.Column("actual_entry", sa.Float(), nullable=True),
        sa.Column("stop_loss", sa.Float(), nullable=False),
        sa.Column("target_1", sa.Float(), nullable=False),
        sa.Column("target_2", sa.Float(), nullable=True),
        sa.Column("runner_enabled", sa.Boolean(), nullable=False),
        sa.Column("runner_active", sa.Boolean(), nullable=False),
        sa.Column("position_size", sa.Float(), nullable=True),
        sa.Column("risk_per_trade", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("exit_price", sa.Float(), nullable=True),
        sa.Column("exit_reason", sa.String(length=128), nullable=True),
        sa.Column("final_r", sa.Float(), nullable=True),
        sa.Column("followed_plan", sa.Boolean(), nullable=True),
        sa.Column("discipline_score", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_trades_status"), "trades", ["status"], unique=False)
    op.create_index(op.f("ix_trades_symbol"), "trades", ["symbol"], unique=False)

    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trade_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rule_id", sa.String(length=128), nullable=False),
        sa.Column("severity", sa.String(length=16), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("acknowledged", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_alerts_rule_id"), "alerts", ["rule_id"], unique=False)

    op.create_table(
        "checklist_answers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trade_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("question_key", sa.String(length=128), nullable=False),
        sa.Column("answer", sa.Boolean(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("trade_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("followed_plan", sa.Boolean(), nullable=False),
        sa.Column("discipline_score", sa.Integer(), nullable=True),
        sa.Column("mistake_tags", sa.JSON(), nullable=False),
        sa.Column("lesson", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("trade_id"),
    )


def downgrade() -> None:
    op.drop_table("reviews")
    op.drop_table("checklist_answers")
    op.drop_index(op.f("ix_alerts_rule_id"), table_name="alerts")
    op.drop_table("alerts")
    op.drop_index(op.f("ix_trades_symbol"), table_name="trades")
    op.drop_index(op.f("ix_trades_status"), table_name="trades")
    op.drop_table("trades")
