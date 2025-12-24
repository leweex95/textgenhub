[![Nightly regression tests](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) [![codecov](https://codecov.io/gh/leweex95/textgenhub/branch/master/graph/badge.svg)](https://codecov.io/gh/leweex95/textgenhub)

# TextGenHub

My personal text generation hub for connecting to web-based LLMs in an automated manner. The package is available for both Python and Node.js environments, allowing flexible integration into various projects.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Supported LLMs

- **ChatGPT** - OpenAI's ChatGPT via web interface
- **DeepSeek** - DeepSeek Chat via web interface (https://chat-deep.ai/deepseek-chat/)
- **Perplexity** - Perplexity AI via web interface (https://www.perplexity.ai/)
- **Grok** - Grok (X.com) via web interface (https://grok.com/)

## Development Notes

> ⚠️ **Important**: This project maintains two `package.json` files:
> - `./package.json` - For npm package installation
> - `./src/textgenhub/package.json` - For Python package dependencies
>
> When modifying Node.js dependencies or version numbers, please ensure to update both files to keep them synchronized.



### Python Package
```bash
# Using pip
pip install textgenhub

# Using poetry
poetry add textgenhub
```

### Node.js Package
```bash
# Using npm
npm install textgenhub

# Using yarn
yarn add textgenhub
```

## Usage

### Python

All providers now support a unified `ask()` interface for consistency:

```python
from textgenhub import chatgpt, deepseek, perplexity

# Unified interface - all providers support ask()
# By default, prompts are pasted instantly (typing_speed=None)
response = chatgpt.ask("What is Python?", headless=True)
response = deepseek.ask("What is Python?", headless=True)
response = perplexity.ask("What is Python?", headless=True)

# For character-by-character typing, set typing_speed (in seconds per character)
response = chatgpt.ask("What is Python?", typing_speed=0.05)
```

#### ChatGPT
```python
from textgenhub import chatgpt

# Use the unified ask() interface
response = chatgpt.ask("What day is it today?", headless=True)
print(response)
```

#### DeepSeek
```python
from textgenhub import deepseek

# Use the unified ask() interface
response = deepseek.ask("What day is it today?", headless=True)
print(response)
```

#### Perplexity
```python
from textgenhub import perplexity

# Use the unified ask() interface
response = perplexity.ask("What day is it today?", headless=True)
print(response)
```

### Node.js

#### ChatGPT
```javascript
const { ChatGPT } = require('textgenhub');

// Create a ChatGPT instance
const chatgpt = new ChatGPT();

// Use it in your code
chatgpt.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

#### DeepSeek
```javascript
const { DeepSeek } = require('textgenhub');

// Create a DeepSeek instance
const deepseek = new DeepSeek();

// Use it in your code
deepseek.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

#### Perplexity
```javascript
const { Perplexity } = require('textgenhub');

// Create a Perplexity instance
const perplexity = new Perplexity();

// Use it in your code
perplexity.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## Running the CLI

### Unified CLI Interface

TextGenHub now provides a unified CLI interface for all providers:

```bash
# Install and use the unified CLI
poetry install
poetry run textgenhub --help

# ChatGPT (--old for legacy puppeteer-based fallback)
poetry run textgenhub chatgpt --prompt "What day is it today?"
poetry run textgenhub chatgpt --prompt "What day is it today?" --old  # deprecated, will be removed soon

# DeepSeek (headless browser method)
poetry run textgenhub deepseek --prompt "What day is it today?"

# Perplexity (headless browser method)
poetry run textgenhub perplexity --prompt "What day is it today?"

# Grok (headless browser method)
poetry run textgenhub grok --prompt "What day is it today?"
```

#### CLI Options

- `--prompt`: The text prompt to send to the LLM (required for most providers)
- `--old`: Use old legacy headless browser method instead of attach-based (ChatGPT only)
- `--headless`: Run browser in headless mode (default: true, legacy method only)
- `--output-format`: Output format - `json` (default), `html`, or `raw` (ChatGPT: json/html/raw; others: json/html)
- `--timeout`: Timeout in seconds for extension mode (ChatGPT only, default: 120)
- `--typing-speed`: Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)
- `--session`: Explicit session index to use (ChatGPT only, see `sessions list` command)
- `--close`: Close browser session after completion (ChatGPT only, default: keep open)

#### Session management (ChatGPT only)

```bash
# List all available ChatGPT sessions
poetry run textgenhub sessions list

# Show the path to the central sessions.json file
poetry run textgenhub sessions path

# Create a new ChatGPT session with auto-assigned index (opens browser for login)
poetry run textgenhub sessions init

# Create or regenerate a specific session index (opens browser for login)
poetry run textgenhub sessions init --index 0
poetry run textgenhub sessions init --index 2

# Get help on available session commands
poetry run textgenhub sessions --help
poetry run textgenhub sessions init --help
```

The ChatGPT provider supports browser profile isolation with intelligent session management. Sessions maintain conversation continuity and can be explicitly targeted with `--session INDEX`.

**Session Storage Policy**: `sessions.json` is stored centrally on your system to ensure consistency across all projects using `textgenhub`: `%LOCALAPPDATA%\textgenhub\sessions.json`.

This central location prevents the need to copy `sessions.json` between projects or virtual environments. If a local `sessions.json` exists in your project directory, it will be automatically migrated to the central location on first use.

#### CLI examples

```bash
# ChatGPT - JSON output (default)
poetry run textgenhub chatgpt --prompt "Explain quantum computing"

# ChatGPT with attach-based provider - HTML output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --output-format html

# ChatGPT with attach-based provider - Raw text output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --output-format raw

# ChatGPT with character-by-character typing (0.05 seconds per character)
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --typing-speed 0.05

# ChatGPT using specific session (session index 1)
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --session 1

# Regenerate session 0 if it's broken
poetry run textgenhub sessions init --index 0

# ChatGPT with automatic closing after receiving the response
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --close

# ChatGPT with legacy puppeteer-based fallback
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --old

# DeepSeek - JSON output
poetry run textgenhub deepseek --prompt "What is machine learning?"

# Perplexity - JSON output
poetry run textgenhub perplexity --prompt "What is the capital of France?"

# Grok - JSON output
poetry run textgenhub grok --prompt "Tell me a joke"
```

#### JSON Output Format

When using `--output-format json` (default), the CLI returns structured JSON:

```json
{
  "provider": "chatgpt",
  "method": "headless",
  "timestamp": "2025-11-13T20:14:44.465890",
  "prompt": "What is 2 + 2?",
  "response": "2 + 2 equals 4.",
  "html": ""
}
```

#### HTML Output Format

When using `--output-format html`, the CLI returns raw HTML content directly, perfect for downstream processing:

```bash
# Get HTML content for further processing
HTML_CONTENT=$(poetry run textgenhub chatgpt --prompt "Generate a report" --output-format html)
```

#### Raw Output Format

When using `--output-format raw` (ChatGPT attach-based provider only), the CLI returns plain text content without any formatting or metadata:

```bash
# Get plain text response only
poetry run textgenhub chatgpt --prompt "Summarize the Ukraine crisis" --output-format raw
```
