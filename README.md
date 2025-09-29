[![Daily Regression Test](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) ![Last Commit](https://img.shields.io/github/last-commit/leweex95/textgenhub)

# TextGenHub (old name: Levi's LLM Hub)

My personal text generation hub for connecting to web-based LLMs in an automated manner. The package is available for both Python and Node.js environments, allowing flexible integration into various projects.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

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
```python
from textgenhub.chatgpt import ChatGPT

# Create a ChatGPT instance
chatgpt = ChatGPT()

# Use it in your code
response = chatgpt.chat("What day is it today?", headless=True)
print(response)
```

### Node.js
```javascript
const { ChatGPT } = require('textgenhub');

// Create a ChatGPT instance
const chatgpt = new ChatGPT();

// Use it in your code
chatgpt.chat("What day is it today?", { headless: true })
    .then(response => console.log(response));
```

## Running the CLI

From the project root, run:

    poetry run python ./src/textgenhub/chatgpt/chatgpt.py --prompt "What day is it today?" --headlession Test](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/regression_test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) ![Last Commit](https://img.shields.io/github/last-commit/leweex95/textgenhub)

# TextGenHub

My personal text generation hub for connecting to web-based LLMs in an automated manner.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Running the Python wrapper

From the project root, run:

    poetry run python ./src/textgenhub/chatgpt/chatgpt.py --prompt "What day is it today?" --headless

## Daily regression testing

With such web-based automation solutions it is imperative to continuously monitor any regressions. Even more so, as I actively use this project in downstream agentic workflows I design. A simple UI redesign in which OpenAI modifies the current CSS selectors would likely crash the current functionality. For this reason, the `regression_test.yml` Github Actions action was set up, scheduled for midnight each day. To make it even more robust, the input prompt will be to verify _today's date_ and the output will automatically be evaluated. 
