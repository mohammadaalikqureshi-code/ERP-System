"""Thin wrapper around the Claude API.

Everything model-specific lives here, so the rest of the app only deals with
"send these messages, get text back". Swapping models means changing
`AI_MODEL` in the environment; swapping providers means adding one class here.
"""

import logging
from dataclasses import dataclass
from typing import List, Optional

import anthropic

from app.core.config import settings

logger = logging.getLogger(__name__)


class AiUnavailable(Exception):
    """No usable credential — the caller should degrade gracefully, not fail."""


class AiRequestFailed(Exception):
    """The provider was reachable but the request did not succeed."""


@dataclass
class AiReply:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0


class ClaudeProvider:
    """Calls Claude's Messages API."""

    def __init__(self, api_key: str, model: Optional[str] = None):
        if not api_key:
            raise AiUnavailable("No API key configured for the AI assistant.")
        self.model = model or settings.AI_MODEL
        self._client = anthropic.AsyncAnthropic(
            api_key=api_key,
            timeout=settings.AI_TIMEOUT_SECONDS,
            max_retries=2,
        )

    async def complete(
        self,
        system: str,
        messages: List[dict],
        max_tokens: Optional[int] = None,
    ) -> AiReply:
        """Send a conversation and return the assistant's reply as plain text."""
        try:
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=max_tokens or settings.AI_MAX_TOKENS,
                system=system,
                messages=messages,
            )
        except anthropic.AuthenticationError as exc:
            raise AiRequestFailed("The AI API key was rejected. Check it in Settings → API Keys.") from exc
        except anthropic.PermissionDeniedError as exc:
            raise AiRequestFailed("This AI API key does not have access to the configured model.") from exc
        except anthropic.NotFoundError as exc:
            raise AiRequestFailed(f"Model '{self.model}' is not available for this key.") from exc
        except anthropic.RateLimitError as exc:
            raise AiRequestFailed("The AI service is rate limited right now. Please retry shortly.") from exc
        except anthropic.APIConnectionError as exc:
            raise AiRequestFailed("Could not reach the AI service. Check the server's internet access.") from exc
        except anthropic.APIStatusError as exc:
            logger.error("AI request failed", extra={"status": exc.status_code}, exc_info=True)
            raise AiRequestFailed("The AI service returned an error. Please try again.") from exc

        # A safety refusal is not an error — surface it as ordinary text.
        if getattr(response, "stop_reason", None) == "refusal":
            return AiReply(
                text=(
                    "I can't help with that particular request. Please rephrase it, "
                    "or handle it outside the assistant."
                ),
                model=self.model,
            )

        text = "\n".join(block.text for block in response.content if block.type == "text").strip()

        return AiReply(
            text=text or "I could not produce an answer for that. Please try rephrasing.",
            model=response.model,
            input_tokens=response.usage.input_tokens,
            output_tokens=response.usage.output_tokens,
        )
