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

### Programmatic Health Check (Python)
```python
from textgenhub.chatgpt import check_sessions, reinit_session

for s in check_sessions():
    if s["loginStatus"] != "logged_in":
        reinit_session(s["index"])
```

---

## 🛠️ Advanced Usage

### CLI Flags
- `--prompt`: Text to send.
- `--session <index>`: Target a specific browser profile.
- `--output-format`: `json` (default), `html`, or `raw`.
- `--typing-speed <sec>`: Simulates human typing.
- `--close`: Close browser immediately after response.

### Storage Location
Sessions are stored centrally at `%LOCALAPPDATA%\textgenhub\sessions.json` (Windows) or `~/.local/share/textgenhub\sessions.json` (Linux) to ensure consistency across all your local projects.

---

## 🤝 Development
- **Node.js**: Interaction engine using Puppeteer + Stealth.
- **Python**: High-level wrapper for easy integration.

When modifying dependencies, ensure you update both root `package.json` and `src/textgenhub/package.json`.