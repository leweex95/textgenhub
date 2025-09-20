import subprocess
from pathlib import Path

def _ensure_node_deps():
    root = Path(__file__).parent
    node_modules = root / "node_modules"
    if not node_modules.exists():
        subprocess.run(
            ["npm", "install"],
            cwd=root,
            check=True
        )

# On first import, install all Node.js related dependencies
_ensure_node_deps()
