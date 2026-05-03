from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from langchain_core.language_models import BaseChatModel

if TYPE_CHECKING:
    from app.models.agent import Agent

logger = logging.getLogger(__name__)

_TIMEOUT_CONNECT = 30
_TIMEOUT_READ = 120


def _decrypt_api_key(encrypted: str) -> str:
    from app.config import settings
    from cryptography.fernet import Fernet, InvalidToken

    if not settings.FERNET_KEY:
        raise ValueError("FERNET_KEY is not configured; cannot decrypt per-agent API keys.")
    try:
        f = Fernet(settings.FERNET_KEY.encode())
        return f.decrypt(encrypted.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Failed to decrypt agent API key — key may be corrupt or wrong.") from exc


def encrypt_api_key(plaintext: str) -> str:
    from app.config import settings
    from cryptography.fernet import Fernet

    if not settings.FERNET_KEY:
        raise ValueError("FERNET_KEY is not configured; cannot encrypt API keys.")
    f = Fernet(settings.FERNET_KEY.encode())
    return f.encrypt(plaintext.encode()).decode()


def _resolve_api_key(agent: "Agent", env_var: str) -> str:
    import os

    if agent.llm_api_key:
        try:
            return _decrypt_api_key(agent.llm_api_key)
        except ValueError:
            logger.warning("rid=- Failed to decrypt API key for agent %s, falling back to env var", agent.id)

    key = os.environ.get(env_var, "")
    if not key:
        raise ValueError(
            f"No API key available for agent '{agent.name}': "
            f"neither llm_api_key nor {env_var} env var is set."
        )
    return key


def build_llm(agent: "Agent") -> BaseChatModel:
    provider = agent.llm_provider
    common = {
        "model": agent.llm_model,
        "temperature": agent.llm_temperature,
        "max_tokens": agent.llm_max_tokens,
    }

    if provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            **common,
            api_key=_resolve_api_key(agent, "OPENAI_API_KEY"),
            timeout=_TIMEOUT_READ,
            streaming=True,
        )

    if provider == "openai_compatible":
        from langchain_openai import ChatOpenAI

        if not agent.llm_base_url:
            raise ValueError(f"Agent '{agent.name}' uses provider 'openai_compatible' but llm_base_url is not set.")
        return ChatOpenAI(
            **common,
            api_key=_resolve_api_key(agent, "OPENAI_API_KEY"),
            base_url=agent.llm_base_url,
            timeout=_TIMEOUT_READ,
            streaming=True,
        )

    if provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(
            **common,
            api_key=_resolve_api_key(agent, "ANTHROPIC_API_KEY"),
            timeout=_TIMEOUT_READ,
            streaming=True,
        )

    if provider == "google":
        from langchain_google_genai import ChatGoogleGenerativeAI

        return ChatGoogleGenerativeAI(
            **common,
            google_api_key=_resolve_api_key(agent, "GOOGLE_API_KEY"),
        )

    raise ValueError(f"Unsupported LLM provider: '{provider}'")
