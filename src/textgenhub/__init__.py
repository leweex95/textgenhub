import subprocess
from pathlib import Path
import sys
import shutil


def _ensure_node_deps():
    if not shutil.which("npm"):
        raise RuntimeError("npm is not installed or not in PATH")

    root = Path(__file__).parent
    node_modules = root / "node_modules"

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

# Import providers to make them available at package level
try:
    from . import chatgpt  # noqa: F401
    from . import deepseek  # noqa: F401
    from . import perplexity  # noqa: F401

    # Import classes
    from .chatgpt import ChatGPT  # noqa: F401
    from .deepseek import DeepSeek  # noqa: F401
    from .perplexity import Perplexity  # noqa: F401

    __all__ = ["chatgpt", "deepseek", "perplexity", "ChatGPT", "DeepSeek", "Perplexity"]
except ImportError as e:
    print(f"Warning: Could not import some providers: {e}", file=sys.stderr)
    __all__ = []
