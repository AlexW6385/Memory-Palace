from __future__ import annotations

from palace.llm.base import LLMError


class AnthropicProvider:
    """Claude via the Anthropic Messages API (reads ANTHROPIC_API_KEY)."""

    name = "anthropic"

    def __init__(self, model: str):
        try:
            from anthropic import AsyncAnthropic
        except ImportError as e:  # pragma: no cover
            raise LLMError("pip install anthropic") from e
        self.model = model
        self.client = AsyncAnthropic()

    async def complete(self, system: str, prompt: str, max_tokens: int = 16000) -> str:
        msg = await self.client.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in msg.content if getattr(block, "type", "") == "text")
        if not text:
            raise LLMError(f"empty reply from {self.model} (stop_reason={msg.stop_reason})")
        return text
