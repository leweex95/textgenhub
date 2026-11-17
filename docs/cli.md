# CLI Reference

## Usage

```bash
poetry run textgenhub <provider> [options]
```

## Providers

| Provider | Command | Requires |
|---|---|---|
| ChatGPT | `textgenhub chatgpt` | Node.js + Chrome |
| DeepSeek (browser) | `textgenhub deepseek` | Node.js + Chrome |
| Perplexity | `textgenhub perplexity` | Node.js + Chrome |
| Grok | `textgenhub grok` | Node.js + Chrome |
| Ollama | `textgenhub ollama` | Ollama running |
| DeepSeek API | `textgenhub deepseek-api` | API key |

## All Options

| Option | Description | Providers |
|---|---|---|
| `--prompt` | The text prompt to send | All |
| `--headless` | Run browser headless (default: true) | Web UI |
| `--output-format` | `json` (default), `html`, or `raw` | Web UI / Ollama |
| `--timeout` | Timeout in seconds | All |
| `--typing-speed` | Seconds per character | Web UI |
| `--session` | Session index | ChatGPT |
| `--close` | Close session after response | ChatGPT |
| `--model` | Model name | Ollama / DeepSeek API |
| `--host` | Ollama host | Ollama |
| `--port` | Ollama port | Ollama |
| `--system-prompt` | System prompt | Ollama / DeepSeek API |
| `--api-key` | DeepSeek API key | DeepSeek API |
| `--temperature` | Sampling temperature (0.0–2.0) | DeepSeek API |
| `--max-tokens` | Max output tokens | DeepSeek API |

## Examples

### ChatGPT

```bash
# Basic
poetry run textgenhub chatgpt --prompt "Explain quantum computing"

# Character-by-character typing
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --typing-speed 0.05

# Specific session with auto-close
poetry run textgenhub chatgpt --prompt "Explain quantum computing" --session 1 --close
```

### Ollama

```bash
# JSON output (default)
poetry run textgenhub ollama --prompt "What is machine learning?" --model llama3

# Raw text output
poetry run textgenhub ollama --prompt "What is machine learning?" --model llama3 --output-format raw

# With system prompt
poetry run textgenhub ollama --prompt "Translate to French: Hello world" \
    --model llama3 --system-prompt "You are a translator"
```

### DeepSeek API

```bash
# Basic
DEEPSEEK_API_KEY=sk-... poetry run textgenhub deepseek-api --prompt "What is machine learning?"

# Custom model and temperature
DEEPSEEK_API_KEY=sk-... poetry run textgenhub deepseek-api --prompt "Write Python code" \
    --model deepseek-coder --temperature 0.7 --max-tokens 500

# Raw output
DEEPSEEK_API_KEY=sk-... poetry run textgenhub deepseek-api --prompt "Tell me a joke" --output-format raw
```

## Output Formats

### JSON (default)

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

### HTML / Raw

```bash
# HTML output
poetry run textgenhub chatgpt --prompt "Generate a report" --output-format html

# Raw text (no metadata)
poetry run textgenhub chatgpt --prompt "Summarize the crisis" --output-format raw
```
