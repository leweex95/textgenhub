"""
Extended comprehensive tests for SimpleProvider core module
Tests command building, subprocess handling, error scenarios, and edge cases
"""
import pytest
from unittest.mock import patch, MagicMock, call
from pathlib import Path
from textgenhub.core.provider import SimpleProvider


class TestSimpleProviderInitialization:
    """Test SimpleProvider initialization and configuration"""

    def test_init_chatgpt_provider(self):
        """Test initialization for ChatGPT provider"""
        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        assert provider.provider_name == "chatgpt"
        assert provider.cli_script.name == "chatgpt_cli.js"
        assert provider.node_path == "node"

    def test_init_deepseek_provider(self):
        """Test initialization for DeepSeek provider"""
        provider = SimpleProvider("deepseek", "deepseek_cli.js")
        assert provider.provider_name == "deepseek"
        assert provider.cli_script.name == "deepseek_cli.js"

    def test_init_perplexity_provider(self):
        """Test initialization for Perplexity provider"""
        provider = SimpleProvider("perplexity", "perplexity_cli.js")
        assert provider.provider_name == "perplexity"
        assert provider.cli_script.name == "perplexity_cli.js"

    def test_init_grok_provider(self):
        """Test initialization for Grok provider"""
        provider = SimpleProvider("grok", "grok_cli.js")
        assert provider.provider_name == "grok"
        assert provider.cli_script.name == "grok_cli.js"

    def test_init_cli_script_path_resolves_correctly(self):
        """Test CLI script path is resolved relative to provider directory"""
        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        assert isinstance(provider.cli_script, Path)
        assert "chatgpt" in str(provider.cli_script)
        assert "chatgpt_cli.js" in str(provider.cli_script)


class TestSimpleProviderChatGPTCommandBuilding:
    """Test command building specifically for ChatGPT (attach-based) provider"""

    @patch("subprocess.Popen")
    def test_chatgpt_command_with_prompt_only(self, mock_popen):
        """Test ChatGPT command building with just prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test prompt")

        call_args = mock_popen.call_args[0][0]
        assert call_args[0] == "node"
        assert "--prompt" in call_args
        assert "test prompt" in call_args
        assert "--timeout" in call_args
        assert "120" in call_args  # default timeout

    @patch("subprocess.Popen")
    def test_chatgpt_command_excludes_headless_flag(self, mock_popen):
        """Test ChatGPT command does NOT include --headless flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", headless=True)

        call_args = mock_popen.call_args[0][0]
        assert "--headless" not in call_args

    @patch("subprocess.Popen")
    def test_chatgpt_command_excludes_remove_cache_flag(self, mock_popen):
        """Test ChatGPT command does NOT include --remove-cache flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", remove_cache=True)

        call_args = mock_popen.call_args[0][0]
        assert "--remove-cache" not in call_args

    @patch("subprocess.Popen")
    def test_chatgpt_command_with_debug_flag(self, mock_popen):
        """Test ChatGPT command with debug flag (no value)"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", debug=True)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" in call_args
        # For attach-based, debug is just a flag, not --debug true
        debug_index = call_args.index("--debug")
        # Next element should not be "true"
        if debug_index + 1 < len(call_args):
            assert call_args[debug_index + 1] != "true"

    @patch("subprocess.Popen")
    def test_chatgpt_command_without_debug_flag(self, mock_popen):
        """Test ChatGPT command without debug flag when debug=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", debug=False)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" not in call_args

    @patch("subprocess.Popen")
    def test_chatgpt_command_with_custom_timeout(self, mock_popen):
        """Test ChatGPT command with custom timeout"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", timeout=300)

        call_args = mock_popen.call_args[0][0]
        timeout_index = call_args.index("--timeout")
        assert call_args[timeout_index + 1] == "300"

    @patch("subprocess.Popen")
    def test_chatgpt_command_with_typing_speed(self, mock_popen):
        """Test ChatGPT command with typing speed"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", typing_speed=0.05)

        call_args = mock_popen.call_args[0][0]
        assert "--typing-speed" in call_args
        typing_speed_index = call_args.index("--typing-speed")
        assert call_args[typing_speed_index + 1] == "0.05"

    @patch("subprocess.Popen")
    def test_chatgpt_command_without_typing_speed(self, mock_popen):
        """Test ChatGPT command without typing speed flag when typing_speed=None"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", typing_speed=None)

        call_args = mock_popen.call_args[0][0]
        assert "--typing-speed" not in call_args


