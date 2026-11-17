# Development

## Project Structure

```
src/textgenhub/
├── webui/            # Browser automation (ChatGPT, DeepSeek, Perplexity, Grok)
│   ├── chatgpt/
│   ├── deepseek/
│   ├── grok/
│   └── perplexity/
├── local/            # Local inference (Ollama)
│   └── ollama/
├── api/              # API-key providers (DeepSeek API)
│   └── deepseek/
├── core/             # Shared provider base class
└── utils/            # Shared utilities
```

## Package.json

This project maintains two `package.json` files:

- `./package.json` — npm package manifest
- `./src/textgenhub/package.json` — Node.js dependencies for web UI providers

When modifying Node.js dependencies, update **both** files.

## Provider Architecture

Each provider has a Python wrapper that calls a Node.js CLI script:

```
provider.py ──> node provider_cli.js ──> puppeteer / REST API
```

The base class (`SimpleProvider`) handles subprocess invocation. Path resolution is strict:

```python
provider = SimpleProvider("chatgpt", "chatgpt_cli.js", script_dir=Path(__file__).parent)
```

## Adding a New Provider

1. Create `src/textgenhub/webui/<name>/` (or `local/` / `api/`)
2. Add `__init__.py`
3. Create `<name>.py` with an `ask()` function using `SimpleProvider`
4. Create `<name>_cli.js` (Node.js script, outputs JSON to stdout)
5. Export from `src/textgenhub/__init__.py`
6. Add CLI subparser in `src/textgenhub/cli.py`

## Testing

```bash
poetry install --with dev
pytest
```

## Dev Tools

Run `.\setup.ps1` and answer "y" to the dev tools prompt, or install manually:

### Ponytail (AGENTS.md)

The `AGENTS.md` file defines the project's coding philosophy — "lazy senior dev mode." It's not a package; it's a constraint file that tells agents (and humans) to prefer minimal code, no over-engineering, and stdlib over dependencies. It's version-controlled in the repo root.

### Graphify

Graphify generates a code dependency graph (`graphify-out/`) to help agents understand the codebase structure. It's a compiled Windows binary.

```powershell
# Install (manual download)
# Download from: https://github.com/anthropics/graphify/releases
# Place graphify.exe somewhere in PATH

# Generate/update the code graph
graphify update .

# Output lives in graphify-out/ (gitignored)
```

### Pre-commit Hooks

```powershell
poetry run pre-commit install
```

## CI

- **Nightly regression tests** run against all providers
- **Codecov** tracks Python test coverage
- GitHub Actions workflows in `.github/workflows/`
