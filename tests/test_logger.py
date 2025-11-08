#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402

from textgenhub.chatgpt_extension_cli.cli.logger import StructuredLogger  # noqa: E402

"""
Unit tests for logging
"""


class TestStructuredLogger:
    """Test structured logging"""

    def test_logger_creation(self):
        """Test logger instance creation"""
        logger = StructuredLogger()
        assert logger is not None
        assert len(logger.logs) == 0

    def test_log_info(self):
        """Test logging info level"""
        logger = StructuredLogger()
        logger.info("Test message", key="value")

        assert len(logger.logs) == 1
        assert logger.logs[0]["level"] == "INFO"
        assert logger.logs[0]["message"] == "Test message"
        assert logger.logs[0]["context"]["key"] == "value"

    def test_log_warning(self):
        """Test logging warning level"""
        logger = StructuredLogger()
        logger.warning("Warning message")

        assert len(logger.logs) == 1
        assert logger.logs[0]["level"] == "WARNING"

    def test_log_error(self):
        """Test logging error level"""
        logger = StructuredLogger()
        logger.error("Error message")

        assert len(logger.logs) == 1
        assert logger.logs[0]["level"] == "ERROR"

    def test_logger_export(self):
        """Test exporting logs to file"""
        with tempfile.TemporaryDirectory() as tmpdir:
            export_path = Path(tmpdir) / "logs.json"
            logger = StructuredLogger(export_path=str(export_path))

            logger.info("Test message")
            logger.export()

            assert export_path.exists()

            with open(export_path) as f:
                data = json.load(f)
                assert data["log_count"] == 1
                assert len(data["logs"]) == 1

    def test_logger_summary(self):
        """Test getting log summary"""
        logger = StructuredLogger()
        logger.info("Info 1")
        logger.info("Info 2")
        logger.error("Error 1")

        summary = logger.get_summary()
        assert summary["total"] == 3
        assert summary["by_level"]["INFO"] == 2
        assert summary["by_level"]["ERROR"] == 1

    def test_global_logger(self):
        """Test global logger instance"""
        import importlib
        from textgenhub.chatgpt_extension_cli.cli import logger as logger_module

        importlib.reload(logger_module)  # Reset global

        logger1 = logger_module.get_logger()
        logger2 = logger_module.get_logger()

        assert logger1 is logger2  # Same instance


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
