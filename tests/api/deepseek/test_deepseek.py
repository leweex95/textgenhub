import pytest
import os
import requests as req
from unittest.mock import patch, MagicMock
from textgenhub.api.deepseek import ask, DeepSeekAPI

# Single entry point for response simulation
def mock_post(status=200, content="hello", exception=None):
    if exception:
        return patch("textgenhub.api.deepseek.deepseek.requests.post", side_effect=exception)
    m = MagicMock(status_code=status)
    m.json.return_value = {"choices": [{"message": {"content": content}}]}
    return patch("textgenhub.api.deepseek.deepseek.requests.post", return_value=m)

def test_ask_behavior():
    # 1. Standard success path & headers
    with mock_post(content="hello") as m:
        assert ask("hi", api_key="sk-abc") == "hello"
        kwargs = m.call_args.kwargs
        assert kwargs["headers"]["Authorization"] == "Bearer sk-abc"
        assert "temperature" not in kwargs["json"]

    # 2. System prompt insertion
    with mock_post() as m:
        ask("hi", api_key="k", system_prompt="be helpful")
        assert m.call_args.kwargs["json"]["messages"][0] == {"role": "system", "content": "be helpful"}

    # 3. Validation and errors
    with patch.dict(os.environ, {}, clear=True), pytest.raises(ValueError, match="API key"):
        ask("hi")

    with mock_post(status=401), pytest.raises(RuntimeError, match="authentication"):
        ask("hi", api_key="k")

    with mock_post(status=429), pytest.raises(RuntimeError, match="rate limit"):
        ask("hi", api_key="k")

    with mock_post(exception=req.exceptions.ConnectionError()), pytest.raises(RuntimeError, match="connect"):
        ask("hi", api_key="k")

def test_class_chat_delegates():
    with patch("textgenhub.api.deepseek.deepseek.ask", return_value="r") as m:
        assert DeepSeekAPI(api_key="k").chat("hi") == "r"
        assert m.call_args.kwargs["prompt"] == "hi"
