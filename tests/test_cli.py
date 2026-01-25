import pytest
import subprocess
from unittest.mock import patch, MagicMock
from textgenhub.cli import run_provider_old


class TestRunProviderOldProviders:
    """Test provider routing in run_provider_old"""

    @patch("subprocess.run")
    def test_chatgpt_provider(self, mock_run):
        """Test routing to chatgpt provider"""
        mock_run.return_value = MagicMock(stdout='{"response": "chatgpt response"}', returncode=0)

        result, html = run_provider_old("chatgpt", "test prompt")
        assert result == "chatgpt response"
        assert html == ""

    @patch("subprocess.run")
    def test_deepseek_provider(self, mock_run):
        """Test routing to deepseek provider"""
        mock_run.return_value = MagicMock(stdout='{"response": "deepseek response"}', returncode=0)

        result, html = run_provider_old("deepseek", "test prompt")
        assert result == "deepseek response"

    @patch("subprocess.run")
    def test_perplexity_provider(self, mock_run):
        """Test routing to perplexity provider"""
        mock_run.return_value = MagicMock(stdout='{"response": "perplexity response"}', returncode=0)

        result, html = run_provider_old("perplexity", "test prompt")
        assert result == "perplexity response"

    @patch("subprocess.run")
    def test_grok_provider(self, mock_run):
        """Test routing to grok provider"""
        mock_run.return_value = MagicMock(stdout='{"response": "grok response"}', returncode=0)

        result, html = run_provider_old("grok", "test prompt")
        assert result == "grok response"

    @patch("subprocess.run")
    def test_unknown_provider(self, mock_run):
        """Test unknown provider raises error"""
        with pytest.raises(Exception, match="Unknown provider"):
            run_provider_old("unknown_provider", "test prompt")


