"""Tests for Agent Talk Python SDK."""

import pytest
from agent_talk import AgentTalk, __version__
from agent_talk.errors import (
    AgentTalkError,
    InvalidVoiceError,
    MissingApiKeyError,
    create_error_from_response,
)


def test_version():
    """Test that version is defined."""
    assert __version__ == "1.0.0"


def test_client_initialization():
    """Test client initialization with default values."""
    client = AgentTalk()
    assert client.get_base_url() == "https://talk.onhyper.io"


def test_client_initialization_with_api_key():
    """Test client initialization with API key."""
    client = AgentTalk(api_key="at_live_test123")
    assert client.get_base_url() == "https://talk.onhyper.io"


def test_client_initialization_with_custom_url():
    """Test client initialization with custom base URL."""
    client = AgentTalk(base_url="http://localhost:3000")
    assert client.get_base_url() == "http://localhost:3000"


def test_create_error_from_response():
    """Test error creation from API response."""
    error_response = {
        "error": {
            "code": "INVALID_VOICE",
            "message": "Invalid voice: invalid",
            "details": {
                "requestedVoice": "invalid",
                "availableVoices": ["rachel", "domi", "adam"]
            }
        }
    }
    
    error = create_error_from_response(400, error_response)
    assert isinstance(error, InvalidVoiceError)
    assert error.code == "INVALID_VOICE"
    assert "invalid" in error.message


def test_create_error_from_response_unknown_code():
    """Test error creation with unknown error code."""
    error_response = {
        "error": {
            "code": "UNKNOWN_ERROR",
            "message": "Something went wrong"
        }
    }
    
    error = create_error_from_response(500, error_response)
    assert isinstance(error, AgentTalkError)
    assert error.code == "UNKNOWN_ERROR"
    assert error.message == "Something went wrong"


def test_missing_api_key_error():
    """Test missing API key error."""
    error_response = {
        "error": {
            "code": "MISSING_API_KEY",
            "message": "API key is required"
        }
    }
    
    error = create_error_from_response(401, error_response)
    assert isinstance(error, MissingApiKeyError)
    assert error.status_code == 401