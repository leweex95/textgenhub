#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

import pytest  # noqa: E402
from unittest.mock import patch, MagicMock  # noqa: E402

from textgenhub.browser_utils import find_chrome_executable, is_chrome_running, launch_chrome, ensure_chrome_running  # noqa: E402

"""
Unit tests for ChatGPT extension CLI - Browser utilities
"""


class TestBrowserUtilities:
    """Test browser detection and launch utilities"""

    def test_find_chrome_executable_not_installed(self):
        """Test finding Chrome when not installed"""
        with patch("textgenhub.browser_utils.Path.exists", return_value=False):
            result = find_chrome_executable()
            assert result is None

    def test_find_chrome_executable_installed(self):
        """Test finding Chrome when installed"""
        with patch("textgenhub.browser_utils.Path.exists", return_value=True):
            result = find_chrome_executable()
            # Should find one of the paths
            assert result is not None

    def test_is_chrome_running_true(self):
        """Test Chrome running detection when it's running"""
        mock_result = MagicMock()
        mock_result.stdout = "chrome.exe is running"

        with patch("textgenhub.browser_utils.subprocess.run", return_value=mock_result):
            result = is_chrome_running()
            assert result is True

    def test_is_chrome_running_false(self):
        """Test Chrome running detection when it's not running"""
        mock_result = MagicMock()
        mock_result.stdout = "no chrome process"

        with patch("textgenhub.browser_utils.subprocess.run", return_value=mock_result):
            result = is_chrome_running()
            assert result is False

    @patch("textgenhub.browser_utils.is_chrome_running")
    @patch("textgenhub.browser_utils.find_chrome_executable")
    def test_launch_chrome_already_running(self, mock_find, mock_is_running):
        """Test launching Chrome when already running"""
        mock_is_running.return_value = True

        result = launch_chrome()
        assert result is True

    @patch("textgenhub.browser_utils.is_chrome_running")
    @patch("textgenhub.browser_utils.find_chrome_executable")
    def test_launch_chrome_not_found(self, mock_find, mock_is_running):
        """Test launching Chrome when not installed"""
        mock_find.return_value = None

        with pytest.raises(FileNotFoundError):
            launch_chrome()

    @patch("textgenhub.browser_utils.is_chrome_running")
    def test_ensure_chrome_running(self, mock_is_running):
        """Test ensure Chrome is running"""
        mock_is_running.return_value = True

        result = ensure_chrome_running()
        assert result is True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
