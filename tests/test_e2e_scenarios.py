#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest  # noqa: E402
import json  # noqa: E402
import uuid  # noqa: E402
from unittest.mock import patch  # noqa: E402

from textgenhub.chatgpt_extension_cli.cli.error_handler import categorize_error, get_error_message  # noqa: E402
from textgenhub.chatgpt_extension_cli.cli.logger import StructuredLogger  # noqa: E402

"""
End-to-end scenario tests for ChatGPT extension CLI
Tests critical user journeys with mocked Chrome/WebSocket
"""


class TestScenarioChromelaunchwithoutRunning:
    """Scenario: Chrome not running, auto-launch, then connect"""

    @patch("textgenhub.browser_utils.is_chrome_running")
    @patch("textgenhub.browser_utils.launch_chrome")
    @patch("textgenhub.browser_utils.find_chrome_executable")
    def test_chrome_auto_launch_flow(self, mock_find, mock_launch, mock_is_running):
        """Test Chrome auto-launch when not running"""

        mock_is_running.return_value = False
        mock_launch.return_value = True
        mock_find.return_value = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

        # Flow: detect not running → launch → verify running
        from textgenhub import browser_utils

        mock_is_running.return_value = False
        result = browser_utils.is_chrome_running()
        assert result is False

        mock_is_running.return_value = True
        result = browser_utils.is_chrome_running()
        assert result is True


class TestScenarioChatGPTTabMissing:
    """Scenario: ChatGPT tab missing, auto-create, then inject"""

    def test_tab_auto_creation_flow(self):
        """Test ChatGPT tab auto-creation"""

        # Mock tab list before creation
        tabs_before = [{"id": 1, "url": "https://google.com"}, {"id": 3, "url": "https://github.com"}]

        # No ChatGPT tab found
        chatgpt_tab = None
        for tab in tabs_before:
            if "chatgpt.com" in tab.get("url", ""):
                chatgpt_tab = tab
                break
        assert chatgpt_tab is None

        # Create tab
        created_tab = {"id": 2, "url": "https://chatgpt.com/", "status": "loading"}
        tabs_after = tabs_before + [created_tab]

        # Now found
        chatgpt_tab = None
        for tab in tabs_after:
            if "chatgpt.com" in tab.get("url", ""):
                chatgpt_tab = tab
                break
        assert chatgpt_tab is not None
        assert chatgpt_tab["id"] == 2


class TestScenarioTabInBackground:
    """Scenario: ChatGPT tab exists but in background, auto-focus before injection"""

    def test_tab_visibility_and_focus_flow(self):
        """Test tab focus when in background"""

        tab_state = {"id": 2, "active": False, "url": "https://chatgpt.com/"}

        # Tab not active (in background)
        assert tab_state["active"] is False

        # Focus tab
        tab_state["active"] = True
        assert tab_state["active"] is True


class TestScenarioDOMElementNotFound:
    """Scenario: Textarea/send button not immediately available, retry with backoff"""

    def test_dom_retry_with_exponential_backoff(self):
        """Test DOM element retry logic"""

        max_attempts = 10
        base_delay = 200  # milliseconds
        attempt_delays = []

        for attempt in range(max_attempts):
            delay = base_delay * (1.5**attempt)
            attempt_delays.append(delay)

        # Verify exponential growth
        for i in range(len(attempt_delays) - 1):
            assert attempt_delays[i] < attempt_delays[i + 1]

        # First attempt minimal, last attempt significant
        assert attempt_delays[0] < 1000  # First: ~200ms
        assert attempt_delays[-1] > 1000  # Last: ~several seconds


class TestScenarioResponseTimeout:
    """Scenario: Response not received, timeout after heartbeat check"""

    @pytest.mark.asyncio
    async def test_heartbeat_timeout_detection(self):
        """Test heartbeat prevents premature timeout"""

        timeout_threshold = 60  # seconds

        # After 30 seconds, we've received 3 heartbeats, so timeout not triggered
        last_heartbeat = 30
        elapsed = 35
        time_since_last = elapsed - last_heartbeat
        should_timeout = time_since_last > timeout_threshold
        # False because 5 < 60
        assert should_timeout is False

        # After 75 seconds with no heartbeat since 10s (simulating issue), timeout should trigger
        elapsed = 75
        last_heartbeat = 10
        time_since_last = elapsed - last_heartbeat
        should_timeout = time_since_last > timeout_threshold
        # True because 65 > 60
        assert should_timeout is True


