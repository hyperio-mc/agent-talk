"""
Agent Talk SDK - HTTP Client
"""

import json
from typing import Optional, TypeVar, Type
from dataclasses import asdict
import urllib.request
import urllib.error

from .types import AgentTalkConfig, HealthResponse
from .errors import AgentTalkError, create_error_from_response

T = TypeVar('T')

DEFAULT_BASE_URL = "https://talk.onhyper.io"
DEFAULT_TIMEOUT = 30  # seconds


class HttpClient:
    """HTTP Client for Agent Talk API."""
    
    def __init__(self, config: AgentTalkConfig = None):
        if config is None:
            config = AgentTalkConfig()
        self.base_url = config.base_url or DEFAULT_BASE_URL
        self.api_key = config.api_key
        self.timeout = config.timeout // 1000 if config.timeout else DEFAULT_TIMEOUT
    
    def get_base_url(self) -> str:
        """Get the base URL."""
        return self.base_url
    
    def get(self, path: str, auth: bool = True) -> dict:
        """Make a GET request."""
        return self._request("GET", path, auth=auth)
    
    def post(self, path: str, body: Optional[dict] = None, auth: bool = True) -> dict:
        """Make a POST request."""
        return self._request("POST", path, body=body, auth=auth)
    
    def delete(self, path: str, auth: bool = True) -> dict:
        """Make a DELETE request."""
        return self._request("DELETE", path, auth=auth)
    
    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        auth: bool = True
    ) -> dict:
        """Make an HTTP request."""
        url = f"{self.base_url}{path}"
        
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        
        # Add API key authentication if required and available
        if auth and self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        
        data = None
        if body:
            data = json.dumps(body).encode("utf-8")
        
        request = urllib.request.Request(
            url,
            data=data,
            headers=headers,
            method=method
        )
        
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                response_body = response.read().decode("utf-8")
                if not response_body:
                    return {}
                return json.loads(response_body)
        
        except urllib.error.HTTPError as e:
            # Handle error response
            response_body = e.read().decode("utf-8")
            try:
                error_response = json.loads(response_body)
                raise create_error_from_response(e.code, error_response)
            except json.JSONDecodeError:
                raise AgentTalkError(
                    "INTERNAL_ERROR",
                    f"HTTP {e.code}: {e.reason}",
                    e.code
                )
        
        except urllib.error.URLError as e:
            # Handle network errors
            raise AgentTalkError(
                "SERVICE_UNAVAILABLE",
                f"Network error: Unable to connect to Agent Talk API: {e.reason}",
                503
            )
        
        except TimeoutError:
            raise AgentTalkError(
                "SERVICE_UNAVAILABLE",
                "Request timeout",
                408
            )


class MemoApi:
    """Memo API - Create and manage text-to-speech memos."""
    
    def __init__(self, client: HttpClient):
        self._client = client
    
    def create(self, text: str, voice: str) -> 'Memo':
        """
        Create a new memo (convert text to speech).
        
        Requires an API key to be configured.
        
        Args:
            text: The text to convert to speech
            voice: The voice ID to use (e.g., 'rachel', 'domi', 'adam')
        
        Returns:
            Memo: The created memo with audio URL
        
        Raises:
            MissingApiKeyError: If no API key is configured
            InvalidVoiceError: If the voice ID is invalid
            RateLimitError: If rate limit is exceeded
        
        Example:
            memo = client.memo.create(
                text="Hello from Agent Talk!",
                voice="rachel"
            )
            print(f"Audio URL: {memo.audio.url}")
        """
        from .types import Memo, MemoAudio, MemoVoice
        
        response = self._client.post("/api/v1/memo", {"text": text, "voice": voice}, auth=True)
        
        return Memo(
            id=response["id"],
            text=response["text"],
            voice=MemoVoice(
                id=response["voice"]["id"],
                name=response["voice"]["name"],
                gender=response["voice"]["gender"],
                description=response["voice"]["description"]
            ),
            audio=MemoAudio(
                url=response["audio"]["url"],
                duration=response["audio"]["duration"],
                format=response["audio"]["format"]
            ),
            created_at=response["createdAt"]
        )
    
    def demo(self, text: str, voice: str) -> 'Memo':
        """
        Create a demo memo (no API key required).
        
        Uses simulation mode - audio will be silent/placeholder.
        For production-quality audio, use create() with an API key.
        
        Args:
            text: The text to convert to speech
            voice: The voice ID to use
        
        Returns:
            Memo: The created memo with simulated audio
        
        Example:
            # No API key needed for demo
            memo = client.memo.demo(
                text="This is a demo!",
                voice="rachel"
            )
        """
        from .types import Memo, MemoAudio, MemoVoice
        
        response = self._client.post("/api/v1/demo", {"text": text, "voice": voice}, auth=False)
        
        return Memo(
            id=response["id"],
            text=response["text"],
            voice=MemoVoice(
                id=response["voice"]["id"],
                name=response["voice"]["name"],
                gender=response["voice"]["gender"],
                description=response["voice"]["description"]
            ),
            audio=MemoAudio(
                url=response["audio"]["url"],
                duration=response["audio"]["duration"],
                format=response["audio"]["format"]
            ),
            created_at=response["createdAt"]
        )


