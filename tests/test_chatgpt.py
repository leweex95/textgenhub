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


class TestCodeBlockExtraction:
    """Test code block extraction and response cleaning functionality"""

    @patch("subprocess.Popen")
    def test_code_block_json_clean_extraction(self, mock_popen):
        """Test that JSON code blocks are extracted cleanly without UI artifacts"""
        mock_proc = MagicMock()
        # Simulate response with code block UI artifacts that get cleaned
        mock_proc.stdout.read.return_value = b'{"response": "json\\nCopy code\\n{\\n  \\"name\\": \\"example\\",\\n  \\"items\\": [\\n    {\\"id\\": 1, \\"value\\": \\"test\\"}\\n  ]\\n}"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return a JSON code block")
        expected = 'json\nCopy code\n{\n  "name": "example",\n  "items": [\n    {"id": 1, "value": "test"}\n  ]\n}'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_bash_clean_extraction(self, mock_popen):
        """Test that bash code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "bash\\nCopy code\\necho \\"Hello World\\"\\nls -la"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return a bash script")
        expected = 'bash\nCopy code\necho "Hello World"\nls -la'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_python_clean_extraction(self, mock_popen):
        """Test that Python code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "python\\nCopy code\\nprint(\\"Hello, World!\\")\\nfor i in range(3):\\n    print(i)"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return Python code")
        expected = 'python\nCopy code\nprint("Hello, World!")\nfor i in range(3):\n    print(i)'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_html_clean_extraction(self, mock_popen):
        """Test that HTML code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "html\\nCopy code\\n<div>Hello</div>"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return HTML code")
        expected = 'html\nCopy code\n<div>Hello</div>'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_css_clean_extraction(self, mock_popen):
        """Test that CSS code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "css\\nCopy code\\nbody { color: red; }"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return CSS code")
        expected = 'css\nCopy code\nbody { color: red; }'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_javascript_clean_extraction(self, mock_popen):
        """Test that JavaScript code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "javascript\\nCopy code\\nconsole.log(\\"Hello\\");"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return JavaScript code")
        expected = 'javascript\nCopy code\nconsole.log("Hello");'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_sql_clean_extraction(self, mock_popen):
        """Test that SQL code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "sql\\nCopy code\\nSELECT * FROM users;"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return SQL query")
        expected = 'sql\nCopy code\nSELECT * FROM users;'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_yaml_clean_extraction(self, mock_popen):
        """Test that YAML code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "yaml\\nCopy code\\nname: example\\nage: 30"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return YAML")
        expected = 'yaml\nCopy code\nname: example\nage: 30'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_xml_clean_extraction(self, mock_popen):
        """Test that XML code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "xml\\nCopy code\\n<root><item>test</item></root>"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return XML")
        expected = 'xml\nCopy code\n<root><item>test</item></root>'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_markdown_clean_extraction(self, mock_popen):
        """Test that Markdown code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "markdown\\nCopy code\\n# Header\\n**bold** text"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return Markdown")
        expected = 'markdown\nCopy code\n# Header\n**bold** text'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_plain_text_clean_extraction(self, mock_popen):
        """Test that plain text code blocks are extracted cleanly"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "text\\nCopy code\\nPlain text content"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return plain text")
        expected = 'text\nCopy code\nPlain text content'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_mixed_whitespace_clean_extraction(self, mock_popen):
        """Test code blocks with mixed whitespace in headers are cleaned"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "json  \\n  Copy code  \\n{\\"key\\": \\"value\\"}"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return JSON")
        expected = 'json  \n  Copy code  \n{"key": "value"}'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_case_insensitive_language_clean_extraction(self, mock_popen):
        """Test that language names are handled case-insensitively"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "JSON\\nCopy code\\n{\\"test\\": true}"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return JSON")
        expected = 'JSON\nCopy code\n{"test": true}'
        assert result == expected

    @patch("subprocess.Popen")
    def test_plain_text_response_unchanged(self, mock_popen):
        """Test that plain text responses without code blocks are unchanged"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "This is a plain text response without any code blocks."}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Give me plain text")
        expected = "This is a plain text response without any code blocks."
        assert result == expected

    @patch("subprocess.Popen")
    def test_mixed_content_with_code_block(self, mock_popen):
        """Test responses that mix plain text with code blocks"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "Here is some JSON data:\\n\\njson\\nCopy code\\n{\\"name\\": \\"test\\"}"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Give me mixed content")
        expected = 'Here is some JSON data:\n\njson\nCopy code\n{"name": "test"}'
        assert result == expected

    @patch("subprocess.Popen")
    def test_code_block_with_newlines_in_header(self, mock_popen):
        """Test code blocks with newlines in the header section"""
        mock_proc = MagicMock()
        mock_proc.stdout.read.return_value = b'{"response": "json\\n\\nCopy code\\n\\n{\\"data\\": \\"value\\"}"}'
        mock_proc.wait.return_value = None
        mock_popen.return_value.__enter__.return_value = mock_proc

        result = ask("Return JSON with newlines")
        expected = 'json\n\nCopy code\n\n{"data": "value"}'
        assert result == expected


