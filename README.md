[![Nightly regression tests](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub)

# TextGenHub

My personal text generation hub for connecting to web-based LLMs in an automated manner. The package is available for both Python and Node.js environments, allowing flexible integration into various projects.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Supported LLMs

- **ChatGPT** - OpenAI's ChatGPT via web interface
- **DeepSeek** - DeepSeek Chat via web interface (https://chat-deep.ai/deepseek-chat/)
- **Perplexity** - Perplexity AI via web interface (https://www.perplexity.ai/)

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

##### ChatGPT Continuous Mode
For continuous conversations in the same chat session:
```python
from textgenhub.chatgpt import create_chatgpt_session

# Create a continuous session
session = create_chatgpt_session(headless=True)

# Send multiple prompts in the same session
response1 = session.send_prompt("Hello, how are you?")
print(response1)

response2 = session.send_prompt("What's the weather like?")
print(response2)

# Close the session when done
session.close()
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

#### Perplexity
```python
from textgenhub.perplexity import Perplexity

# Create a Perplexity instance
perplexity = Perplexity()

# Use it in your code
response = perplexity.chat("What day is it today?", headless=True)
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

### Perplexity CLI

From the project root, run:

```bash
# Python CLI
poetry run python ./src/textgenhub/perplexity/perplexity.py --prompt "What day is it today?" --headless

# Node.js CLI
node ./src/textgenhub/perplexity/perplexity_cli.js --prompt "What day is it today?" --headless
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

# Perplexity examples
node ./src/textgenhub/perplexity/perplexity_cli.js --prompt "Explain quantum computing"
node ./src/textgenhub/perplexity/perplexity_cli.js --prompt "What is 2+2?" --headless=false
node ./src/textgenhub/perplexity/perplexity_cli.js --prompt "Hello world" --remove-cache
```

## Daily regression testing

With such web-based automation solutions it is imperative to continuously monitor any regressions. Even more so, as I actively use this project in downstream agentic workflows I design. A simple UI redesign in which any of the providers modify their current CSS selectors would likely crash the current functionality. For this reason, the `regression_test.yml` Github Actions workflow was set up, scheduled for 2 AM each day. To make it even more robust, the tests validate specific functionality for each provider and the output is automatically evaluated.

The regression testing includes:
- **ChatGPT** - Daily date validation test to ensure real-time information access
- **DeepSeek** - Daily math test (7+13=20) to ensure response generation and extraction
- **Perplexity** - Daily math test (2+2=4) to ensure response extraction and formatting

All tests run in parallel and any failure triggers email notifications with detailed information about which provider failed.

## Next steps with nightly regression failures

1. Persist Session Data Across CI Runs
How:

- Use a persistent userDataDir for the browser (e.g., chatgpt-session).
- Store this directory as a CI artifact after a successful run.
- Restore it at the start of each CI job.

Steps:

- Locally, log in to ChatGPT in non-headless mode and let the browser save cookies/session in userDataDir.
- Upload the userDataDir folder to a secure location (e.g., as a GitHub Actions artifact or a private storage bucket).
- In your CI workflow, download and restore this folder before running tests.
- Configure textgenhub to use this restored userDataDir for browser automation.

Impact:

- No need for manual login in CI.
- Session persists until ChatGPT logs you out (may need periodic refresh).

2. Automate Login with Credentials (Best for Long-Term)
How:

- Set ChatGPT credentials (email and password) as CI environment variables.
- Configure textgenhub to use these for automatic login.

Steps:

- Add your ChatGPT credentials to CI secrets (never hardcode in repo).
- Update textgenhub config to read credentials from environment variables.
- On each CI run, textgenhub will log in automatically if session is invalid.

Impact:

- Fully automated, no manual intervention.
- Credentials must be kept secure.

3. What to Avoid

- Manual login in CI: Not possible, as CI is headless and non-interactive.
- Relying on ephemeral sessions: Will break as soon as cookies expire or CI environment resets.

Summary Table

Option                 Feasibility   Steps Needed   Impact/Notes
Persist session data   High          1-4            Works until session expires
Auto-login w/ creds    High          1-3            Most robust, secure creds
Manual login in CI     Not feasible  -              Not possible

Recommendation:

- For quick fix: Persist and restore your local session data in CI.
- For robust solution: Use credentials for automatic login.

