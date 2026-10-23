"""LLM providers. Both expose `await provider.complete(system, prompt) -> str`."""
from __future__ import annotations

import os

from palace.llm.base import LLMError, Provider

DEFAULT_MODELS = {
    "anthropic": os.environ.get("PALACE_ANTHROPIC_MODEL", "claude-sonnet-5-5"),
    "openai": os.environ.get("PALACE_OPENAI_MODEL", "gpt-5.5"),
}


def make_provider(name: str | None = None, model: str | None = None) -> Provider:
    """Pick a provider by name, else by PALACE_LLM_PROVIDER, else by which API key is set."""
    name = name or os.environ.get("PALACE_LLM_PROVIDER")
    if not name:
        if os.environ.get("ANTHROPIC_API_KEY"):
            name = "anthropic"
        elif os.environ.get("OPENAI_API_KEY"):
            name = "openai"
        else:
            raise LLMError("No LLM configured: set ANTHROPIC_API_KEY or OPENAI_API_KEY (see README).")
    model = model or DEFAULT_MODELS[name]
    if name == "anthropic":
        from palace.llm.anthropic_provider import AnthropicProvider

        return AnthropicProvider(model)
    if name == "openai":
        from palace.llm.openai_provider import OpenAIProvider

        return OpenAIProvider(model)
    raise LLMError(f"unknown provider {name!r}; use 'anthropic' or 'openai'")


__all__ = ["DEFAULT_MODELS", "LLMError", "Provider", "make_provider"]
