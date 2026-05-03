from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # LLM config
    llm_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="openai")
    llm_model: Mapped[str] = mapped_column(String(100), nullable=False, default="gpt-4o")
    llm_temperature: Mapped[float] = mapped_column(Float, nullable=False, default=0.7)
    llm_max_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=4096)
    llm_base_url: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # Stored Fernet-encrypted; never returned in API responses
    llm_api_key: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    mcp_servers: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_supervisor: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    worker_agent_ids: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=text("now()"),
        onupdate=utcnow,
    )

    __table_args__ = (
        Index("ix_agents_name", "name"),
        Index("ix_agents_created_at", "created_at"),
        Index("ix_agents_is_supervisor", "is_supervisor"),
    )
