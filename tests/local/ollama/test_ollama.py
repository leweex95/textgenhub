import pytest
import requests as req
from unittest.mock import patch, MagicMock
from textgenhub.local.ollama import ask, Ollama, list_models

def mock_http(method="post", status=200, json_data=None, exception=None):
    target = f"textgenhub.local.ollama.ollama.requests.{method}"
    if exception:
        return patch(target, side_effect=exception)
    m = MagicMock(status_code=status)
    if json_data:
        m.json.return_value = json_data
    return patch(target, return_value=m)

def test_ask_behavior():
    # 1. Success paths, defaults, and payload shapes
    res = {"message": {"content": "hello"}}
    with mock_http("post", json_data=res) as m:
        assert ask("hi") == "hello"
        payload = m.call_args.kwargs["json"]
        assert payload["model"] == "llama3"

    # 2. System prompt
    with mock_http("post", json_data={"message": {"content": "hi"}}) as m:
        ask("hi", system_prompt="be terse")
        msgs = m.call_args.kwargs["json"]["messages"]
        assert msgs[0] == {"role": "system", "content": "be terse"}
        assert msgs[1]["role"] == "user"

    # 3. Errors
    with mock_http("post", status=500) as m:
        m.return_value.text = "err"
        with pytest.raises(RuntimeError, match="500"):
            ask("hi")

    with mock_http("post", exception=req.exceptions.ConnectionError()), pytest.raises(RuntimeError, match="Ollama"):
        ask("hi")

def test_list_models_behavior():
    # 1. Success & sorting
    models_payload = {"models": [{"name": "z"}, {"name": "a"}]}
    with mock_http("get", json_data=models_payload):
        assert list_models() == ["a", "z"]

    # 2. Resilience
    with mock_http("get", exception=req.exceptions.ConnectionError()):
        assert list_models() == []

def test_ollama_class_chat_delegates():
    with patch("textgenhub.local.ollama.ollama.ask", return_value="r") as m:
        assert Ollama().chat("hi") == "r"
        assert m.call_args.kwargs["prompt"] == "hi"
