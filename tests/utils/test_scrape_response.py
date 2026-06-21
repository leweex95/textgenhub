import pytest
from textgenhub.utils.scrape_response import extract_response_json


def test_extracts_response():
    assert extract_response_json('{"response": "hello"}') == "hello"


def test_strips_chatgpt_said_prefix():
    result = extract_response_json('{"response": "ChatGPT said: actual answer"}')
    assert result == "actual answer"


def test_ignores_non_json_lines():
    stdout = "debug log\n[INFO] something\n{\"response\": \"answer\"}"
    assert extract_response_json(stdout) == "answer"


def test_raises_when_no_json():
    with pytest.raises(ValueError):
        extract_response_json("no json here")


def test_empty_response_value():
    assert extract_response_json('{"response": ""}') == ""
