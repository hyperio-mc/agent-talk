"""
Agent Talk SDK for Python

Text-to-speech API for AI agents.

Example:
    from agent_talk import AgentTalk

    client = AgentTalk(api_key="at_live_xxx")

    memo = client.memo.create(
        text="Hello from Agent Talk!",
        voice="rachel"
    )

    print(f"Audio URL: {memo.audio.url}")
"""

from .client import AgentTalk
from .types import (
    Voice,
    Memo,
    MemoAudio,
    MemoVoice,
    CreateMemoOptions,
    HealthResponse,
    AgentTalkConfig,
)
from .errors import (
    AgentTalkError,
    ValidationError,
    InvalidVoiceError,
    UnauthorizedError,
    MissingApiKeyError,
    InvalidApiKeyError,
    RevokedKeyError,
    RateLimitError,
    DailyLimitExceededError,
    MonthlyLimitExceededError,
    TTSServiceError,
    ServiceUnavailableError,
)

__version__ = "1.0.0"
__all__ = [
    # Client
    "AgentTalk",
    # Types
    "Voice",
    "Memo",
    "MemoAudio",
    "MemoVoice",
    "CreateMemoOptions",
    "HealthResponse",
    "AgentTalkConfig",
    # Errors
    "AgentTalkError",
    "ValidationError",
    "InvalidVoiceError",
    "UnauthorizedError",
    "MissingApiKeyError",
    "InvalidApiKeyError",
    "RevokedKeyError",
    "RateLimitError",
    "DailyLimitExceededError",
    "MonthlyLimitExceededError",
    "TTSServiceError",
    "ServiceUnavailableError",
]