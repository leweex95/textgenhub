[![Nightly regression tests](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) [![codecov](https://codecov.io/gh/leweex95/textgenhub/branch/chatgpt-extension-cli/graph/badge.svg)](https://codecov.io/gh/leweex95/textgenhub)

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

## Installation

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
response = chatgpt.ask("What is Python?", headless=True)
response = deepseek.ask("What is Python?", headless=True)
response = perplexity.ask("What is Python?", headless=True)
```

All providers now support a unified `ask()` interface for consistency:

```python
from textgenhub import chatgpt, deepseek, perplexity

# Unified interface - all providers support ask()
response = chatgpt.ask("What is Python?", headless=True)
response = deepseek.ask("What is Python?", headless=True)
response = perplexity.ask("What is Python?", headless=True)
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

# ChatGPT (extension method by default, --old for puppeteer-based fallback)
poetry run textgenhub chatgpt --prompt "What day is it today?"
poetry run textgenhub chatgpt --prompt "What day is it today?" --old

# DeepSeek (headless browser method)
poetry run textgenhub deepseek --prompt "What day is it today?"

# Perplexity (headless browser method)
poetry run textgenhub perplexity --prompt "What day is it today?"

# Grok (headless browser method)
poetry run textgenhub grok --prompt "What day is it today?"
```

#### CLI Options

- `--prompt, -p`: The text prompt to send to the LLM (required)
- `--old`: Use old headless browser method instead of extension (ChatGPT only)
- `--headless`: Run browser in headless mode (default: true)
- `--output-format`: Output format - `json` (default) or `html`
- `--timeout`: Timeout in seconds for extension mode (ChatGPT only, default: 120)

#### CLI Examples

```bash
# ChatGPT with extension (recommended) - JSON output (default)
poetry run textgenhub chatgpt --prompt "Explain quantum computing"

# ChatGPT with extension - HTML output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --output-format html

# ChatGPT with headless fallback
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --old

# DeepSeek - JSON output
poetry run textgenhub deepseek --prompt "What is machine learning?"

# DeepSeek - HTML output
poetry run textgenhub deepseek --prompt "What is machine learning?" --output-format html

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
  "method": "extension",
  "timestamp": "2025-11-08T09:00:00.000000",
  "prompt": "What is 2 + 2?",
  "response": "2 + 2 equals 4.",
  "html": "<div>HTML content here</div>"
}
```

#### HTML Output Format

When using `--output-format html`, the CLI returns raw HTML content directly, perfect for downstream processing:

```bash
# Get HTML content for further processing
HTML_CONTENT=$(poetry run textgenhub chatgpt --prompt "Generate a report" --output-format html)
```

> 💡 **ChatGPT Extension Setup**: The ChatGPT provider uses a Chrome extension for optimal performance. Install the extension from `src/textgenhub/chatgpt_extension/` and ensure the Windows service `ChatGPTServer` is running for persistent operation.

### ChatGPT Extension Architecture

The ChatGPT provider offers two methods for automation:

#### **Extension Method (Recommended)**
- **How it works**: Uses a Chrome browser extension that injects JavaScript into ChatGPT web pages to automate interactions
- **Communication**: Extension communicates with a local WebSocket server (running on `ws://127.0.0.1:8765`) to receive prompts and send responses
- **Windows Service**: A persistent Windows service (`ChatGPTServer`) runs the WebSocket server continuously in the background
- **Performance**: Faster and more reliable than headless browser automation

#### **Preconditions for Extension Method**
- **Chrome browser must be running** (the extension does NOT launch Chrome automatically)
- **ChatGPT tab must be open and active** in Chrome (navigate to https://chat.openai.com/ and make it the active/latest used tab)
- **Chrome extension must be installed** from `src/textgenhub/chatgpt_extension/`
- **Windows service must be running** (`ChatGPTServer` service for the WebSocket server)

#### **ChatGPT Tab Manager**
A standalone utility script to ensure ChatGPT tabs are open and focused in existing Chrome sessions:

```bash
# Ensure ChatGPT tab is open and focused
python src/textgenhub/chatgpt_tab_manager.py
```

**Features:**
- Detects existing Chrome sessions (no new browser instances)
- Finds and focuses existing ChatGPT tabs
- Opens new ChatGPT tabs if none exist
- Uses Windows API for native tab management
- Avoids detection by working with existing browser sessions

**Note:** Due to Chrome's window title behavior, newly opened tabs may require manual switching within Chrome.

#### **Headless Browser Method (Fallback)**
- **How it works**: Uses Puppeteer to launch a headless Chrome browser and automate ChatGPT interactions
- **No preconditions**: Automatically launches browser and navigates to ChatGPT
- **Usage**: Add `--old` flag to use this method
