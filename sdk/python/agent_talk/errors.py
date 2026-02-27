"""
Agent Talk SDK - Custom Error Classes
"""

from typing import Optional
from .types import ErrorDetails


class AgentTalkError(Exception):
    """Base error class for all Agent Talk errors."""
    
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 500,
        details: Optional[ErrorDetails] = None
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details
        self.name = "AgentTalkError"


class ValidationError(AgentTalkError):
    """Validation error (400)."""
    
    def __init__(self, message: str, details: Optional[ErrorDetails] = None):
        super().__init__("VALIDATION_ERROR", message, 400, details)
        self.name = "ValidationError"


class InvalidInputError(AgentTalkError):
    """Invalid input error (400)."""
    
    def __init__(self, field: str, reason: str, provided_type: Optional[str] = None):
        details = ErrorDetails(field=field, reason=reason, provided_type=provided_type)
        super().__init__("INVALID_INPUT", f"Invalid {field}: {reason}", 400, details)
        self.name = "InvalidInputError"


class MissingFieldError(AgentTalkError):
    """Missing required field error (400)."""
    
    def __init__(self, field: str):
        details = ErrorDetails(field=field)
        super().__init__("MISSING_FIELD", f"Missing required field: {field}", 400, details)
        self.name = "MissingFieldError"


class InvalidVoiceError(AgentTalkError):
    """Invalid voice ID error (400)."""
    
    def __init__(self, requested_voice: str, available_voices: list):
        details = ErrorDetails(
            field="voice",
            requested_voice=requested_voice,
            available_voices=available_voices
        )
        super().__init__("INVALID_VOICE", f"Invalid voice: \"{requested_voice}\"", 400, details)
        self.name = "InvalidVoiceError"


class UnauthorizedError(AgentTalkError):
    """Authentication required error (401)."""
    
    def __init__(self, message: str = "Authentication required"):
        super().__init__("UNAUTHORIZED", message, 401)
        self.name = "UnauthorizedError"


class MissingApiKeyError(AgentTalkError):
    """API key required error (401)."""
    
    def __init__(self):
        super().__init__("MISSING_API_KEY", "API key is required", 401)
        self.name = "MissingApiKeyError"


class InvalidApiKeyError(AgentTalkError):
    """Invalid API key error (401)."""
    
    def __init__(self):
        super().__init__("INVALID_API_KEY", "Invalid API key", 401)
        self.name = "InvalidApiKeyError"


class ExpiredTokenError(AgentTalkError):
    """Expired token error (401)."""
    
    def __init__(self):
        super().__init__("EXPIRED_TOKEN", "Token has expired", 401)
        self.name = "ExpiredTokenError"


class ForbiddenError(AgentTalkError):
    """Access denied error (403)."""
    
    def __init__(self, message: str = "Access denied"):
        super().__init__("FORBIDDEN", message, 403)
        self.name = "ForbiddenError"


class InsufficientTierError(AgentTalkError):
    """Insufficient tier error (403)."""
    
    def __init__(self, required_tier: str, current_tier: str):
        details = ErrorDetails(required_tier=required_tier, current_tier=current_tier)
        super().__init__("INSUFFICIENT_TIER", f"This feature requires {required_tier} tier", 403, details)
        self.name = "InsufficientTierError"


class RevokedKeyError(AgentTalkError):
    """Revoked API key error (403)."""
    
    def __init__(self):
        super().__init__("REVOKED_KEY", "API key has been revoked", 403)
        self.name = "RevokedKeyError"


class NotFoundError(AgentTalkError):
    """Resource not found error (404)."""
    
    def __init__(self, resource: str = "Resource"):
        super().__init__("NOT_FOUND", f"{resource} not found", 404)
        self.name = "NotFoundError"


class MemoNotFoundError(AgentTalkError):
    """Memo not found error (404)."""
    
    def __init__(self, memo_id: str):
        details = ErrorDetails(memo_id=memo_id)
        super().__init__("MEMO_NOT_FOUND", "Memo not found", 404, details)
        self.name = "MemoNotFoundError"


class RateLimitError(AgentTalkError):
    """Rate limit exceeded error (429)."""
    
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__("RATE_LIMIT_EXCEEDED", message, 429)
        self.name = "RateLimitError"


class DailyLimitExceededError(AgentTalkError):
    """Daily rate limit exceeded error (429)."""
    
    def __init__(self, limit: int, used: int, reset_at: str):
        details = ErrorDetails(limit=limit, used=used, reset_at=reset_at)
        super().__init__("DAILY_LIMIT_EXCEEDED", "Daily rate limit exceeded", 429, details)
        self.name = "DailyLimitExceededError"


