# TextGenHub Library Patches

This document outlines the patches applied to the `textgenhub` library (installed via git branch `feature/code-block-extraction`) to support the translation pipeline requirements and fix path resolution issues in installed environments.

## 1. Path Resolution Fix in `chatgpt_cli.js`

### File: `textgenhub/chatgpt/chatgpt_cli.js`

**Issue:**
The original `getRepoRoot()` function assumed the script was running from a development repository structure where the root is three levels up from the script location. When installed as a package in a virtual environment (`.venv/Lib/site-packages/textgenhub`), this caused the library to look for `sessions.json` in the wrong location (outside the package), leading to failures.

**Patch:**
```javascript
// Original
function getRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

// Patched
function getRepoRoot() {
  return path.resolve(__dirname, '..');
}
```

**Safety Analysis:**
This patch is **necessary** for the library to function correctly when installed as a dependency. It ensures that `sessions.json` is looked for within the `textgenhub` package directory. It does not affect the core logic of ChatGPT interaction.

---

## 2. Support for `session` and `close` Arguments in Python Wrapper

### Files: `textgenhub/chatgpt/chatgpt.py` and `textgenhub/core/provider.py`

**Issue:**
The underlying Node.js CLI (`chatgpt_cli.js`) supports `--session` (to use specific browser profiles) and `--close` (to close the browser after a request) flags. However, the Python `SimpleProvider` and the `chatgpt.ask` function did not expose these parameters, making it impossible to utilize these features from Python code.

**Patch in `textgenhub/chatgpt/chatgpt.py`:**
Added `session` and `close` parameters to the `ask` function and passed them to the provider.

**Patch in `textgenhub/core/provider.py`:**
Updated the `ask` method to accept `session` and `close` and append the corresponding flags to the Node.js command execution.

```python
# Example of change in provider.py
if self.provider_name == "chatgpt":
    cmd = [self.node_path, str(self.cli_script), "--prompt", prompt, "--timeout", str(timeout)]
    if typing_speed is not None:
        cmd.extend(["--typing-speed", str(typing_speed)])
    if session:
        cmd.extend(["--session", session])
    if close:
        cmd.append("--close")
```

**Safety Analysis:**
These changes are **backwards compatible**.
- The new arguments have default values (`session=None`, `close=False`).
- Existing code calling `textgenhub.chatgpt.ask(prompt)` will continue to work exactly as before.
- It only enables new functionality that was already present in the Node.js layer but inaccessible from Python.

---

## Summary for TextGenHub Team
These patches fix a critical path bug for installed users and expose existing CLI features to the Python API. We recommend incorporating these into the next release to improve the library's usability as a package.
