"""Add current price provenance and freshness.

Revision ID: 0012_stage23_price_provenance
Revises: 0011_option_premiums
"""

from alembic import op
import sqlalchemy as sa

revision = "0012_stage23_price_provenance"
down_revision = "0011_option_premiums"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.add_column(sa.Column("current_price_source", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("current_price_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.drop_column("current_price_updated_at")
        batch.drop_column("current_price_source")
