# chatgpt-attach

Node.js and Python tools to send prompts to ChatGPT via browser automation. No API key needed.

## Install

```bash
cd packages/chatgpt-attach
npm install
```

## Setup (One-time)

1. **Launch Chrome with persistent profile:**
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\csibi\AppData\Local\chromium-chatgpt" `
  --disable-background-timer-throttling `
  --disable-backgrounding-occluded-windows `
  --disable-renderer-backgrounding `
  https://chat.openai.com/
```

2. **Login to ChatGPT** in the browser window that opens.

3. **Close the browser** - your session is saved!

## Usage

### Node.js CLI

#### Basic Command
```bash
node bin/send-prompt-cli.js --prompt "Your question here"
```

#### Options
- `--prompt "text"` - Your question (required)
- `--json` - JSON output with events and metadata (default)
- `--html` - HTML formatted output
- `--raw` - Plain text output only
- `--close` - Close browser after response (default: keep open)
- `--timeout 120` - Wait longer for response in seconds (default: 120)
- `--debug` - Enable debug output

#### Examples
```bash
# JSON output with events (recommended)
node bin/send-prompt-cli.js --prompt "What is AI?" --json

# Multiple questions (browser stays open between them)
node bin/send-prompt-cli.js --prompt "First question" --json
node bin/send-prompt-cli.js --prompt "Follow-up" --json

# Close browser after one-time query
node bin/send-prompt-cli.js --prompt "One-time query" --close --json

# Plain text output
node bin/send-prompt-cli.js --prompt "Hello" --raw

# HTML output
node bin/send-prompt-cli.js --prompt "Hello" --html

# Custom timeout for long responses
node bin/send-prompt-cli.js --prompt "Write a long essay" --timeout 300 --json
```

### Python CLI

#### Basic Command
```bash
python chatgpt_cli_wrapper.py --prompt "Your question here"
```

#### Options
- `--prompt "text"` - Your question (required)
- `--format raw|json|html` - Output format (default: raw)
- `--timeout 120` - Wait longer for response in seconds (default: 120)
- `--debug` - Enable debug output

#### Examples
```bash
# JSON output with metadata
python chatgpt_cli_wrapper.py --prompt "What is Python?" --format json

# Raw text output
python chatgpt_cli_wrapper.py --prompt "Hello world" --format raw

# HTML output
python chatgpt_cli_wrapper.py --prompt "Hello world" --format html

# Custom timeout
python chatgpt_cli_wrapper.py --prompt "Write a long story" --timeout 300 --format json
```

### JSON Events

When using default/JSON output, the CLI emits structured events:
- `connecting` - Connecting to browser
- `launching_chrome` - Starting new Chrome instance
- `connected` - Successfully connected
- `prompt_sent` - Prompt submitted
- `response_waiting` - Waiting for response (with current length)
- `response_received` - Final response received
- `session_kept_open` - Browser remains open for reuse

## Python Library Usage

```python
from chatgpt_cli_wrapper import ask_chatgpt, ChatGPTCLI

# Simple usage
response = ask_chatgpt("What is Python?", format="raw")

# Advanced usage with class
cli = ChatGPTCLI()
result = cli.ask("Explain quantum computing", format="json", timeout=180)

# Different formats
raw_text = cli.ask("Hello", format="raw")
json_data = cli.ask("Hello", format="json")
html_content = cli.ask("Hello", format="html")
```

## Troubleshooting

### "Login required"
- Close browser, relaunch Chrome with the same command, and re-login

### Cloudflare "Verify you are human"
- Complete the verification in browser - it will be remembered

### Timeout Errors
- **Default timeout is now 120 seconds** (increased from 60)
- For very long responses, use `--timeout 300` or higher
- Timeout errors now show helpful suggestions for increasing the limit

### Browser Connection Issues
- Ensure Chrome is running with `--remote-debugging-port=9222`
- Check that the user data directory path is correct for your system
