"""
Comprehensive tests for ChatGPT module (new attach-based implementation)
"""
import pytest
from unittest.mock import patch, MagicMock, call
from pathlib import Path
from textgenhub.chatgpt import ChatGPT, ask


class TestChatGPTAskFunction:
    """Test the ask() function in chatgpt module"""

    @patch("subprocess.Popen")
    def test_ask_basic_functionality(self, mock_popen):
        """Test basic ask() function with simple prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "Hello, this is ChatGPT"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Hello")
        assert result == "Hello, this is ChatGPT"

    @patch("subprocess.Popen")
    def test_ask_with_default_parameters(self, mock_popen):
        """Test ask() uses correct default parameter values"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        ask("test prompt")

        # Verify command construction with defaults
        call_args = mock_popen.call_args[0][0]
        assert "--timeout" in call_args
        assert "120" in call_args  # default timeout
        assert "--debug" not in call_args  # debug defaults to False

    @patch("subprocess.Popen")
    def test_ask_with_debug_true(self, mock_popen):
        """Test ask() with debug=True includes debug flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "debug response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test", debug=True)
        assert result == "debug response"

        call_args = mock_popen.call_args[0][0]
        assert "--debug" in call_args

    @patch("subprocess.Popen")
    def test_ask_with_debug_false(self, mock_popen):
        """Test ask() with debug=False does not include debug flag"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "no debug"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test", debug=False)
        assert result == "no debug"

        call_args = mock_popen.call_args[0][0]
        assert "--debug" not in call_args

    @patch("subprocess.Popen")
    def test_ask_with_custom_timeout(self, mock_popen):
        """Test ask() with custom timeout value"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        ask("test", timeout=300)

        call_args = mock_popen.call_args[0][0]
        assert "--timeout" in call_args
        assert "300" in call_args

    @patch("subprocess.Popen")
    def test_ask_with_typing_speed_none(self, mock_popen):
        """Test ask() with typing_speed=None (default instant paste)"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "instant"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test", typing_speed=None)
        assert result == "instant"

        call_args = mock_popen.call_args[0][0]
        assert "--typing-speed" not in call_args

    @patch("subprocess.Popen")
    def test_ask_with_typing_speed_value(self, mock_popen):
        """Test ask() with specific typing speed value"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "typed"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test", typing_speed=0.05)
        assert result == "typed"

        call_args = mock_popen.call_args[0][0]
        assert "--typing-speed" in call_args
        assert "0.05" in call_args

    @patch("subprocess.Popen")
    def test_ask_headless_parameter_ignored(self, mock_popen):
        """Test that headless parameter is ignored for attach-based CLI"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        # Pass headless parameter but verify it's not used in command
        ask("test", headless=True)

        call_args = mock_popen.call_args[0][0]
        assert "--headless" not in call_args

    @patch("subprocess.Popen")
    def test_ask_remove_cache_parameter_ignored(self, mock_popen):
        """Test that remove_cache parameter is ignored for attach-based CLI"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        # Pass remove_cache parameter but verify it's not used in command
        ask("test", remove_cache=True)

        call_args = mock_popen.call_args[0][0]
        assert "--remove-cache" not in call_args

    @patch("subprocess.Popen")
    def test_ask_with_all_parameters(self, mock_popen):
        """Test ask() with all parameters specified"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "full params"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask(
            prompt="complex prompt",
            headless=False,
            remove_cache=False,
            debug=True,
            timeout=200,
            typing_speed=0.1
        )
        assert result == "full params"

        call_args = mock_popen.call_args[0][0]
        assert "complex prompt" in call_args
        assert "--debug" in call_args
        assert "--timeout" in call_args
        assert "200" in call_args
        assert "--typing-speed" in call_args
        assert "0.1" in call_args

    @patch("subprocess.Popen")
    def test_ask_empty_prompt(self, mock_popen):
        """Test ask() with empty prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response to empty"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("")
        assert result == "response to empty"

    @patch("subprocess.Popen")
    def test_ask_special_characters(self, mock_popen):
        """Test ask() with special characters in prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "special response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        special_prompt = "Test with !@#$%^&*()_+-=[]{}|;:',.<>?/~`"
        result = ask(special_prompt)
        assert result == "special response"

    @patch("subprocess.Popen")
    def test_ask_unicode_characters(self, mock_popen):
        """Test ask() with unicode characters"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "unicode response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        unicode_prompt = "你好世界 🌍 مرحبا мир"
        result = ask(unicode_prompt)
        assert result == "unicode response"

    @patch("subprocess.Popen")
    def test_ask_multiline_prompt(self, mock_popen):
        """Test ask() with multiline prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "multiline response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        multiline = "Line 1\nLine 2\nLine 3"
        result = ask(multiline)
        assert result == "multiline response"

    @patch("subprocess.Popen")
    def test_ask_very_long_prompt(self, mock_popen):
        """Test ask() with very long prompt (10000+ chars)"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "long response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        long_prompt = "a" * 10000
        result = ask(long_prompt)
        assert result == "long response"

    @patch("subprocess.Popen")
    def test_ask_json_like_prompt(self, mock_popen):
        """Test ask() with JSON-like characters in prompt"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "json response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        json_like = '{"key": "value"} and [1, 2, 3]'
        result = ask(json_like)
        assert result == "json response"


