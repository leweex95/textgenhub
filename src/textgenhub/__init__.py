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
    from .chatgpt import ChatGPT, ask_chatgpt
    from .deepseek import DeepSeek, ask_deepseek
    from .perplexity import Perplexity, ask_perplexity
    
    __all__ = ['ChatGPT', 'ask_chatgpt', 'DeepSeek', 'ask_deepseek', 'Perplexity', 'ask_perplexity']
except ImportError as e:
    print(f"Warning: Could not import some providers: {e}", file=sys.stderr)
    __all__ = []
