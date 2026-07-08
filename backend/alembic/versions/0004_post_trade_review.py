"""Add config-driven post-trade review fields.

Revision ID: 0004
Revises: 0003
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch_op:
        batch_op.alter_column(
            "followed_plan",
            existing_type=sa.Boolean(),
            type_=sa.String(length=16),
            existing_nullable=True,
        )

    with op.batch_alter_table("reviews") as batch_op:
        batch_op.alter_column(
            "followed_plan",
            existing_type=sa.Boolean(),
            type_=sa.String(length=16),
            existing_nullable=False,
        )
        batch_op.add_column(sa.Column("positive_actions", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("notes", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("score_band", sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column("triggered_rules", sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column("veto_reason", sa.Text(), nullable=True))
        batch_op.add_column(
            sa.Column("trade_classification", sa.String(length=32), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("reviews") as batch_op:
        batch_op.drop_column("trade_classification")
        batch_op.drop_column("veto_reason")
        batch_op.drop_column("triggered_rules")
        batch_op.drop_column("score_band")
        batch_op.drop_column("notes")
        batch_op.drop_column("positive_actions")
        batch_op.alter_column(
            "followed_plan",
            existing_type=sa.String(length=16),
            type_=sa.Boolean(),
            existing_nullable=False,
        )

    with op.batch_alter_table("trades") as batch_op:
        batch_op.alter_column(
            "followed_plan",
            existing_type=sa.String(length=16),
            type_=sa.Boolean(),
            existing_nullable=True,
        )
