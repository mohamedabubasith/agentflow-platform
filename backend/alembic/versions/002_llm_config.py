"""Add LLM config columns to agents

Revision ID: 002
Revises: 001
Create Date: 2025-01-02 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("agents", sa.Column("llm_provider", sa.String(50), nullable=False, server_default="openai"))
    op.add_column("agents", sa.Column("llm_temperature", sa.Float(), nullable=False, server_default="0.7"))
    op.add_column("agents", sa.Column("llm_max_tokens", sa.Integer(), nullable=False, server_default="4096"))
    op.add_column("agents", sa.Column("llm_base_url", sa.Text(), nullable=True))
    op.add_column("agents", sa.Column("llm_api_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("agents", "llm_api_key")
    op.drop_column("agents", "llm_base_url")
    op.drop_column("agents", "llm_max_tokens")
    op.drop_column("agents", "llm_temperature")
    op.drop_column("agents", "llm_provider")
