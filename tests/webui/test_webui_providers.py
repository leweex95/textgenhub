from unittest.mock import patch, MagicMock
import importlib

def _mock_popen():
    proc = MagicMock()
    proc.stdout.read.return_value = b'{"response": "ok"}'
    proc.wait.return_value = None
    return proc

@patch("subprocess.Popen")
def test_webui_providers_wire_correctly(mock_popen):
    mock_popen.return_value.__enter__.return_value = _mock_popen()
    
    providers = ["chatgpt", "deepseek", "grok", "perplexity"]
    
    for provider in providers:
        module = importlib.import_module(f"textgenhub.webui.{provider}")
        assert module.ask("hi") == "ok"
