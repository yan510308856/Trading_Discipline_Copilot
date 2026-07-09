"""Add daily intraday readiness checklist.

Revision ID: 0007
Revises: 0006
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "daily_readiness",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("readiness_date", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("checklist_items", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_cleared_for_intraday", sa.Boolean(), nullable=False),
        sa.Column("completed_required_count", sa.Integer(), nullable=False),
        sa.Column("total_required_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_daily_readiness_readiness_date"),
        "daily_readiness",
        ["readiness_date"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_daily_readiness_readiness_date"),
        table_name="daily_readiness",
    )
    op.drop_table("daily_readiness")
