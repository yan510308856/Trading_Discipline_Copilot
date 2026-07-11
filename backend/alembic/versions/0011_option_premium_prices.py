"""Add manually recorded option premium prices.

Revision ID: 0011_option_premiums
Revises: 0010_stage22
"""

from alembic import op
import sqlalchemy as sa

revision = "0011_option_premiums"
down_revision = "0010_stage22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("trades") as batch:
        batch.add_column(sa.Column("option_entry_price", sa.Float(), nullable=True))
        batch.add_column(sa.Column("option_current_price", sa.Float(), nullable=True))
    with op.batch_alter_table("trade_executions") as batch:
        batch.add_column(sa.Column("option_price", sa.Float(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("trade_executions") as batch:
        batch.drop_column("option_price")
    with op.batch_alter_table("trades") as batch:
        batch.drop_column("option_current_price")
        batch.drop_column("option_entry_price")