class TestChatGPTClass:
    """Test the ChatGPT class"""

    @patch("subprocess.Popen")
    def test_chatgpt_class_initialization(self, mock_popen):
        """Test ChatGPT class can be instantiated"""
        chatgpt = ChatGPT()
        assert isinstance(chatgpt, ChatGPT)

    @patch("subprocess.Popen")
    def test_chatgpt_class_chat_method(self, mock_popen):
        """Test ChatGPT.chat() method"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "chat response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        chatgpt = ChatGPT()
        result = chatgpt.chat("hello")
        assert result == "chat response"

    @patch("subprocess.Popen")
    def test_chatgpt_class_chat_multiple_calls(self, mock_popen):
        """Test ChatGPT.chat() can be called multiple times"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        chatgpt = ChatGPT()
        result1 = chatgpt.chat("first")
        result2 = chatgpt.chat("second")

        assert result1 == "response"
        assert result2 == "response"
        assert mock_popen.call_count >= 2

    @patch("subprocess.Popen")
    def test_chatgpt_class_chat_with_special_prompt(self, mock_popen):
        """Test ChatGPT.chat() with special characters"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "special response"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        chatgpt = ChatGPT()
        result = chatgpt.chat("Test !@#$%^&*()")
        assert result == "special response"


class TestChatGPTErrors:
    """Test error handling in ChatGPT ask function"""

    @patch("subprocess.Popen")
    def test_ask_subprocess_stdout_none(self, mock_popen):
        """Test ask() when subprocess stdout is None"""
        mock_proc = MagicMock()
        mock_proc.stdout = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        with pytest.raises(RuntimeError, match="stdout is None"):
            ask("test")

    @patch("subprocess.Popen")
    def test_ask_no_json_response(self, mock_popen):
        """Test ask() when no JSON response is in output"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b"no json here"
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        with pytest.raises(RuntimeError, match="did not produce JSON response"):
            ask("test")

    @patch("subprocess.Popen")
    def test_ask_unicode_decode_error(self, mock_popen):
        """Test ask() handles UTF-8 decode errors gracefully"""
        mock_proc = MagicMock()
        # Invalid UTF-8 bytes mixed with valid response
        invalid_bytes = b'{"response": "test\xff\xfe"}'
        mock_proc.stdout.read.return_value = invalid_bytes
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        # Should handle with errors='replace'
        result = ask("test")
        assert "test" in result

    @patch("subprocess.Popen")
    def test_ask_empty_response_value(self, mock_popen):
        """Test ask() with empty response value"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": ""}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test")
        assert result == ""

    @patch("subprocess.Popen")
    def test_ask_multiple_json_lines(self, mock_popen):
        """Test ask() with multiple JSON lines (uses last)"""
        mock_proc = MagicMock()
        output = b'debug\n{"response": "first"}\n{"response": "second"}\n{"response": "final"}'
        mock_proc.stdout.read.return_value = output
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("test")
        assert result == "final"


class TestChatGPTExports:
    """Test module exports"""

    def test_ask_function_exported(self):
        """Test ask function is properly exported"""
        from textgenhub.chatgpt import ask as imported_ask
        assert callable(imported_ask)

    def test_chatgpt_class_exported(self):
        """Test ChatGPT class is properly exported"""
        from textgenhub.chatgpt import ChatGPT as ImportedChatGPT
        assert ImportedChatGPT is ChatGPT

    def test_all_exports(self):
        """Test __all__ contains expected exports"""
        from textgenhub import chatgpt
        assert hasattr(chatgpt, '__all__')
        assert "ask" in chatgpt.__all__
        assert "ChatGPT" in chatgpt.__all__
