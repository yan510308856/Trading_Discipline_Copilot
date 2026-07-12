"""Add append-only workflow event audit trail.

Revision ID: 0013_workflow_events
Revises: 0012_stage23_price_provenance
"""

from alembic import op
import sqlalchemy as sa

revision = "0013_workflow_events"
down_revision = "0012_stage23_price_provenance"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workflow_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("trade_id", sa.Integer(), sa.ForeignKey("trades.id", ondelete="SET NULL"), nullable=True),
        sa.Column("readiness_date", sa.Date(), nullable=True),
        sa.Column("rule_id", sa.String(length=128), nullable=True),
        sa.Column("severity", sa.String(length=16), nullable=True),
        sa.Column("idempotency_key", sa.String(length=192), nullable=True),
        sa.Column("event_data", sa.JSON(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_workflow_events_event_type", "workflow_events", ["event_type"])
    op.create_index("ix_workflow_events_trade_id", "workflow_events", ["trade_id"])
    op.create_index("ix_workflow_events_occurred_at", "workflow_events", ["occurred_at"])
    op.create_index("ix_workflow_events_idempotency_key", "workflow_events", ["idempotency_key"], unique=True)


def downgrade() -> None:
    op.drop_table("workflow_events")