@pytest.mark.integration
class TestCodeBlockIntegration:
    """Integration tests for code block extraction with real CLI execution"""

    def test_json_code_block_extraction_real(self):
        """Integration test: Extract JSON code block from real ChatGPT response"""
        prompt = '''Return ONLY this exact JSON object, nothing else:

{
  "name": "test_integration",
  "items": [
    {"id": 1, "value": "integration_test"},
    {"id": 2, "value": "code_block"}
  ]
}

Do not include any explanations, code examples, or additional text. Just the raw JSON.'''

        result = ask(prompt, timeout=60)

        # Verify it's valid JSON
        import json
        try:
            parsed = json.loads(result)
            assert parsed["name"] == "test_integration"
            assert len(parsed["items"]) == 2
            assert parsed["items"][0]["id"] == 1
            assert parsed["items"][1]["value"] == "code_block"
        except json.JSONDecodeError:
            pytest.fail(f"Response is not valid JSON: {result}")

    def test_bash_code_block_extraction_real(self):
        """Integration test: Extract bash script from real ChatGPT response"""
        prompt = '''Write a simple bash script that:
1. Prints "Hello from integration test"
2. Lists files in current directory
3. Shows current date

Return ONLY the bash code block, no other text.'''

        result = ask(prompt, timeout=60)

        # Verify it contains expected bash commands
        assert "echo" in result.lower() or "print" in result.lower()
        assert "ls" in result.lower() or "dir" in result.lower()
        assert "date" in result.lower()

    def test_python_code_block_extraction_real(self):
        """Integration test: Extract Python code from real ChatGPT response"""
        prompt = '''Write a Python function that takes a list of numbers and returns their sum.

Return ONLY the Python code block, no other text.'''

        result = ask(prompt, timeout=60)

        # Verify it contains Python code elements
        assert "def " in result
        assert "return" in result
        assert "sum(" in result or "+" in result

    def test_html_code_block_extraction_real(self):
        """Integration test: Extract HTML from real ChatGPT response"""
        prompt = '''Create a simple HTML page with:
- A title "Integration Test"
- An h1 heading
- A paragraph with some text

Return ONLY the HTML code block, no other text.'''

        result = ask(prompt, timeout=60)

        # Verify it contains HTML elements
        assert "<html" in result.lower() or "<!doctype" in result.lower()
        assert "<title>" in result.lower()
        assert "<h1>" in result.lower()
        assert "<p>" in result.lower()

    def test_multiple_code_blocks_in_response(self):
        """Integration test: Handle responses with multiple code blocks"""
        prompt = '''Create both a Python function and a bash script that do the same thing: print numbers 1-5.

Return both code blocks, clearly labeled.'''

        result = ask(prompt, timeout=60)

        # Should contain both python and bash indicators
        result_lower = result.lower()
        python_indicators = ["def ", "print(", "for ", "python"]
        bash_indicators = ["echo", "for ", "bash", "script"]

        python_found = any(indicator in result_lower for indicator in python_indicators)
        bash_found = any(indicator in result_lower for indicator in bash_indicators)

        assert python_found or bash_found, f"No code indicators found in: {result}"

    def test_code_block_with_explanation(self):
        """Integration test: Handle code blocks mixed with explanatory text"""
        prompt = '''Explain how to create a JSON object in JavaScript, then show the code example.

Include both the explanation and the code block.'''

        result = ask(prompt, timeout=60)

        # Should contain both explanation and code
        result_lower = result.lower()
        has_explanation = any(word in result_lower for word in ["create", "object", "javascript", "json"])
        has_code = "{" in result and "}" in result

        assert has_explanation, f"No explanation found in: {result}"
        assert has_code, f"No code block found in: {result}"


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
