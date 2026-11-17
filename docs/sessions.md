# Session Management (ChatGPT)

Sessions persist login state so you don't need to sign in every time.

## Session Storage

Sessions are stored centrally at:

`%LOCALAPPDATA%\textgenhub\sessions.json`

## CLI Commands

```bash
# List all sessions
poetry run textgenhub sessions list

# Show the sessions file path
poetry run textgenhub sessions path

# Create a new session (opens browser for login)
poetry run textgenhub sessions init

# Create a specific session index
poetry run textgenhub sessions init --index 0
poetry run textgenhub sessions init --index 2
```

## Recovering Sessions

If sessions are corrupted or you're moving to a new machine:

```powershell
# 1. Clear existing sessions
Remove-Item $env:LOCALAPPDATA\textgenhub\sessions.json

# 2. Re-initialize
poetry run textgenhub sessions init --index 0
poetry run textgenhub sessions init --index 1
poetry run textgenhub sessions init --index 2

# 3. Verify
poetry run textgenhub sessions list
```
