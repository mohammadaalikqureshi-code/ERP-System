"""Thin wrappers around the AI chat providers.

Everything model- and vendor-specific lives here, so the rest of the app only
deals with "send these messages, get text back". Swapping models means changing
`AI_MODEL` in the environment; swapping providers means changing `AI_PROVIDER`
(and adding one class here if it is a vendor we do not support yet).

Two providers ship today:

* ``groq``      — Groq's OpenAI-compatible chat completions (the default).
* ``anthropic`` — Claude's Messages API.

The SDKs are imported lazily inside each provider, so this module keeps
importing even if only one of them is installed, and a deployment that never
uses a provider never pays for its dependency.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import List, Optional

from app.core.config import settings

logger = logging.getLogger(__name__)

# The providers that are AI chat backends (as opposed to messaging keys such as
# WhatsApp/MSG91). Used to decide which stored keys can be verified with a live
# call. Keeping it here means there is one authority on "is this an AI provider".
AI_PROVIDERS = ("groq", "anthropic")


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


class AiProvider(ABC):
    """What every provider must offer the rest of the app."""

    model: str

    @abstractmethod
    async def complete(
        self,
        system: str,
        messages: List[dict],
        max_tokens: Optional[int] = None,
    ) -> AiReply:
        """Send a conversation and return the assistant's reply as plain text.

        ``messages`` is a list of ``{"role": "user"|"assistant", "content": str}``
        — the vendor-neutral shape used everywhere else in the app.
        """
        raise NotImplementedError


class GroqProvider(AiProvider):
    """Calls Groq's OpenAI-compatible chat completions API.

    Groq takes the system prompt as the first message in the list (OpenAI
    style), unlike Claude which takes it as a separate argument — that
    difference is contained entirely within this class.
    """

    def __init__(self, api_key: str, model: Optional[str] = None):
        if not api_key:
            raise AiUnavailable("No API key configured for the AI assistant.")
        try:
            from groq import AsyncGroq
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise AiUnavailable(
                "The 'groq' package is not installed on the server. Run "
                "`pip install groq` (it is in requirements.txt)."
            ) from exc

        self.model = model or settings.AI_MODEL
        self._client = AsyncGroq(
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
        import groq

        payload = [{"role": "system", "content": system}, *messages]
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                max_tokens=max_tokens or settings.AI_MAX_TOKENS,
                messages=payload,
            )
        except groq.AuthenticationError as exc:
            raise AiRequestFailed("The AI API key was rejected. Check it in Settings → API Keys.") from exc
        except groq.PermissionDeniedError as exc:
            raise AiRequestFailed("This AI API key does not have access to the configured model.") from exc
        except groq.NotFoundError as exc:
            raise AiRequestFailed(f"Model '{self.model}' is not available for this key.") from exc
        except groq.RateLimitError as exc:
            raise AiRequestFailed("The AI service is rate limited right now. Please retry shortly.") from exc
        except groq.APIConnectionError as exc:
            raise AiRequestFailed("Could not reach the AI service. Check the server's internet access.") from exc
        except groq.APIStatusError as exc:
            logger.error("AI request failed", extra={"status": exc.status_code}, exc_info=True)
            raise AiRequestFailed("The AI service returned an error. Please try again.") from exc

        choice = response.choices[0] if response.choices else None
        text = (choice.message.content if choice and choice.message else "") or ""
        text = text.strip()

        usage = getattr(response, "usage", None)
        return AiReply(
            text=text or "I could not produce an answer for that. Please try rephrasing.",
            model=getattr(response, "model", self.model),
            input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            output_tokens=getattr(usage, "completion_tokens", 0) or 0,
        )


class ClaudeProvider(AiProvider):
    """Calls Claude's Messages API."""

    def __init__(self, api_key: str, model: Optional[str] = None):
        if not api_key:
            raise AiUnavailable("No API key configured for the AI assistant.")
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover - dependency guard
            raise AiUnavailable(
                "The 'anthropic' package is not installed on the server. Run "
                "`pip install anthropic` (it is in requirements.txt)."
            ) from exc

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
        import anthropic

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


def make_provider(
    provider: str, api_key: str, model: Optional[str] = None
) -> AiProvider:
    """Build the provider named by ``provider`` (usually ``settings.AI_PROVIDER``).

    Adding a new AI vendor is: write its ``AiProvider`` subclass above, list it
    in ``AI_PROVIDERS``, and add one line here.
    """
    provider = (provider or "").strip().lower()
    if provider == "groq":
        return GroqProvider(api_key, model)
    if provider == "anthropic":
        return ClaudeProvider(api_key, model)
    raise AiUnavailable(
        f"Unsupported AI provider '{provider}'. Set AI_PROVIDER to one of: "
        + ", ".join(AI_PROVIDERS)
    )
