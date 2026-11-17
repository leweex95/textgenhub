# Python Usage

## Quick Start

```python
from textgenhub import chatgpt, ollama, deepseek

# Web UI provider (browser automation)
response = chatgpt.ask("What is Python?", headless=True)

# Local provider (direct REST, no API key)
response = ollama.ask("Explain quantum computing", model="llama3")

# API-key provider (direct REST)
response = deepseek.ask("Write a Python function", model="deepseek-coder")
```

## ChatGPT

ChatGPT is a web UI provider with session support.

## Web UI Providers

Supports: `chatgpt`, `deepseek`, `perplexity`, `grok`

All providers share a unified `ask()` interface:

```python
from textgenhub import chatgpt, deepseek, perplexity, grok

# Default: instant paste (no typing animation)
response = chatgpt.ask("What is Python?", headless=True)

# Character-by-character typing (seconds per character)
response = chatgpt.ask("What is Python?", typing_speed=0.05)
```

### ChatGPT Sessions

```python
from textgenhub import chatgpt

# Start a session
response = chatgpt.ask("What day is it?", headless=True, session=0, close=False)

# Continue the same session
response = chatgpt.ask("Tell me more", session=0)

# Close without a prompt
chatgpt.close(session=0)
```

### Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | str | required | Message to send |
| `headless` | bool | `True` | Run browser headless |
| `typing_speed` | float or None | `None` | Seconds per character (None = instant paste) |
| `timeout` | int | `120` | Seconds before timeout |
| `session` | int or None | `None` | ChatGPT session index |
| `close` | bool | `False` | Close session after response (ChatGPT only) |
| `max_trials` | int | `10` | Retry attempts on rate limit |

## Ollama

Install via `.\setup.ps1`.

```python
from textgenhub import ollama, Ollama

# One-liner (uses OLLAMA_MODEL env var or llama3)
response = ollama.ask("What is Python?")

# Specify model
response = ollama.ask("Explain quantum computing", model="qwen2.5:3b")

# Class-based (persistent config)
client = Ollama(model="llama3", system_prompt="You are a helpful assistant")
response = client.chat("Hello")

# Remote Ollama instance
client = Ollama(model="llama3", host="192.168.1.50", port=11434)

# List available models
models = ollama.list_models()
```

### Ollama Configuration

| Env Var | Default | Description |
|---|---|---|
| `OLLAMA_MODEL` | `llama3` | Default model name |
| `OLLAMA_HOST` | `localhost` | Server host |
| `OLLAMA_PORT` | `11434` | Server port |

### Ollama.chat() Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | str | required | Message to send |
| `temperature` | float | `0.7` | Sampling temperature |
| `max_tokens` | int | `None` | Max output tokens |
| `system_prompt` | str or None | `None` | System prompt |

## DeepSeek API

Get a key at [platform.deepseek.com](https://platform.deepseek.com).

```python
from textgenhub import deepseek, DeepSeekAPI

# Inline key (one-off)
response = deepseek.ask("hi", api_key="sk-your-key")

# Environment variable (recommended)
import os
os.environ["DEEPSEEK_API_KEY"] = "sk-your-key"
response = deepseek.ask("Explain neural nets")

# Class-based
client = DeepSeekAPI(
    model="deepseek-reasoner",
    system_prompt="You are a math tutor.",
)
response = client.chat("Solve: x^2 + 3x + 2 = 0", temperature=0.3, max_tokens=500)

# Custom endpoint (proxy / self-hosted)
response = deepseek.ask("hi", base_url="https://your-proxy/v1")
```

### Available Models

| Model | Best for |
|---|---|
| `deepseek-chat` | General tasks (default) |
| `deepseek-coder` | Code generation & debugging |
| `deepseek-reasoner` | Math, logic, reasoning |

## Node.js Providers

```python
from textgenhub import webui

# Automatically installs Node dependencies on first import
```
