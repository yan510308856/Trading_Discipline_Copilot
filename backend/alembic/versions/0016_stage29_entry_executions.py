"""Add immutable initial and add-position execution history.

Revision ID: 0016_stage29_entry_executions
Revises: 0015_stage28_warning_integrity
"""

from alembic import op
import sqlalchemy as sa


revision = "0016_stage29_entry_executions"
down_revision = "0015_stage28_warning_integrity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trade_entry_executions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "trade_id",
            sa.Integer(),
            sa.ForeignKey("trades.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("executed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("entry_kind", sa.String(length=16), nullable=False),
        sa.Column("underlying_price", sa.Numeric(18, 4), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 2), nullable=False),
        sa.Column("stop_at_entry", sa.Numeric(18, 4), nullable=False),
        sa.Column("option_price", sa.Numeric(18, 4), nullable=True),
        sa.Column("reason", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "entry_kind IN ('initial', 'add')", name="ck_trade_entry_kind"
        ),
        sa.CheckConstraint(
            "quantity > 0", name="ck_trade_entry_quantity_positive"
        ),
    )
    op.create_index(
        "ix_trade_entry_executions_trade_id",
        "trade_entry_executions",
        ["trade_id"],
    )
    op.create_index(
        "ix_trade_entry_executions_executed_at",
        "trade_entry_executions",
        ["executed_at"],
    )
    op.create_index(
        "uq_trade_entry_initial",
        "trade_entry_executions",
        ["trade_id"],
        unique=True,
        sqlite_where=sa.text("entry_kind = 'initial'"),
    )
    op.execute(
        """
        INSERT INTO trade_entry_executions (
            trade_id,
            executed_at,
            entry_kind,
            underlying_price,
            quantity,
            stop_at_entry,
            option_price,
            reason,
            notes,
            created_at
        )
        SELECT
            trades.id,
            COALESCE(trades.opened_at, trades.created_at),
            'initial',
            COALESCE(trades.actual_entry, trades.planned_entry),
            ROUND(trades.position_size, 2),
            trades.stop_loss,
            CASE
                WHEN trades.market = 'options' THEN trades.option_entry_price
                ELSE NULL
            END,
            'legacy_backfill',
            NULL,
            COALESCE(trades.opened_at, trades.created_at)
        FROM trades
        WHERE trades.status IN ('open', 'closed')
          AND trades.position_size IS NOT NULL
          AND trades.position_size > 0
          AND COALESCE(trades.actual_entry, trades.planned_entry) > 0
          AND trades.stop_loss > 0
          AND NOT EXISTS (
              SELECT 1
              FROM trade_entry_executions existing
              WHERE existing.trade_id = trades.id
                AND existing.entry_kind = 'initial'
          )
        """
    )


def downgrade() -> None:
    op.drop_index("uq_trade_entry_initial", table_name="trade_entry_executions")
    op.drop_index(
        "ix_trade_entry_executions_executed_at",
        table_name="trade_entry_executions",
    )
    op.drop_index(
        "ix_trade_entry_executions_trade_id",
        table_name="trade_entry_executions",
    )
    op.drop_table("trade_entry_executions")
