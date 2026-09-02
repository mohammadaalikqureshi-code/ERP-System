"""Quick smoke test for the AI provider wiring — no database, no full app.

Confirms the provider factory, config defaults, the lazy-import guards, and
(optionally) a real round-trip to the configured provider. Handy for checking a
Groq key works without going through the UI.

Run it inside the API container (both SDKs installed):

    docker compose exec api python -m scripts.verify_groq

To exercise a real call, make sure the key is available to the process, e.g.:

    docker compose exec -e GROQ_TEST_KEY=gsk_xxx api python -m scripts.verify_groq

It exits non-zero if any check fails.
"""
import asyncio
import os

os.environ.setdefault("AI_PROVIDER", "groq")

from app.core.config import settings  # noqa: E402
from app.modules.ai.provider import (  # noqa: E402
    AI_PROVIDERS,
    AiRequestFailed,
    AiUnavailable,
    ClaudeProvider,
    GroqProvider,
    make_provider,
)

ok = True


def check(label, cond):
    global ok
    print(("PASS" if cond else "FAIL"), "-", label)
    ok = ok and cond


print("=== config ===")
print("AI_PROVIDER =", settings.AI_PROVIDER, "| AI_MODEL =", settings.AI_MODEL)
check("AI_PROVIDERS lists groq + anthropic", set(AI_PROVIDERS) == {"groq", "anthropic"})

print("\n=== factory ===")
gp = make_provider("groq", "gsk_dummy_key_for_construction_only")
check("make_provider('groq') -> GroqProvider", isinstance(gp, GroqProvider))
check("GroqProvider picks up AI_MODEL", gp.model == settings.AI_MODEL)

try:
    cp = make_provider("anthropic", "sk-ant-dummy")
    check("make_provider('anthropic') -> ClaudeProvider", isinstance(cp, ClaudeProvider))
except AiUnavailable as exc:
    # A deployment without the anthropic SDK installed: the guard should say so
    # clearly rather than crash at import time.
    check("anthropic lazy-import guard works when SDK absent", "not installed" in str(exc))

for bad in ("nvidia", ""):
    try:
        make_provider(bad or "groq", "" if bad == "" else "x")
        check(f"rejected invalid input ({bad!r})", False)
    except AiUnavailable:
        check(f"rejected invalid input ({bad!r})", True)

print("\n=== live round-trip ===")


async def live():
    key = os.environ.get("GROQ_TEST_KEY") or os.environ.get("AI_API_KEY")
    if not key:
        print("  (no key in GROQ_TEST_KEY/AI_API_KEY — skipping the real call)")
        return
    provider = make_provider(settings.AI_PROVIDER, key)
    try:
        reply = await provider.complete(
            system="Reply with the single word: ok",
            messages=[{"role": "user", "content": "ping"}],
            max_tokens=16,
        )
        print("  reply:", repr(reply.text), "| model:", reply.model,
              "| tokens:", reply.input_tokens, "/", reply.output_tokens)
        check("real call returned text", bool(reply.text))
    except AiRequestFailed as exc:
        print("  provider rejected the call:", exc)
        check("bad key/offline maps to AiRequestFailed (no crash)", True)


asyncio.run(live())

print("\n=== RESULT:", "ALL PASS" if ok else "SOME FAILED", "===")
raise SystemExit(0 if ok else 1)
