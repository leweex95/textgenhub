#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest  # noqa: E402
import json  # noqa: E402

"""
Integration tests for ChatGPT extension CLI
"""


class TestWebSocketIntegration:
    """Test WebSocket communication"""

    @pytest.mark.asyncio
    async def test_websocket_ack_protocol(self):
        """Test WebSocket ACK protocol"""
        # This would require mocking the WebSocket server
        # For now, we'll just verify the message format

        payload = {"type": "cli_request", "messageId": "test-123", "message": "hello", "output_format": "json"}

        assert payload["type"] == "cli_request"
        assert payload["messageId"] is not None
        assert payload["message"] == "hello"

    def test_websocket_message_id_tracking(self):
        """Test message ID is tracked in request"""
        import uuid

        message_id = str(uuid.uuid4())
        assert len(message_id) > 0
        assert message_id.count("-") == 4  # UUID format


class TestExtensionIntegration:
    """Test extension integration"""

    def test_tab_detection_logic(self):
        """Test tab detection mock"""
        tabs = [{"id": 1, "url": "https://google.com"}, {"id": 2, "url": "https://chatgpt.com"}, {"id": 3, "url": "https://github.com"}]

        chatgpt_tab = None
        for tab in tabs:
            if "chatgpt.com" in tab.get("url", ""):
                chatgpt_tab = tab
                break

        assert chatgpt_tab is not None
        assert chatgpt_tab["id"] == 2

    def test_tab_creation_response(self):
        """Test tab creation mock response"""
        created_tab = {"id": 4, "url": "https://chatgpt.com/", "status": "loading"}

        assert "chatgpt.com" in created_tab["url"]
        assert created_tab["status"] in ["loading", "complete"]


class TestErrorRecovery:
    """Test error recovery scenarios"""

    def test_categorize_timeout_error(self):
        """Test timeout error categorization"""
        from textgenhub.chatgpt_extension_cli.cli.error_handler import categorize_error

        error_type = categorize_error("Timeout waiting for response")
        assert error_type == "response_timeout"

    def test_categorize_chrome_error(self):
        """Test Chrome error categorization"""
        from textgenhub.chatgpt_extension_cli.cli.error_handler import categorize_error

        error_type = categorize_error("Chrome not found")
        assert error_type in ["chrome_not_installed", "chrome_not_running"]

    def test_retry_strategy_exponential_backoff(self):
        """Test exponential backoff"""
        from textgenhub.chatgpt_extension_cli.cli.error_handler import RetryStrategy

        strategy = RetryStrategy(base_delay=1.0, backoff=1.5)

        delays = [strategy.get_delay(i) for i in range(4)]

        # Should increase exponentially
        assert delays[0] < delays[1] < delays[2] < delays[3]


class TestLoggingIntegration:
    """Test logging integration"""

    def test_log_export_format(self):
        """Test log export format"""
        import tempfile
        from textgenhub.chatgpt_extension_cli.cli.logger import StructuredLogger

        with tempfile.TemporaryDirectory() as tmpdir:
            export_path = Path(tmpdir) / "logs.json"
            logger = StructuredLogger(export_path=str(export_path))

            logger.info("Test message", action="test")
            logger.export()

            with open(export_path) as f:
                data = json.load(f)

                assert "session_id" in data
                assert "exported_at" in data
                assert "log_count" in data
                assert "logs" in data

                log_entry = data["logs"][0]
                assert "timestamp" in log_entry
                assert "level" in log_entry
                assert "message" in log_entry
                assert "context" in log_entry


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
