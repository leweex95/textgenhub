import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from textgenhub.core.provider import SimpleProvider


class TestSimpleProviderInit:
    """Test SimpleProvider initialization"""

    def test_init_basic(self):
        """Test basic initialization with provider name and script"""
        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        assert provider.provider_name == "chatgpt"
        assert isinstance(provider.cli_script, Path)
        assert provider.cli_script.name == "chatgpt_cli.js"
        assert provider.node_path == "node"

    def test_init_various_providers(self):
        """Test initialization with various provider names"""
        for name in ["chatgpt", "deepseek", "perplexity", "grok"]:
            provider = SimpleProvider(name, f"{name}_cli.js")
            assert provider.provider_name == name
            assert provider.cli_script.name == f"{name}_cli.js"


class TestSimpleProviderAsk:
    """Test SimpleProvider.ask() method with various inputs"""

    @patch("subprocess.Popen")
    def test_ask_basic_prompt(self, mock_popen):
        """Test basic prompt handling"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("Hello")
        assert result == "test response"

    @patch("subprocess.Popen")
    def test_ask_empty_prompt(self, mock_popen):
        """Test empty prompt handling"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "empty response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("")
        assert result == "empty response"

    @patch("subprocess.Popen")
    def test_ask_long_prompt(self, mock_popen):
        """Test very long prompt (5000+ characters)"""
        long_prompt = "a" * 5000
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "long response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask(long_prompt)
        assert result == "long response"

    @patch("subprocess.Popen")
    def test_ask_special_chars_prompt(self, mock_popen):
        """Test prompt with special characters"""
        special_prompt = "Hello!@#$%^&*()_+-=[]{}|;:',.<>?/~`"
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "special response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask(special_prompt)
        assert result == "special response"

    @patch("subprocess.Popen")
    def test_ask_unicode_prompt(self, mock_popen):
        """Test unicode characters in prompt"""
        unicode_prompt = "世界 🌍 مرحبا мир"
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "unicode response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask(unicode_prompt)
        assert result == "unicode response"

    @patch("subprocess.Popen")
    def test_ask_with_headless_true(self, mock_popen):
        """Test ask with headless=True"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "headless true"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test", headless=True)
        assert result == "headless true"

        # Verify headless was passed as 'true' string
        call_args = mock_popen.call_args[0][0]
        assert "--headless" in call_args
        assert "true" in call_args

    @patch("subprocess.Popen")
    def test_ask_with_headless_false(self, mock_popen):
        """Test ask with headless=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "headless false"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test", headless=False)
        assert result == "headless false"

        call_args = mock_popen.call_args[0][0]
        assert "--headless" in call_args
        assert "false" in call_args

    @patch("subprocess.Popen")
    def test_ask_all_boolean_flags(self, mock_popen):
        """Test all boolean flag combinations"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "flag response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")

        for headless in [True, False]:
            for remove_cache in [True, False]:
                for debug in [True, False]:
                    result = provider.ask("test", headless, remove_cache, debug)
                    assert result == "flag response"


class TestSimpleProviderErrors:
    """Test SimpleProvider error handling"""

    @patch("subprocess.Popen")
    def test_ask_stdout_none_error(self, mock_popen):
        """Test subprocess stdout is None"""
        mock_proc = MagicMock()
        mock_proc.stdout = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        with pytest.raises(RuntimeError, match="stdout is None"):
            provider.ask("test")

    @patch("subprocess.Popen")
    def test_ask_no_json_in_output(self, mock_popen):
        """Test no JSON response in output"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b"some output without json"
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        with pytest.raises(RuntimeError, match="did not produce JSON response"):
            provider.ask("test")

    @patch("subprocess.Popen")
    def test_ask_unicode_decode_error_handling(self, mock_popen):
        """Test UTF-8 decode error with replacement"""
        mock_proc = MagicMock()
        # Simulate invalid UTF-8 bytes that will be replaced
        invalid_bytes = b'{"response": "test\xff\xfe"}'
        mock_proc.stdout.read.return_value = invalid_bytes
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        # Should handle gracefully with errors='replace'
        result = provider.ask("test")
        assert "test" in result

    @patch("subprocess.Popen")
    def test_ask_empty_response_value(self, mock_popen):
        """Test empty response value in JSON"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": ""}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        # extract_response_json returns empty string, not error
        result = provider.ask("test")
        assert result == ""

    @patch("subprocess.Popen")
    def test_ask_multiple_json_lines(self, mock_popen):
        """Test output with multiple JSON lines - uses last one"""
        mock_proc = MagicMock()
        output = b'debug line\n{"response": "first response"}\n{"response": "second response"}'
        mock_proc.stdout.read.return_value = output
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        # Provider finds last JSON line while iterating, so returns last response
        assert result == "second response"


class TestSimpleProviderCommandBuilding:
    """Test command building in SimpleProvider"""

    @patch("subprocess.Popen")
    def test_command_structure(self, mock_popen):
        """Test command structure and argument order"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("my prompt")

        call_args = mock_popen.call_args[0][0]
        assert call_args[0] == "node"
        assert "--prompt" in call_args
        assert "my prompt" in call_args
        assert "--headless" in call_args
        assert "--remove-cache" in call_args

    @patch("subprocess.Popen")
    def test_debug_flag_included_when_true(self, mock_popen):
        """Test debug flag is included when debug=True"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", debug=True)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" in call_args
        assert "true" in call_args

    @patch("subprocess.Popen")
    def test_debug_flag_not_included_when_false(self, mock_popen):
        """Test debug flag is not included when debug=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", debug=False)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" not in call_args
