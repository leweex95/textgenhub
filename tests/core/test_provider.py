import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from textgenhub.core.provider import SimpleProvider

def _make_provider(name="chatgpt"):
    return SimpleProvider(name, f"{name}_cli.js", script_dir=Path("."))

def mock_popen(output=b'{"response": "ok"}', stdout_none=False):
    proc = MagicMock()
    proc.stdout = None if stdout_none else MagicMock()
    if not stdout_none:
        proc.stdout.read.return_value = output
    proc.wait.return_value = None
    return patch("subprocess.Popen", return_value=MagicMock(__enter__=MagicMock(return_value=proc)))

def test_ask_success_and_errors():
    # 1. Standard success path
    with mock_popen(b'{"response": "hello"}'):
        assert _make_provider().ask("hi") == "hello"

    # 2. Validation & Parse errors
    with mock_popen(b"just logs"), pytest.raises(RuntimeError, match="did not produce JSON"):
        _make_provider().ask("hi")

    with mock_popen(stdout_none=True), pytest.raises(RuntimeError, match="stdout is None"):
        _make_provider().ask("hi")

    # ponytail: ValueError is checked before Popen fires, but mock ensures isolation
    with mock_popen(), pytest.raises(ValueError, match="Prompt is required"):
        _make_provider("deepseek").ask(None)

    # 3. Close flag shortcut
    with mock_popen(b""):
        assert _make_provider("chatgpt").ask(None, close=True) == ""

@pytest.mark.parametrize("name, expected_present, expected_absent", [
    ("chatgpt", ["--timeout"], ["--headless"]),
    ("deepseek", ["--headless"], []),
])
def test_provider_cli_flags(name, expected_present, expected_absent):
    with mock_popen() as m:
        _make_provider(name).ask("hi")
        cmd = m.call_args[0][0]
        for flag in expected_present:
            assert flag in cmd
        for flag in expected_absent:
            assert flag not in cmd
