#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest  # noqa: E402

from textgenhub.chatgpt_extension_cli.cli.error_handler import ChromeNotRunningError, categorize_error, get_error_message, RetryStrategy  # noqa: E402

"""
Unit tests for error handling
"""


class TestErrorHandling:
    """Test error categorization and handling"""

    def test_chrome_not_running_error(self):
        """Test Chrome not running error"""
        error = ChromeNotRunningError()
        assert error.error_type == "chrome_not_running"
        assert error.is_recoverable is True

    def test_categorize_chrome_not_running(self):
        """Test categorizing Chrome error"""
        result = categorize_error("Chrome is not running")
        assert result == "chrome_not_running"

    def test_categorize_server_not_running(self):
        """Test categorizing server error"""
        result = categorize_error("connection refused server")
        assert result == "server_not_running"

    def test_categorize_extension_not_connected(self):
        """Test categorizing extension error"""
        result = categorize_error("extension not connected")
        assert result == "extension_not_connected"

    def test_categorize_tab_missing(self):
        """Test categorizing tab missing error"""
        result = categorize_error("tab not found missing")
        assert result == "chatgpt_tab_missing"

    def test_categorize_response_timeout(self):
        """Test categorizing timeout error"""
        result = categorize_error("timeout waiting for response")
        assert result == "response_timeout"

    def test_get_error_message(self):
        """Test getting error message"""
        msg = get_error_message("chrome_not_installed")
        assert "Chrome" in msg["title"]
        assert "recovery" in msg
        assert "action" in msg

    def test_retry_strategy_should_retry(self):
        """Test retry strategy"""
        strategy = RetryStrategy(max_attempts=3)

        # Should retry for transient errors up to max_attempts
        assert strategy.should_retry("response_timeout", 0) is True
        assert strategy.should_retry("response_timeout", 1) is True
        assert strategy.should_retry("response_timeout", 2) is True
        assert strategy.should_retry("response_timeout", 3) is False  # Exceeds max_attempts

        # Should not retry for permanent errors
        assert strategy.should_retry("chrome_not_installed", 0) is False

    def test_retry_strategy_backoff(self):
        """Test exponential backoff calculation"""
        strategy = RetryStrategy(base_delay=1.0, backoff=2.0)

        assert strategy.get_delay(0) == 1.0
        assert strategy.get_delay(1) == 2.0
        assert strategy.get_delay(2) == 4.0
        assert strategy.get_delay(3) == 8.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
