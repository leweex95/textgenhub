[![Daily Regression Test](https://github.com/leweex95/levisLLMhub/actions/workflows/regression_test.yml/badge.svg)](https://github.com/leweex95/levisLLMhub/actions/workflows/regression_test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/levisLLMhub) ![Last Commit](https://img.shields.io/github/last-commit/leweex95/levisLLMhub)

# TextGenHub (old name: Levi's LLM Hub)

My personal text generation hub for connecting to web-based LLMs in an automated manner.

It consists of:

- **Node.js backend** – handles direct interactions with LLMs using Puppeteer and related tools.
- **Python wrapper** – allows seamless integration into Python applications and agents.

## Running the Python wrapper

From the project root, run:

    poetry run python ./src/levisllmhub/chatgpt/chatgpt.py --prompt "What day is it today?" --headless

## Daily regression testing

With such web-based automation solutions it is imperative to continuously monitor any regressions. Even more so, as I actively use this project in downstream agentic workflows I design. A simple UI redesign in which OpenAI modifies the current CSS selectors would likely crash the current functionality. For this reason, the `regression_test.yml` Github Actions action was set up, scheduled for midnight each day. To make it even more robust, the input prompt will be to verify _today's date_ and the output will automatically be evaluated. 
