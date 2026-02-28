[![Nightly regression tests](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) [![codecov](https://codecov.io/gh/leweex95/textgenhub/branch/master/graph/badge.svg)](https://codecov.io/gh/leweex95/textgenhub)

# TextGenHub

A lightweight hub for automating interactions with web-based LLMs. Supports Python and Node.js.

## 🚀 Quick Start

### Installation
```bash
pip install textgenhub    # Python
npm install textgenhub    # Node.js
```

### Python Implementation
```python
from textgenhub import chatgpt

# Simple request
response = chatgpt.ask("What is Python?")

# With session persistence (recommended for stability)
response = chatgpt.ask("Tell me a message", session=0)
```

## 🤖 Supported Providers

| Provider | Status | Interface |
| :--- | :--- | :--- |
| **ChatGPT** | Stable | Web Session (Isolated Profiles) |
| **DeepSeek** | Stable | Headless Browser |
| **Perplexity** | Stable | Headless Browser |
| **Grok** | Stable | Headless Browser |

---

## 🔑 Session Management (ChatGPT)

TextGenHub uses isolated browser profiles to maintain login state and conversation history.

### CLI Commands
```bash
# Verify which sessions are active/logged-in
poetry run textgenhub sessions check

# Initialize a new session (opens login window)
poetry run textgenhub sessions init

# Re-login to a broken session
poetry run textgenhub sessions reinit --index 0

# List all stored sessions
poetry run textgenhub sessions list
```

### Session Health Statuses
| Status | Action |
| :--- | :--- |
| **Active Session** ✅ | Ready to use. |
| **Logged Out** ❌ | Run `reinit` to log back in. |
| **Offline** ❌ | Browser process is closed; will auto-launch on next `ask()`. |

---

## 🛠️ Advanced Usage

### CLI Flags
- `--prompt`: Text to send.
- `--session <index>`: Target a specific browser profile.
- `--output-format`: `json` (default), `html`, or `raw`.
- `--typing-speed <sec>`: Simulates human typing.
- `--close`: Close browser immediately after response.

### Storage Location
Sessions are stored centrally at `%LOCALAPPDATA%\textgenhub\sessions.json` to ensure consistency across all your local projects.

## 📋 CLI Command Reference

### Main Commands

```bash
# ChatGPT
poetry run textgenhub chatgpt --prompt "Your question" [--session <index>] [--output-format json|html|raw] [--typing-speed <sec>] [--timeout <sec>] [--max-trials <num>] [--close] [--debug]

# DeepSeek
poetry run textgenhub deepseek --prompt "Your question" [--headless] [--output-format json|html] [--typing-speed <sec>]

# Perplexity
poetry run textgenhub perplexity --prompt "Your question" [--headless] [--output-format json|html] [--typing-speed <sec>]

# Grok
poetry run textgenhub grok --prompt "Your question" [--headless] [--output-format json|html] [--typing-speed <sec>]

# Session Management
poetry run textgenhub sessions list
poetry run textgenhub sessions check [--index <session>] [--debug]
poetry run textgenhub sessions init [--index <session>]
poetry run textgenhub sessions reinit --index <session>
poetry run textgenhub sessions path
```

### Flag Descriptions
- `--prompt`: Text prompt to send to the LLM (required for most providers)
- `--session <index>`: Use a specific browser session/profile (ChatGPT only)
- `--output-format`: Output format (`json`, `html`, `raw`)
- `--typing-speed <sec>`: Simulate human typing speed (seconds per character)
- `--timeout <sec>`: Timeout for response (ChatGPT only)
- `--max-trials <num>`: Maximum retries on rate limit (ChatGPT only)
- `--close`: Close browser after response (ChatGPT only)
- `--headless`: Run browser in headless mode (default: true)
- `--debug`: Enable debug output
