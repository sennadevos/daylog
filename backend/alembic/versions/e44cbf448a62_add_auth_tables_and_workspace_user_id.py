"""add auth tables and workspace user_id

Revision ID: e44cbf448a62
Revises: 3e2da3791ecc
Create Date: 2026-04-07 15:22:15.281324

"""
from datetime import datetime
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e44cbf448a62'
down_revision: Union[str, Sequence[str], None] = '3e2da3791ecc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

naming_convention = {
    "uq": "uq_%(table_name)s_%(column_0_name)s",
}


def upgrade() -> None:
    """Upgrade schema."""
    # Create auth tables
    op.create_table('user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
    )
    op.create_table('personal_access_token',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash')
    )
    op.create_table('user_session',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Add user_id to workspace as nullable first
    with op.batch_alter_table('workspace', naming_convention=naming_convention) as batch_op:
        batch_op.add_column(sa.Column('user_id', sa.Integer(), nullable=True))

    # Create a default user and assign existing workspaces
    conn = op.get_bind()
    existing = conn.execute(sa.text("SELECT COUNT(*) FROM workspace")).scalar()
    if existing > 0:
        import bcrypt
        pw_hash = bcrypt.hashpw(b"changeme", bcrypt.gensalt()).decode()
        conn.execute(sa.text(
            "INSERT INTO user (id, username, password_hash, created_at) VALUES (1, :u, :p, :t)"
        ), {"u": "admin", "p": pw_hash, "t": datetime.now().isoformat()})
        conn.execute(sa.text("UPDATE workspace SET user_id = 1"))

    # Recreate workspace table with proper constraints via batch mode
    with op.batch_alter_table('workspace', naming_convention=naming_convention) as batch_op:
        batch_op.alter_column('user_id', nullable=False)
        batch_op.drop_constraint('uq_workspace_name', type_='unique')
        batch_op.create_unique_constraint('uq_workspace_user_id_name', ['user_id', 'name'])
        batch_op.create_foreign_key('fk_workspace_user_id', 'user', ['user_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('workspace', naming_convention=naming_convention) as batch_op:
        batch_op.drop_constraint('fk_workspace_user_id', type_='foreignkey')
        batch_op.drop_constraint('uq_workspace_user_id_name', type_='unique')
        batch_op.drop_column('user_id')
        batch_op.create_unique_constraint('uq_workspace_name', ['name'])
    op.drop_table('user_session')
    op.drop_table('personal_access_token')
    op.drop_table('user')