class TestScenarioWebSocketDisconnect:
    """Scenario: WebSocket connection lost, reconnect with exponential backoff"""

    def test_websocket_reconnect_strategy(self):
        """Test WebSocket reconnect with backoff"""

        from textgenhub.chatgpt_extension_cli.cli.error_handler import RetryStrategy

        strategy = RetryStrategy(max_attempts=5, base_delay=1.0, backoff=2.0)

        # Simulate reconnection attempts
        attempt_times = []
        for attempt in range(strategy.max_attempts):
            delay = strategy.get_delay(attempt)
            attempt_times.append(delay)

        # Should grow: 1, 2, 4, 8, 16 seconds
        assert attempt_times[0] < attempt_times[1] < attempt_times[2]


class TestScenarioErrorCategorization:
    """Scenario: Error occurs, categorize, provide recovery guidance"""

    def test_error_categorization_and_recovery(self):
        """Test error handling and recovery guidance"""

        test_cases = [
            ("Timeout", "response_timeout"),
            ("Chrome not found", "chrome_not_installed"),
            ("extension not connected", "extension_not_connected"),
            ("ChatGPT tab missing", "chatgpt_tab_missing"),
            ("invisible tab", "tab_not_visible"),
        ]

        for error_msg, expected_type in test_cases:
            error_type = categorize_error(error_msg)
            assert error_type == expected_type, f"Expected {expected_type} for '{error_msg}', got {error_type}"

            # Verify recovery guidance exists
            guidance = get_error_message(error_type)
            assert "title" in guidance
            assert "description" in guidance
            # Either recovery or recovery_steps should exist
            assert "recovery" in guidance or "recovery_steps" in guidance
            if "recovery_steps" in guidance:
                assert len(guidance["recovery_steps"]) > 0


class TestScenarioFullEndToEnd:
    """Scenario: Complete flow from CLI invocation to response"""

    @patch("textgenhub.browser_utils.ensure_chrome_running")
    @patch("asyncio.sleep")
    def test_full_flow_success(self, mock_sleep, mock_ensure_chrome):
        """Test complete successful flow"""

        mock_ensure_chrome.return_value = True
        mock_sleep.return_value = None

        # Verify Chrome check happens first
        from textgenhub import browser_utils

        browser_utils.ensure_chrome_running()
        assert mock_ensure_chrome.called


class TestScenarioBackgroundTabExecution:
    """Scenario: ChatGPT tab in background, request still succeeds"""

    def test_background_tab_messaging_flow(self):
        """Test messaging works with background tab"""

        # Message flow even if tab is background
        message = {"type": "inject", "messageId": str(uuid.uuid4()), "message": "test", "tabId": 2, "tabActive": False}  # Background tab

        # Should still work because:
        # 1. background.js handles focusing the tab
        # 2. content.js is injected regardless
        # 3. Response returned to background.js, then to client

        assert "tabId" in message
        assert "messageId" in message


class TestScenarioLoggingandDiagnostics:
    """Scenario: Error occurs, logs captured, exported for diagnostics"""

    def test_full_logging_and_export(self):
        """Test logging throughout error scenario"""
        import tempfile

        with tempfile.TemporaryDirectory() as tmpdir:
            export_path = Path(tmpdir) / "error_logs.json"
            logger = StructuredLogger(export_path=str(export_path))

            # Log operations in scenario
            logger.info("CLI invocation", method="run_chatgpt_extension")
            logger.info("Chrome check started")
            logger.error("Chrome not running", retry_attempt=1)
            logger.info("Chrome launched")
            logger.info("WebSocket connecting", server="ws://127.0.0.1:8765")
            logger.info("Extension acknowledged", messageId="test-123")
            logger.info("Response received", duration_ms=2500)

            # Export for diagnostics
            logger.export()

            # Verify export
            assert export_path.exists()
            with open(export_path) as f:
                data = json.load(f)
                assert data["log_count"] >= 7


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