class MonthlyLimitExceededError(AgentTalkError):
    """Monthly rate limit exceeded error (429)."""
    
    def __init__(self, limit: int, used: int, reset_at: str):
        details = ErrorDetails(limit=limit, used=used, reset_at=reset_at)
        super().__init__("MONTHLY_LIMIT_EXCEEDED", "Monthly rate limit exceeded", 429, details)
        self.name = "MonthlyLimitExceededError"


class InternalError(AgentTalkError):
    """Internal server error (500)."""
    
    def __init__(self, message: str = "Internal server error"):
        super().__init__("INTERNAL_ERROR", message, 500)
        self.name = "InternalError"


class TTSServiceError(AgentTalkError):
    """Text-to-speech service error (500)."""
    
    def __init__(self, message: str = "Text-to-speech service error"):
        super().__init__("TTS_SERVICE_ERROR", message, 500)
        self.name = "TTSServiceError"


class StorageError(AgentTalkError):
    """Storage operation failed error (500)."""
    
    def __init__(self, operation: str):
        details = ErrorDetails(operation=operation)
        super().__init__("STORAGE_ERROR", "Storage operation failed", 500, details)
        self.name = "StorageError"


class NotImplementedError(AgentTalkError):
    """Feature not implemented error (501)."""
    
    def __init__(self, feature: str):
        super().__init__("NOT_IMPLEMENTED", f"{feature} is not implemented", 501)
        self.name = "NotImplementedError"


class ServiceUnavailableError(AgentTalkError):
    """Service unavailable error (503)."""
    
    def __init__(self, message: str = "Service unavailable"):
        super().__init__("SERVICE_UNAVAILABLE", message, 503)
        self.name = "ServiceUnavailableError"


def create_error_from_response(status_code: int, error_response: dict) -> AgentTalkError:
    """Create appropriate error from API response."""
    error_data = error_response.get("error", {})
    code = error_data.get("code", "INTERNAL_ERROR")
    message = error_data.get("message", "Unknown error")
    details_data = error_data.get("details", {})
    
    details = ErrorDetails(**details_data) if details_data else None
    
    error_map = {
        # Validation errors
        "VALIDATION_ERROR": lambda: ValidationError(message, details),
        "INVALID_INPUT": lambda: InvalidInputError(
            details_data.get("field", "unknown"),
            details_data.get("reason", message),
            details_data.get("provided_type")
        ),
        "MISSING_FIELD": lambda: MissingFieldError(details_data.get("field", "unknown")),
        "INVALID_VOICE": lambda: InvalidVoiceError(
            details_data.get("requested_voice", ""),
            details_data.get("available_voices", [])
        ),
        
        # Authentication errors
        "UNAUTHORIZED": lambda: UnauthorizedError(message),
        "MISSING_API_KEY": lambda: MissingApiKeyError(),
        "INVALID_API_KEY": lambda: InvalidApiKeyError(),
        "EXPIRED_TOKEN": lambda: ExpiredTokenError(),
        
        # Authorization errors
        "FORBIDDEN": lambda: ForbiddenError(message),
        "INSUFFICIENT_TIER": lambda: InsufficientTierError(
            details_data.get("required_tier", ""),
            details_data.get("current_tier", "")
        ),
        "REVOKED_KEY": lambda: RevokedKeyError(),
        
        # Not found errors
        "NOT_FOUND": lambda: NotFoundError(message),
        "MEMO_NOT_FOUND": lambda: MemoNotFoundError(details_data.get("field", "")),
        
        # Rate limiting errors
        "RATE_LIMIT_EXCEEDED": lambda: RateLimitError(message),
        "DAILY_LIMIT_EXCEEDED": lambda: DailyLimitExceededError(
            details_data.get("limit", 0),
            details_data.get("used", 0),
            details_data.get("reset_at", "")
        ),
        "MONTHLY_LIMIT_EXCEEDED": lambda: MonthlyLimitExceededError(
            details_data.get("limit", 0),
            details_data.get("used", 0),
            details_data.get("reset_at", "")
        ),
        
        # Server errors
        "INTERNAL_ERROR": lambda: InternalError(message),
        "TTS_SERVICE_ERROR": lambda: TTSServiceError(message),
        "STORAGE_ERROR": lambda: StorageError(details_data.get("operation", "unknown")),
        
        # Not implemented
        "NOT_IMPLEMENTED": lambda: NotImplementedError(message),
        
        # Service unavailable
        "SERVICE_UNAVAILABLE": lambda: ServiceUnavailableError(message),
    }
    
    error_factory = error_map.get(code)
    if error_factory:
        return error_factory()
    
    return AgentTalkError(code, message, status_code, details)