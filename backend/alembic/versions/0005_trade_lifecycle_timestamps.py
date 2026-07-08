"""Add trade open and close timestamps.

Revision ID: 0005
Revises: 0004
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "trades", sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "trades", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("trades", "closed_at")
    op.drop_column("trades", "opened_at")