class TestSimpleProviderLegacyCommandBuilding:
    """Test command building for legacy providers (DeepSeek, Perplexity, Grok)"""

    @patch("subprocess.Popen")
    def test_legacy_command_includes_headless_flag(self, mock_popen):
        """Test legacy providers include --headless flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("deepseek", "deepseek_cli.js")
        provider.ask("test", headless=True)

        call_args = mock_popen.call_args[0][0]
        assert "--headless" in call_args
        headless_index = call_args.index("--headless")
        assert call_args[headless_index + 1] == "true"

    @patch("subprocess.Popen")
    def test_legacy_command_headless_false(self, mock_popen):
        """Test legacy providers with headless=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("deepseek", "deepseek_cli.js")
        provider.ask("test", headless=False)

        call_args = mock_popen.call_args[0][0]
        assert "--headless" in call_args
        headless_index = call_args.index("--headless")
        assert call_args[headless_index + 1] == "false"

    @patch("subprocess.Popen")
    def test_legacy_command_includes_remove_cache_flag(self, mock_popen):
        """Test legacy providers include --remove-cache flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("perplexity", "perplexity_cli.js")
        provider.ask("test", remove_cache=True)

        call_args = mock_popen.call_args[0][0]
        assert "--remove-cache" in call_args
        remove_cache_index = call_args.index("--remove-cache")
        assert call_args[remove_cache_index + 1] == "true"

    @patch("subprocess.Popen")
    def test_legacy_command_remove_cache_false(self, mock_popen):
        """Test legacy providers with remove_cache=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("perplexity", "perplexity_cli.js")
        provider.ask("test", remove_cache=False)

        call_args = mock_popen.call_args[0][0]
        assert "--remove-cache" in call_args
        remove_cache_index = call_args.index("--remove-cache")
        assert call_args[remove_cache_index + 1] == "false"

    @patch("subprocess.Popen")
    def test_legacy_command_debug_flag_with_value(self, mock_popen):
        """Test legacy providers include debug flag with value"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("grok", "grok_cli.js")
        provider.ask("test", debug=True)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" in call_args
        debug_index = call_args.index("--debug")
        # For legacy, debug is --debug true
        assert call_args[debug_index + 1] == "true"

    @patch("subprocess.Popen")
    def test_legacy_command_debug_not_included_when_false(self, mock_popen):
        """Test legacy providers exclude debug flag when debug=False"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("grok", "grok_cli.js")
        provider.ask("test", debug=False)

        call_args = mock_popen.call_args[0][0]
        assert "--debug" not in call_args

    @patch("subprocess.Popen")
    def test_legacy_command_with_typing_speed(self, mock_popen):
        """Test legacy providers with typing speed"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("deepseek", "deepseek_cli.js")
        provider.ask("test", typing_speed=0.1)

        call_args = mock_popen.call_args[0][0]
        assert "--typing-speed" in call_args
        typing_speed_index = call_args.index("--typing-speed")
        assert call_args[typing_speed_index + 1] == "0.1"


class TestSimpleProviderTimeoutHandling:
    """Test timeout parameter handling"""

    @patch("subprocess.Popen")
    def test_default_timeout(self, mock_popen):
        """Test default timeout value is 120"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test")

        call_args = mock_popen.call_args[0][0]
        timeout_index = call_args.index("--timeout")
        assert call_args[timeout_index + 1] == "120"

    @patch("subprocess.Popen")
    def test_custom_timeout_small(self, mock_popen):
        """Test small custom timeout"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", timeout=10)

        call_args = mock_popen.call_args[0][0]
        timeout_index = call_args.index("--timeout")
        assert call_args[timeout_index + 1] == "10"

    @patch("subprocess.Popen")
    def test_custom_timeout_large(self, mock_popen):
        """Test large custom timeout"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", timeout=900)

        call_args = mock_popen.call_args[0][0]
        timeout_index = call_args.index("--timeout")
        assert call_args[timeout_index + 1] == "900"

    @patch("subprocess.Popen")
    def test_timeout_converted_to_string(self, mock_popen):
        """Test timeout is converted to string in command"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test", timeout=250)

        call_args = mock_popen.call_args[0][0]
        timeout_index = call_args.index("--timeout")
        assert isinstance(call_args[timeout_index + 1], str)
        assert call_args[timeout_index + 1] == "250"


class TestSimpleProviderSubprocessHandling:
    """Test subprocess execution and output handling"""

    @patch("subprocess.Popen")
    def test_subprocess_runs_with_correct_cwd(self, mock_popen):
        """Test subprocess runs in correct working directory"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test")

        # Check cwd is set to cli_script parent
        call_kwargs = mock_popen.call_args[1]
        assert "cwd" in call_kwargs
        assert call_kwargs["cwd"] == provider.cli_script.parent

    @patch("subprocess.Popen")
    def test_subprocess_pipes_stdout_and_stderr(self, mock_popen):
        """Test subprocess stdout and stderr are piped"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test")

        call_kwargs = mock_popen.call_args[1]
        assert call_kwargs["stdout"] == -1  # subprocess.PIPE
        assert call_kwargs["stderr"] == -2  # subprocess.STDOUT

    @patch("subprocess.Popen")
    def test_subprocess_waits_for_process(self, mock_popen):
        """Test subprocess.wait() is called"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "test"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        provider.ask("test")

        mock_proc.wait.assert_called_once()

    @patch("subprocess.Popen")
    def test_multiline_output_parsing(self, mock_popen):
        """Test parsing multiline subprocess output"""
        mock_proc = MagicMock()
        output = b'Starting process\nLoading...\n{"response": "success"}\nCleanup'
        mock_proc.stdout.read.return_value = output
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        assert result == "success"

    @patch("subprocess.Popen")
    def test_multiple_json_lines_uses_last(self, mock_popen):
        """Test multiple JSON lines uses the last one"""
        mock_proc = MagicMock()
        output = b'{"response": "first"}\n{"response": "second"}\n{"response": "final"}'
        mock_proc.stdout.read.return_value = output
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        assert result == "final"