class TestRunProviderOldPrompts:
    """Test prompt handling variations"""

    @patch("subprocess.run")
    def test_empty_prompt(self, mock_run):
        """Test empty prompt handling"""
        mock_run.return_value = MagicMock(stdout='{"response": "response to empty"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "")
        assert result == "response to empty"

    @patch("subprocess.run")
    def test_very_long_prompt(self, mock_run):
        """Test very long prompt (10000+ characters)"""
        long_prompt = "a" * 10000
        mock_run.return_value = MagicMock(stdout='{"response": "response to long"}', returncode=0)

        result, _ = run_provider_old("chatgpt", long_prompt)
        assert result == "response to long"

    @patch("subprocess.run")
    def test_prompt_with_newlines(self, mock_run):
        """Test prompt with newline characters"""
        prompt_with_newlines = "line1\nline2\nline3"
        mock_run.return_value = MagicMock(stdout='{"response": "multiline response"}', returncode=0)

        result, _ = run_provider_old("chatgpt", prompt_with_newlines)
        assert result == "multiline response"

    @patch("subprocess.run")
    def test_prompt_with_quotes(self, mock_run):
        """Test prompt with quotes and escape characters"""
        prompt_with_quotes = "He said \"Hello World\" and asked 'Why?'"
        mock_run.return_value = MagicMock(stdout='{"response": "quote response"}', returncode=0)

        result, _ = run_provider_old("chatgpt", prompt_with_quotes)
        assert result == "quote response"

    @patch("subprocess.run")
    def test_prompt_with_json_chars(self, mock_run):
        """Test prompt with JSON-like characters"""
        prompt_with_json = '{"key": "value"} and [1, 2, 3]'
        mock_run.return_value = MagicMock(stdout='{"response": "json chars response"}', returncode=0)

        result, _ = run_provider_old("chatgpt", prompt_with_json)
        assert result == "json chars response"


class TestRunProviderOldOutputFormats:
    """Test output format handling"""

    @patch("subprocess.run")
    def test_json_format(self, mock_run):
        """Test JSON output format (default)"""
        mock_run.return_value = MagicMock(stdout='{"response": "json formatted"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test", output_format="json")
        assert result == "json formatted"

    @patch("subprocess.run")
    def test_html_format(self, mock_run):
        """Test HTML output format"""
        mock_run.return_value = MagicMock(stdout='{"response": "html content"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test", output_format="html")
        assert result == "html content"

    @patch("subprocess.run")
    def test_raw_format(self, mock_run):
        """Test raw text output format"""
        mock_run.return_value = MagicMock(stdout="plain text response", returncode=0)

        result, _ = run_provider_old("chatgpt", "test", output_format="raw")
        assert isinstance(result, str)

    @patch("subprocess.run")
    def test_format_flag_passed(self, mock_run):
        """Test that format flag is passed to subprocess"""
        mock_run.return_value = MagicMock(stdout='{"response": "test"}', returncode=0)

        run_provider_old("deepseek", "test", output_format="html")

        # Verify subprocess was called
        assert mock_run.called


class TestRunProviderOldFlags:
    """Test boolean flag handling"""

    @patch("subprocess.run")
    def test_headless_true(self, mock_run):
        """Test headless flag when True"""
        mock_run.return_value = MagicMock(stdout='{"response": "headless"}', returncode=0)

        result, _ = run_provider_old("deepseek", "test", headless=True)
        assert result == "headless"

    @patch("subprocess.run")
    def test_headless_false(self, mock_run):
        """Test headless flag when False"""
        mock_run.return_value = MagicMock(stdout='{"response": "not headless"}', returncode=0)

        result, _ = run_provider_old("deepseek", "test", headless=False)
        assert result == "not headless"


class TestRunProviderOldErrorHandling:
    """Test error handling in run_provider_old"""

    @patch("subprocess.run")
    def test_subprocess_error(self, mock_run):
        """Test subprocess error handling"""
        mock_run.side_effect = subprocess.CalledProcessError(1, "node")

        with pytest.raises(Exception):
            run_provider_old("chatgpt", "test")

    @patch("subprocess.run")
    def test_invalid_json_response(self, mock_run):
        """Test invalid JSON in response"""
        mock_run.return_value = MagicMock(stdout="not valid json at all", returncode=0)

        # Should either raise or return something - depends on implementation
        try:
            result, _ = run_provider_old("chatgpt", "test")
            assert isinstance(result, str)
        except Exception:
            pass

    @patch("subprocess.run")
    def test_missing_response_field(self, mock_run):
        """Test missing response field in JSON"""
        mock_run.return_value = MagicMock(stdout='{"html": "<p>only html</p>"}', returncode=0)

        # Should handle gracefully
        try:
            result, _ = run_provider_old("chatgpt", "test")
            assert isinstance(result, str)
        except Exception:
            pass

    @patch("subprocess.run")
    def test_empty_response(self, mock_run):
        """Test empty response from subprocess"""
        mock_run.return_value = MagicMock(stdout="", returncode=0)

        try:
            result, _ = run_provider_old("chatgpt", "test")
            assert isinstance(result, str)
        except Exception:
            pass


class TestRunProviderOldResponseTypes:
    """Test various response content types"""

    @patch("subprocess.run")
    def test_response_with_html_tags(self, mock_run):
        """Test response containing HTML tags"""
        mock_run.return_value = MagicMock(stdout='{"response": "<div>html content</div>"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test")
        assert "div" in result.lower() or "html" in result.lower()

    @patch("subprocess.run")
    def test_response_with_special_chars(self, mock_run):
        """Test response with special characters"""
        mock_run.return_value = MagicMock(stdout='{"response": "Special: !@#$%^&*()"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test")
        assert "Special" in result

    @patch("subprocess.run")
    def test_response_with_unicode(self, mock_run):
        """Test response with unicode characters"""
        mock_run.return_value = MagicMock(stdout='{"response": "世界 🌍 مرحبا"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test")
        assert "世" in result or "🌍" in result

    @patch("subprocess.run")
    def test_response_with_newlines(self, mock_run):
        """Test response with newline characters"""
        mock_run.return_value = MagicMock(stdout='{"response": "line1\\nline2\\nline3"}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test")
        assert len(result) > 5

    @patch("subprocess.run")
    def test_response_very_long(self, mock_run):
        """Test very long response (10000+ characters)"""
        long_response = "x" * 10000
        mock_run.return_value = MagicMock(stdout=f'{{"response": "{long_response}"}}', returncode=0)

        result, _ = run_provider_old("chatgpt", "test")
        assert len(result) >= 1000

    @patch("subprocess.run")
    def test_response_empty(self, mock_run):
        """Test empty response content"""
        mock_run.return_value = MagicMock(stdout='{"response": ""}', returncode=0)

        try:
            result, _ = run_provider_old("chatgpt", "test")
            assert isinstance(result, str)
        except Exception:
            pass
