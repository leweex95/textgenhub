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

# ChatGPT (attach-based method by default, --old for legacy puppeteer-based fallback)
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

- `--prompt, -p`: The text prompt to send to the LLM (required for most providers)
- `--old`: Use old legacy headless browser method instead of attach-based (ChatGPT only)
- `--headless`: Run browser in headless mode (default: true, legacy method only)
- `--output-format`: Output format - `json` (default), `html`, or `raw` (ChatGPT: json/html/raw; others: json/html)
- `--timeout`: Timeout in seconds for extension mode (ChatGPT only, default: 120)
- `--typing-speed`: Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)

#### CLI Examples

```bash
# ChatGPT with attach-based provider (recommended) - JSON output (default)
poetry run textgenhub chatgpt --prompt "Explain quantum computing"

# ChatGPT with attach-based provider - HTML output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --output-format html

# ChatGPT with attach-based provider - Raw text output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --output-format raw

# ChatGPT with character-by-character typing (0.05 seconds per character)
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --typing-speed 0.05

# ChatGPT with legacy puppeteer-based fallback
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --old

# ChatGPT with legacy fallback - HTML output
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --old --output-format html

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

> 💡 **ChatGPT Provider**: The ChatGPT provider now uses the attach-based method by default for improved reliability. For legacy support, use the `--old` flag to revert to the puppeteer-based implementation. The extension-based method is currently not working.


### ChatGPT Provider Architecture

The ChatGPT provider offers multiple methods for automation:

#### **Attach-Based Method (Recommended)**
- **How it works**: Uses the `chatgpt-attach` module integrated into `src/textgenhub/chatgpt/` to directly interface with ChatGPT's web interface
- **Location**: `src/textgenhub/chatgpt/` (includes `lib/` folder with core functionality)
- **Performance**: Reliable and automated, no manual browser setup required
- **Usage**: Default method when running `poetry run textgenhub chatgpt`

#### **Legacy Puppeteer Method (Fallback)**
- **How it works**: Uses Puppeteer to launch a headless Chrome browser and automate ChatGPT interactions
- **Location**: `src/textgenhub/chatgpt_old/` (renamed from legacy ChatGPT implementation)
- **No preconditions**: Automatically launches browser and navigates to ChatGPT
- **Usage**: Add `--old` flag to use this method: `poetry run textgenhub chatgpt --old`

#### **Extension Method (Not Currently Working)**
- **Status**: The Chrome extension-based approach (`src/textgenhub/chatgpt_extension_cli/`) is currently non-functional
- **Previous approach**: Used a Chrome browser extension with WebSocket communication for tab management
- **Note**: This method is not recommended until fixed
