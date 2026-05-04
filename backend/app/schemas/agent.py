from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class MCPServer(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    url: str = Field(..., min_length=1)
    transport: str = Field(default="sse", pattern="^(sse|stdio|websocket)$")


LLMProvider = Literal["openai", "anthropic", "google", "openai_compatible"]


class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = Field(default="")
    system_prompt: str = Field(default="")
    llm_provider: LLMProvider = Field(default="openai")
    llm_model: str = Field(default="gpt-4o", min_length=1, max_length=100)
    llm_temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    llm_max_tokens: int = Field(default=4096, ge=1, le=128000)
    llm_base_url: Optional[str] = Field(default=None)
    llm_api_key: Optional[str] = Field(default=None)
    mcp_servers: List[MCPServer] = Field(default_factory=list)
    is_supervisor: bool = Field(default=False)
    worker_agent_ids: List[uuid.UUID] = Field(default_factory=list)

    @field_validator("mcp_servers", mode="before")
    @classmethod
    def _coerce_mcp_servers(cls, v: Any) -> Any:
        return v if v is not None else []

    @field_validator("worker_agent_ids", mode="before")
    @classmethod
    def _coerce_worker_ids(cls, v: Any) -> Any:
        return v if v is not None else []


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    llm_provider: Optional[LLMProvider] = None
    llm_model: Optional[str] = Field(default=None, min_length=1, max_length=100)
    llm_temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    llm_max_tokens: Optional[int] = Field(default=None, ge=1, le=128000)
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    mcp_servers: Optional[List[MCPServer]] = None
    is_supervisor: Optional[bool] = None
    worker_agent_ids: Optional[List[uuid.UUID]] = None


class AgentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str
    system_prompt: str
    llm_provider: str
    llm_model: str
    llm_temperature: float
    llm_max_tokens: int
    llm_base_url: Optional[str]
    llm_api_key: None = None  # never exposed
    mcp_servers: List[MCPServer]
    is_supervisor: bool
    worker_agent_ids: List[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="after")
    def _redact_api_key(self) -> AgentResponse:
        object.__setattr__(self, "llm_api_key", None)
        return self


class AgentListResponse(BaseModel):
    items: List[AgentResponse]
    total: int
    skip: int
    limit: int


class HealthResponse(BaseModel):
    status: str
    db: str
    version: str


# ── RunHistory schemas ─────────────────────────────────────────────────────

class RunHistoryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    agent_id: uuid.UUID
    conversation_id: str
    user_message: str
    assistant_response: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    duration_ms: int
    mcp_servers_used: List[Any]
    error: Optional[str]
    created_at: datetime


class RunHistoryListResponse(BaseModel):
    items: List[RunHistoryResponse]
    total: int
    skip: int
    limit: int


class RunStatsResponse(BaseModel):
    total_runs: int
    total_tokens: int
    avg_duration_ms: float
    runs_last_7_days: int
    most_used_tools: List[Dict[str, Any]]


# ── MCP test schemas ───────────────────────────────────────────────────────

class MCPTestRequest(BaseModel):
    url: str = Field(..., min_length=1)
    transport: str = Field(default="sse", pattern="^(sse|stdio|websocket)$")


class MCPTestResponse(BaseModel):
    healthy: bool
    tools_count: int
    error: Optional[str]


class MCPToolInfo(BaseModel):
    name: str
    description: Optional[str]


# ── Info schema ────────────────────────────────────────────────────────────

class InfoResponse(BaseModel):
    name: str
    version: str
    env: str
    providers_configured: List[str]
    agent_count: int
    active_websockets: int
    cache_size: int
    cache_maxsize: int
