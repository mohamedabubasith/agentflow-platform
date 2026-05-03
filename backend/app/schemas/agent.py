from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MCPServer(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1)
    transport: str = Field(default="sse", pattern="^(sse|stdio|websocket)$")


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    system_prompt: str = Field(default="")
    llm_model: str = Field(default="gpt-4o", min_length=1, max_length=100)
    mcp_servers: List[MCPServer] = Field(default_factory=list)
    is_supervisor: bool = Field(default=False)
    worker_agent_ids: List[uuid.UUID] = Field(default_factory=list)

    @field_validator("mcp_servers", mode="before")
    @classmethod
    def validate_mcp_servers(cls, v: Any) -> Any:
        if v is None:
            return []
        return v

    @field_validator("worker_agent_ids", mode="before")
    @classmethod
    def validate_worker_agent_ids(cls, v: Any) -> Any:
        if v is None:
            return []
        return v


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_model: Optional[str] = Field(default=None, min_length=1, max_length=100)
    mcp_servers: Optional[List[MCPServer]] = None
    is_supervisor: Optional[bool] = None
    worker_agent_ids: Optional[List[uuid.UUID]] = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    system_prompt: str
    llm_model: str
    mcp_servers: List[MCPServer]
    is_supervisor: bool
    worker_agent_ids: List[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class AgentListResponse(BaseModel):
    items: List[AgentResponse]
    total: int
    skip: int
    limit: int


class HealthResponse(BaseModel):
    status: str
    db: str
    version: str
