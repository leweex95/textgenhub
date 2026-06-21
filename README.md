[![Nightly regression tests](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml/badge.svg)](https://github.com/leweex95/textgenhub/actions/workflows/nightly-regression-test.yml) ![Python Version](https://img.shields.io/badge/python-3.11%2B-blue) ![License](https://img.shields.io/github/license/leweex95/textgenhub) [![codecov](https://codecov.io/gh/leweex95/textgenhub/branch/master/graph/badge.svg)](https://codecov.io/gh/leweex95/textgenhub)

# TextGenHub

A text generation hub for connecting to various LLMs — web-based browsers, local models, and cloud APIs — from Python or Node.js.

## Supported Providers

| Provider | Type | API Key | Node.js |
|---|---|---|---|
| [ChatGPT](docs/python.md#chatgpt) | Web UI (browser) | OpenAI account | Yes |
| [DeepSeek](docs/python.md#web-ui-providers) | Web UI (browser) | DeepSeek account | Yes |
| [Perplexity](docs/python.md#web-ui-providers) | Web UI (browser) | Perplexity account | Yes |
| [Grok](docs/python.md#web-ui-providers) | Web UI (browser) | X/Twitter account | Yes |
| [Ollama](docs/python.md#ollama) | Local REST | None | No |
| [DeepSeek API](docs/python.md#deepseek-api) | Cloud REST | DeepSeek key | No |

## Quick Start

```powershell
# 1. Install everything (Python deps, Node deps, optionally Ollama + dev tools)
.\setup.ps1

# 2. Try it
poetry run textgenhub ollama --prompt "Hello, world!"
```

## Switch Providers

Same CLI, different provider:

```powershell
poetry run textgenhub ollama --prompt "hi"                         # local model
poetry run textgenhub deepseek-api --prompt "hi"                   # cloud API
poetry run textgenhub chatgpt --prompt "hi"                        # browser automation
```

## Docs

| Topic | File |
|---|---|
| Python usage (all providers) | [docs/python.md](docs/python.md) |
| Node.js usage | [docs/nodejs.md](docs/nodejs.md) |
| CLI reference (flags, examples) | [docs/cli.md](docs/cli.md) |
| ChatGPT session management | [docs/sessions.md](docs/sessions.md) |
| Development & architecture | [docs/development.md](docs/development.md) |
