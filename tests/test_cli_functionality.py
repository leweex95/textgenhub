"""
Test CLI functionality for TextGenHub
"""
import sys
import json
from pathlib import Path
from unittest.mock import patch, MagicMock, AsyncMock
import pytest

from textgenhub.cli import run_provider_old, run_chatgpt_extension, main

# Add src directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


class TestCLIFunctionality:
    """Test CLI core functions"""

    def test_run_provider_old_json_output(self):
        """Test run_provider_old with JSON output format"""
        # Mock subprocess.run to return JSON output
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '{"response": "Test response", "html": "<p>Test</p>"}'
        mock_result.stderr = ""

        with patch('subprocess.run', return_value=mock_result):
            response, html = run_provider_old('chatgpt', 'test prompt', True, 'json')

        assert response == "Test response"
        assert html == "<p>Test</p>"

    def test_run_provider_old_html_output(self):
        """Test run_provider_old with HTML output format"""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = '<div>Test HTML</div>'
        mock_result.stderr = ""

        with patch('subprocess.run', return_value=mock_result):
            response, html = run_provider_old('chatgpt', 'test prompt', True, 'html')

        assert response == '<div>Test HTML</div>'
        assert html == ""

    def test_run_provider_old_subprocess_error(self):
        """Test run_provider_old handles subprocess errors"""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = "Node.js error occurred"

        with patch('subprocess.run', return_value=mock_result):
            with pytest.raises(Exception, match="Chatgpt old method failed"):
                run_provider_old('chatgpt', 'test prompt', True, 'json')

    def test_run_provider_old_unknown_provider(self):
        """Test run_provider_old with unknown provider"""
        with pytest.raises(ValueError, match="Unknown provider: unknown"):
            run_provider_old('unknown', 'test prompt', True, 'json')

    @patch('websockets.connect')
    def test_run_chatgpt_extension_success(self, mock_connect):
        """Test successful WebSocket connection for ChatGPT extension"""
        # Mock the WebSocket connection
        mock_websocket = AsyncMock()
        mock_connect.return_value.__aenter__.return_value = mock_websocket
        mock_connect.return_value.__aexit__.return_value = None

        # Mock the response
        mock_websocket.recv.return_value = json.dumps({
            'type': 'response',
            'response': 'Extension response',
            'html': '<p>Extension HTML</p>'
        })

        response, html = run_chatgpt_extension('test message', 120, 'json')

        assert response == 'Extension response'
        assert html == '<p>Extension HTML</p>'

    @patch('websockets.connect')
    def test_run_chatgpt_extension_error_response(self, mock_connect):
        """Test ChatGPT extension error response"""
        mock_websocket = AsyncMock()
        mock_connect.return_value.__aenter__.return_value = mock_websocket
        mock_connect.return_value.__aexit__.return_value = None

        mock_websocket.recv.return_value = json.dumps({
            'type': 'error',
            'message': 'Extension error'
        })

        with pytest.raises(Exception, match="Extension error"):
            run_chatgpt_extension('test message', 120, 'json')

    @patch('websockets.connect')
    def test_run_chatgpt_extension_connection_refused(self, mock_connect):
        """Test ChatGPT extension connection refused"""
        mock_connect.side_effect = ConnectionRefusedError()

        with pytest.raises(Exception, match="Could not connect to server"):
            run_chatgpt_extension('test message', 120, 'json')

    @patch('websockets.connect')
    def test_run_chatgpt_extension_timeout(self, mock_connect):
        """Test ChatGPT extension timeout"""
        import asyncio
        mock_websocket = AsyncMock()
        mock_connect.return_value.__aenter__.return_value = mock_websocket
        mock_connect.return_value.__aexit__.return_value = None

        # Mock timeout
        mock_websocket.recv.side_effect = asyncio.TimeoutError()

        with pytest.raises(Exception, match="Timeout waiting for response"):
            run_chatgpt_extension('test message', 120, 'json')


class TestCLIIntegration:
    """Test CLI command line interface"""

    def test_cli_no_provider(self):
        """Test CLI with no provider specified"""
        with patch('sys.argv', ['textgenhub']):
            with patch('argparse.ArgumentParser.print_help') as mock_help:
                with pytest.raises(SystemExit):
                    main()
                mock_help.assert_called_once()

    @patch('textgenhub.cli.run_chatgpt_extension')
    def test_cli_chatgpt_extension_mode(self, mock_run_extension):
        """Test CLI ChatGPT in extension mode"""
        mock_run_extension.return_value = ('Response text', '<p>HTML</p>')

        with patch('sys.argv', ['textgenhub', 'chatgpt', '--prompt', 'test prompt']):
            main()

        # Verify extension method was called
        mock_run_extension.assert_called_once_with('test prompt', 120, 'json')

    @patch('textgenhub.cli.run_chatgpt_old')
    def test_cli_chatgpt_old_mode(self, mock_run_old):
        """Test CLI ChatGPT in old mode"""
        mock_run_old.return_value = ('Response text', '<p>HTML</p>')

        with patch('sys.argv', ['textgenhub', 'chatgpt', '--prompt', 'test prompt', '--old']):
            main()

        mock_run_old.assert_called_once_with('test prompt', True, 'json')

    @patch('textgenhub.cli.run_provider_old')
    def test_cli_deepseek_html_output(self, mock_run_old):
        """Test CLI DeepSeek with HTML output"""
        mock_run_old.return_value = ('Response text', '<div>HTML</div>')

        with patch('sys.argv', ['textgenhub', 'deepseek', '--prompt', 'test prompt', '--output-format', 'html']):
            main()

        mock_run_old.assert_called_once_with('deepseek', 'test prompt', True, 'html')

    @patch('textgenhub.cli.run_provider_old')
    def test_cli_perplexity_json_output(self, mock_run_old):
        """Test CLI Perplexity with JSON output"""
        mock_run_old.return_value = ('Response text', '<p>HTML</p>')

        with patch('sys.argv', ['textgenhub', 'perplexity', '--prompt', 'test prompt']):
            main()

        mock_run_old.assert_called_once_with('perplexity', 'test prompt', True, 'json')

    @patch('textgenhub.cli.run_provider_old')
    def test_cli_grok_headless_false(self, mock_run_old):
        """Test CLI Grok with headless disabled"""
        mock_run_old.return_value = ('Response text', '<p>HTML</p>')

        with patch('sys.argv', ['textgenhub', 'grok', '--prompt', 'test prompt', '--headless']):
            main()

        mock_run_old.assert_called_once_with('grok', 'test prompt', True, 'json')


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
