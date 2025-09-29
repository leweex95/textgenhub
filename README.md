[![Daily Regression Test](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) ![Last Commit](https://img.shields.io/github/last-commit/leweex95/textgenhub)

# TextGenHub (old name: Levi's LLM Hub)

My personal text generation hub for connecting to web-based LLMs in an automated manner. The package is available for both Python and Node.js environments, allowing flexible integration into various projects.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Supported LLMs

- **ChatGPT** - OpenAI's ChatGPT via web interface
- **DeepSeek** - DeepSeek Chat via web interface (https://chat-deep.ai/deepseek-chat/)

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

#### ChatGPT
```python
from textgenhub.chatgpt import ChatGPT

# Create a ChatGPT instance
chatgpt = ChatGPT()

# Use it in your code
response = chatgpt.chat("What day is it today?", headless=True)
print(response)
```

#### DeepSeek
```python
from textgenhub.deepseek import DeepSeek

# Create a DeepSeek instance
deepseek = DeepSeek()

# Use it in your code
response = deepseek.chat("What day is it today?", headless=True)
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

// Use it in your code
chatgpt.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## Running the CLI

### ChatGPT CLI

From the project root, run:

```bash
# Python CLI
poetry run python ./src/textgenhub/chatgpt/chatgpt.py --prompt "What day is it today?" --headless

# Node.js CLI  
node ./src/textgenhub/chatgpt/chatgpt_cli.js --prompt "What day is it today?" --headless
```

### DeepSeek CLI

From the project root, run:

```bash
# Node.js CLI
node ./src/textgenhub/deepseek/deepseek_cli.js --prompt "What day is it today?" --headless
```

#### CLI Options

- `--prompt`: The text prompt to send to the LLM
- `--headless`: Run browser in headless mode (default: true)
- `--remove-cache`: Remove browser cache before running

#### CLI Examples

```bash
# Basic usage
node ./src/textgenhub/deepseek/deepseek_cli.js --prompt "Explain quantum computing"

# With visible browser (for debugging)
node ./src/textgenhub/deepseek/deepseek_cli.js --prompt "What is 2+2?" --headless=false

# With cache removal
node ./src/textgenhub/deepseek/deepseek_cli.js --prompt "Hello world" --remove-cache
```

## Daily regression testing

With such web-based automation solutions it is imperative to continuously monitor any regressions. Even more so, as I actively use this project in downstream agentic workflows I design. A simple UI redesign in which OpenAI or DeepSeek modifies the current CSS selectors would likely crash the current functionality. For this reason, the `regression_test.yml` Github Actions action was set up, scheduled for midnight each day. To make it even more robust, the input prompt will be to verify _today's date_ and the output will automatically be evaluated.

The regression testing covers:
- **ChatGPT** - Daily automated testing to ensure functionality
- **DeepSeek** - Nightly automated testing to ensure functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both ChatGPT and DeepSeek
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 
