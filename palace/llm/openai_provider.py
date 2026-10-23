from __future__ import annotations

from palace.llm.base import LLMError


class OpenAIProvider:
    """OpenAI via the Responses API (reads OPENAI_API_KEY)."""

    name = "openai"

    def __init__(self, model: str):
        try:
            from openai import AsyncOpenAI
        except ImportError as e:  # pragma: no cover
            raise LLMError("pip install openai") from e
        self.model = model
        self.client = AsyncOpenAI()

    async def complete(self, system: str, prompt: str, max_tokens: int = 16000) -> str:
        resp = await self.client.responses.create(
            model=self.model,
            instructions=system,
            input=prompt,
            max_output_tokens=max_tokens,
        )
        text = resp.output_text
        if not text:
            raise LLMError(f"empty reply from {self.model}")
        return text
