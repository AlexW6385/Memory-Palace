from __future__ import annotations

import json
import re
from typing import Protocol


class LLMError(RuntimeError):
    pass


class Provider(Protocol):
    name: str
    model: str

    async def complete(self, system: str, prompt: str, max_tokens: int = 16000) -> str: ...


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def extract_json(text: str):
    """Parse the JSON object in a model reply, tolerating code fences and chatter around it."""
    m = _FENCE.search(text)
    if m:
        text = m.group(1)
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object found in the reply")
    return json.loads(text[start : end + 1])
