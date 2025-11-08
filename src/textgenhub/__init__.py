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
            subprocess.run(
                ["npm", "install"],
                cwd=root,
                check=True,
                shell=True  # required on Windows
            )
        except subprocess.CalledProcessError as e:
            print(f"npm install failed: {e}", file=sys.stderr)
            raise

# Automatically install Node dependencies on first import
_ensure_node_deps()

# Import providers to make them available at package level
try:
    from . import chatgpt
    from . import deepseek
    from . import perplexity

    # Import classes
    from .chatgpt import ChatGPT
    from .deepseek import DeepSeek
    from .perplexity import Perplexity

    __all__ = ['chatgpt', 'deepseek', 'perplexity', 'ChatGPT', 'DeepSeek', 'Perplexity']
except ImportError as e:
    print(f"Warning: Could not import some providers: {e}", file=sys.stderr)
    __all__ = []
