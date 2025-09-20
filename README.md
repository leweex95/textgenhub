# Levi's LLM Hub

My personal LLM hub for connecting to web-based LLMs.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Running the Python wrapper

From the project root, run:

    poetry run python ./src/levisLLMhub/chatgpt/chatgpt.py --prompt "What day is it today?" --headless
