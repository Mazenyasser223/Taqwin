"""Shared pytest fixtures for ai-service."""

from unittest.mock import patch

import pytest

_MINIMAL_CAG = {
    "locale": "en",
    "generatedAt": "2026-01-01T00:00:00Z",
    "profile": {"displayName": "Test Athlete"},
}


@pytest.fixture(autouse=True)
def _mock_cag_fetch_unless_disabled(request):
    """Avoid live Node calls when tests omit contextBundle."""
    if request.node.get_closest_marker("live_cag_fetch"):
        yield
        return
    with patch("app.routers.chat.fetch_context_bundle", return_value=_MINIMAL_CAG) as mock:
        yield mock
