"""
Agent Talk SDK - TypeScript Types
"""

from dataclasses import dataclass
from typing import Optional, Literal
from datetime import datetime


@dataclass
class Voice:
    """A TTS voice option."""
    id: str
    name: str
    gender: Literal['male', 'female']
    description: str


@dataclass
class MemoAudio:
    """Audio metadata for a memo."""
    url: str
    duration: float
    format: Literal['mp3', 'wav', 'ogg', 'webm']


@dataclass
class MemoVoice:
    """Voice used in a memo."""
    id: str
    name: str
    gender: Literal['male', 'female']
    description: str


@dataclass
class Memo:
    """A text-to-speech memo."""
    id: str
    text: str
    voice: MemoVoice
    audio: MemoAudio
    created_at: str


@dataclass
class CreateMemoOptions:
    """Options for creating a memo."""
    text: str
    voice: str


@dataclass
class HealthResponse:
    """Health check response."""
    status: Literal['ok', 'error']
    service: str
    version: str
    timestamp: str
    tts_mode: Literal['simulation', 'edge', 'elevenlabs']
    database: dict


@dataclass
class AgentTalkConfig:
    """Client configuration."""
    api_key: Optional[str] = None
    base_url: str = "https://talk.onhyper.io"
    timeout: int = 30000


@dataclass
class ErrorDetails:
    """Details about an error."""
    field: Optional[str] = None
    reason: Optional[str] = None
    provided_type: Optional[str] = None
    requested_voice: Optional[str] = None
    available_voices: Optional[list] = None
    limit: Optional[int] = None
    used: Optional[int] = None
    reset_at: Optional[str] = None
    required_tier: Optional[str] = None
    current_tier: Optional[str] = None
    operation: Optional[str] = None
    memo_id: Optional[str] = None