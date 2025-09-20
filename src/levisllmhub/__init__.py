import subprocess
from pathlib import Path
import sys

def _ensure_node_deps():
    root = Path(__file__).parent
    node_modules = root / "node_modules"

    if not node_modules.exists():
        try:
            subprocess.run(
                ["npm", "install"],
                cwd=root,
                check=True
            )
        except FileNotFoundError:
            print("Error: npm is not installed or not in PATH", file=sys.stderr)
            raise
        except subprocess.CalledProcessError as e:
            print(f"npm install failed: {e}", file=sys.stderr)
            raise

# Automatically install Node dependencies on first import
_ensure_node_deps()