class TestSimpleProviderResponseParsing:
    """Test JSON response parsing"""

    @patch("subprocess.Popen")
    def test_response_with_empty_string(self, mock_popen):
        """Test response with empty string value"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": ""}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        assert result == ""

    @patch("subprocess.Popen")
    def test_response_with_json_special_chars(self, mock_popen):
        """Test response containing JSON special characters"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "value with \\"quotes\\" and \\\\backslash"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        # Should contain extracted text (exact format depends on extract_response_json)
        assert result is not None

    @patch("subprocess.Popen")
    def test_response_with_newlines(self, mock_popen):
        """Test response containing newlines"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "line1\\nline2\\nline3"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask("test")
        assert result is not None


class TestSimpleProviderErrorHandling:
    """Test error scenarios and exception handling"""

    @patch("subprocess.Popen")
    def test_stdout_is_none_raises_error(self, mock_popen):
        """Test RuntimeError when subprocess stdout is None"""
        mock_proc = MagicMock()
        mock_proc.stdout = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        with pytest.raises(RuntimeError, match="stdout is None"):
            provider.ask("test")

    @patch("subprocess.Popen")
    def test_no_json_response_raises_error(self, mock_popen):
        """Test RuntimeError when no JSON response in output"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'Invalid output without JSON'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        with pytest.raises(RuntimeError, match="did not produce JSON response"):
            provider.ask("test")

    @patch("subprocess.Popen")
    def test_utf8_decode_error_handled(self, mock_popen):
        """Test UnicodeDecodeError is handled gracefully"""
        mock_proc = MagicMock()
        # Invalid UTF-8 sequence
        mock_proc.stdout.read.return_value = b'{"response": "test\xff\xfe"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        # Should not raise, errors should be replaced
        result = provider.ask("test")
        assert result is not None

    @patch("subprocess.Popen")
    def test_empty_subprocess_output(self, mock_popen):
        """Test empty subprocess output raises error"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b''
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        with pytest.raises(RuntimeError, match="did not produce JSON response"):
            provider.ask("test")


class TestSimpleProviderIntegration:
    """Test realistic integration scenarios"""

    @patch("subprocess.Popen")
    def test_all_parameters_together(self, mock_popen):
        """Test all parameters work together correctly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "full response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result = provider.ask(
            prompt="complex prompt",
            headless=False,
            remove_cache=False,
            debug=True,
            timeout=200,
            typing_speed=0.08
        )
        assert result == "full response"

        call_args = mock_popen.call_args[0][0]
        assert "complex prompt" in call_args
        assert "--debug" in call_args
        assert "--timeout" in call_args
        assert "200" in call_args
        assert "--typing-speed" in call_args
        assert "0.08" in call_args

    @patch("subprocess.Popen")
    def test_sequential_calls(self, mock_popen):
        """Test multiple sequential calls to same provider"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
        result1 = provider.ask("first")
        result2 = provider.ask("second")
        result3 = provider.ask("third")

        assert result1 == "response"
        assert result2 == "response"
        assert result3 == "response"
        assert mock_popen.call_count >= 3
