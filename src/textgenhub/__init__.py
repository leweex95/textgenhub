import subprocess
from pathlib import Path
import sys
import shutil


def _ensure_node_deps():
    if not shutil.which("npm"):
        raise RuntimeError("npm is not installed or not in PATH")

    root = Path(__file__).parent
    node_modules = root / "node_modules"

    # Install Node deps for core src/textgenhub
    if not node_modules.exists():
        try:
            # On Windows, npm sometimes needs shell=True
            use_shell = sys.platform == "win32"
            cmd = "npm install" if use_shell else ["npm", "install"]
            subprocess.run(cmd, cwd=root, check=True, shell=use_shell)
        except subprocess.CalledProcessError as e:
            print(f"npm install failed: {e}", file=sys.stderr)
            raise


# Automatically install Node dependencies on first import
_ensure_node_deps()

# Web UI (browser-automation) providers
try:
    from . import webui  # noqa: F401
    from .webui import chatgpt, deepseek, grok, perplexity  # noqa: F401
    from .webui import ChatGPT, DeepSeek, Perplexity  # noqa: F401

    _webui_exports = ["webui", "chatgpt", "deepseek", "grok", "perplexity", "ChatGPT", "DeepSeek", "Perplexity"]
except ImportError as e:
    print(f"Warning: Could not import web UI providers: {e}", file=sys.stderr)
    _webui_exports = []

# API-key providers (no Node.js required)
try:
    from . import api  # noqa: F401
    from .api import deepseek  # noqa: F401
    from .api.deepseek import DeepSeekAPI  # noqa: F401

    _api_exports = ["api", "deepseek", "DeepSeekAPI"]
except ImportError as e:
    print(f"Warning: Could not import api providers: {e}", file=sys.stderr)
    _api_exports = []

# Local inference providers (no Node.js required)
try:
    from . import local  # noqa: F401
    from .local import ollama  # noqa: F401
    from .local.ollama import Ollama  # noqa: F401

    _local_exports = ["local", "ollama", "Ollama"]
except ImportError as e:
    print(f"Warning: Could not import local providers: {e}", file=sys.stderr)
    _local_exports = []

__all__ = _webui_exports + _api_exports + _local_exports
