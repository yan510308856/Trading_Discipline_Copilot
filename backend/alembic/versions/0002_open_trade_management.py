"""Add open trade management fields.

Revision ID: 0002
Revises: 0001
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("trades", sa.Column("current_stop", sa.Float(), nullable=True))
    op.add_column("trades", sa.Column("current_price", sa.Float(), nullable=True))
    op.add_column("trades", sa.Column("runner_stop", sa.Float(), nullable=True))
    op.add_column(
        "trades",
        sa.Column(
            "partial_taken",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("trades", "partial_taken")
    op.drop_column("trades", "runner_stop")
    op.drop_column("trades", "current_price")
    op.drop_column("trades", "current_stop")
