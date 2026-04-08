"""add origin_id to todo_item

Revision ID: 5cced2756000
Revises: e44cbf448a62
Create Date: 2026-04-08 20:24:45.873530

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5cced2756000'
down_revision: Union[str, Sequence[str], None] = 'e44cbf448a62'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add as nullable first
    with op.batch_alter_table('todo_item', schema=None) as batch_op:
        batch_op.add_column(sa.Column('origin_id', sa.String(length=36), nullable=True))

    # Backfill existing rows with unique UUIDs
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id FROM todo_item")).fetchall()
    for row in rows:
        conn.execute(
            sa.text("UPDATE todo_item SET origin_id = :oid WHERE id = :id"),
            {"oid": str(uuid.uuid4()), "id": row[0]},
        )

    # Make non-nullable
    with op.batch_alter_table('todo_item', schema=None) as batch_op:
        batch_op.alter_column('origin_id', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('todo_item', schema=None) as batch_op:
        batch_op.drop_column('origin_id')