class VoicesApi:
    """Voices API - List and manage available voices."""
    
    def __init__(self, client: HttpClient):
        self._client = client
    
    def list(self) -> list:
        """
        List all available voices.
        
        Returns:
            List[Voice]: Array of available voices
        
        Example:
            voices = client.voices.list()
            for voice in voices:
                print(f"{voice.id}: {voice.name} - {voice.description}")
        """
        from .types import Voice
        
        response = self._client.get("/api/v1/voices", auth=False)
        
        return [
            Voice(
                id=v["id"],
                name=v["name"],
                gender=v["gender"],
                description=v["description"]
            )
            for v in response["voices"]
        ]
    
    def get(self, voice_id: str) -> Optional['Voice']:
        """
        Get a voice by ID.
        
        Args:
            voice_id: The voice ID to look up
        
        Returns:
            Voice: The voice if found, or None
        
        Example:
            voice = client.voices.get("rachel")
            if voice:
                print(f"Found voice: {voice.name}")
        """
        voices = self.list()
        for voice in voices:
            if voice.id == voice_id:
                return voice
        return None


class AgentTalk:
    """
    Agent Talk SDK Client.
    
    Main entry point for interacting with the Agent Talk API.
    
    Example:
        from agent_talk import AgentTalk
        
        # Initialize with API key
        client = AgentTalk(api_key="at_live_xxx")
        
        # Create a memo
        memo = client.memo.create(
            text="Hello world",
            voice="rachel"
        )
        
        print(f"Audio URL: {memo.audio.url}")
    
    Example (Demo mode):
        # No API key needed for demo
        client = AgentTalk()
        
        # List voices
        voices = client.voices.list()
        
        # Create demo memo (simulated audio)
        memo = client.memo.demo(
            text="This is a demo",
            voice="rachel"
        )
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: Optional[int] = None
    ):
        """
        Create a new Agent Talk client.
        
        Args:
            api_key: API key (required for memo.create(), optional for demo/voices)
            base_url: API base URL (default: https://talk.onhyper.io)
            timeout: Request timeout in milliseconds (default: 30000)
        """
        config = AgentTalkConfig(
            api_key=api_key,
            base_url=base_url or DEFAULT_BASE_URL,
            timeout=timeout or 30000
        )
        self._client = HttpClient(config)
        self.memo = MemoApi(self._client)
        self.voices = VoicesApi(self._client)
    
    def health(self) -> HealthResponse:
        """
        Check API health status.
        
        Returns:
            HealthResponse: Health status response
        
        Example:
            health = client.health()
            print(f"Status: {health.status}")
        """
        response = self._client.get("/health", auth=False)
        
        return HealthResponse(
            status=response["status"],
            service=response["service"],
            version=response["version"],
            timestamp=response["timestamp"],
            tts_mode=response["ttsMode"],
            database=response["database"]
        )
    
    def get_base_url(self) -> str:
        """Get the base URL being used."""
        return self._client.get_base_url()