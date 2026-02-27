"""
ChatGPT provider (new) - thin wrapper over chatgpt-session CLI
"""
import json
import subprocess
from pathlib import Path
from typing import Any

from ..core.provider import SimpleProvider


def ask(
    prompt: str,
    headless: bool = True,
    remove_cache: bool = True,
    debug: bool = False,
    timeout: int = 120,
    typing_speed: float | None = None,
    session: int | None = None,
    close: bool = False,
    max_trials: int = 10,
) -> str:
    """
    Send a prompt to ChatGPT and get a response using the new session-based module.

    Args:
        prompt (str): The prompt to send to ChatGPT
        headless (bool): Ignored by session-based module (kept for compatibility)
        remove_cache (bool): Ignored by session-based module (kept for compatibility)
        debug (bool): Whether to enable debug mode
        timeout (int): Timeout in seconds for the operation
        typing_speed (float | None): Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)
        session (int | None): Specific session index to reuse (when using the session-based CLI)
        close (bool): Close the browser session after the request completes
        max_trials (int): Maximum number of retries on rate limit (default: 10)

    Returns:
        str: The response from ChatGPT
    """
    provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
    return provider.ask(
        prompt,
        headless=headless,
        remove_cache=remove_cache,
        debug=debug,
        timeout=timeout,
        typing_speed=typing_speed,
        session=session,
        close=close,
        max_trials=max_trials,
    )


def close(session: int | None = None) -> None:
    """
    Close the browser session for ChatGPT.

    Args:
        session (int | None): Specific session index to close (default: last used)
    """
    provider = SimpleProvider("chatgpt", "chatgpt_cli.js")
    provider.ask(None, session=session, close=True)


def check_sessions(session: int | None = None) -> list[dict[str, Any]]:
    """
    Check the health / login status of one or all ChatGPT sessions.

    For each session the check verifies:
      1. Whether the browser is running (debug port reachable).
      2. Whether the ChatGPT page is loaded and the user is logged in.

    The ``loginStatus`` field in sessions.json is updated with the live result.

    Args:
        session (int | None): A specific session index to check.
            When ``None`` (default) all sessions are checked.

    Returns:
        list[dict]: One dict per checked session with keys:
            ``index``, ``id``, ``name``, ``debugPort``,
            ``browserRunning`` (bool), ``loginStatus`` (str),
            ``error`` (str | None), ``checkedAt`` (ISO timestamp).

    Raises:
        RuntimeError: If the check script is missing or produces no output.
    """
    script = Path(__file__).parent / "check_session.js"
    if not script.exists():
        raise RuntimeError(f"Check script not found: {script}")

    cmd = ["node", str(script)]
    if session is not None:
        cmd.extend(["--index", str(session)])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        cwd=script.parent,
        encoding="utf-8",
        errors="replace",
    )

    stdout = (result.stdout or "").strip()
    if not stdout:
        raise RuntimeError(
            f"check_session.js produced no output. stderr: {result.stderr}"
        )

    # The script may emit multiple lines; the JSON result is the last line.
    json_line = None
    for line in stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("{"):
            json_line = stripped

    if not json_line:
        raise RuntimeError(
            f"check_session.js did not produce JSON output. stdout: {stdout}"
        )

    data = json.loads(json_line)
    if "error" in data and not data.get("results"):
        raise RuntimeError(data["error"])

    return data["results"]


def reinit_session(session: int) -> None:
    """
    Re-initialise a specific ChatGPT session.

    This opens a browser window so the user can log in again.  The existing
    session entry at the given index is replaced with a fresh one.

    Args:
        session (int): The session index to re-initialise.

    Raises:
        ValueError: If *session* is not a valid integer.
        RuntimeError: If the init script is missing or fails.
    """
    if not isinstance(session, int):
        raise ValueError(f"session must be an integer, got {type(session).__name__}")

    script = Path(__file__).parent / "init_session.js"
    if not script.exists():
        raise RuntimeError(f"Init script not found: {script}")

    cmd = ["node", str(script), "--index", str(session)]
    result = subprocess.run(
        cmd,
        text=True,
        cwd=script.parent,
        encoding="utf-8",
        errors="replace",
    )

    if result.returncode != 0:
        raise RuntimeError(
            f"init_session.js exited with code {result.returncode}"
        )
