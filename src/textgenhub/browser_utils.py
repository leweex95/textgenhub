#!/usr/bin/env python3
"""
Browser utility functions for Chrome detection and management
"""
import subprocess
import sys
import time
import os
from pathlib import Path


def find_chrome_executable():
    """Find Chrome executable on Windows"""
    possible_paths = [
        Path(os.environ.get("USERPROFILE", "")) / "AppData" / "Local" / "Google" / "Chrome" / "Application" / "chrome.exe",
        Path("C:/Program Files/Google/Chrome/Application/chrome.exe"),
        Path("C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"),
    ]

    for path in possible_paths:
        if path.exists():
            return str(path)

    return None


def is_chrome_running():
    """Check if Chrome process is currently running"""
    try:
        result = subprocess.run(["tasklist"], capture_output=True, text=True, timeout=5)
        return "chrome.exe" in result.stdout.lower()
    except Exception as e:
        print(f"[Browser Utils] Error checking Chrome process: {e}", file=sys.stderr)
        return False


def launch_chrome():
    """Launch Chrome if not already running"""
    chrome_path = find_chrome_executable()

    if not chrome_path:
        raise FileNotFoundError("Chrome not found. Please install Google Chrome.")

    if is_chrome_running():
        print("[Browser Utils] Chrome is already running", file=sys.stderr)
        return True

    try:
        print(f"[Browser Utils] Launching Chrome from: {chrome_path}", file=sys.stderr)
        subprocess.Popen([chrome_path])

        # Wait for Chrome to fully start
        print("[Browser Utils] Waiting for Chrome to start...", file=sys.stderr)
        for i in range(30):  # Wait up to 30 seconds
            time.sleep(1)
            if is_chrome_running():
                print("[Browser Utils] Chrome started successfully", file=sys.stderr)
                return True

        print("[Browser Utils] Chrome didn't start within timeout", file=sys.stderr)
        return False

    except Exception as e:
        print(f"[Browser Utils] Error launching Chrome: {e}", file=sys.stderr)
        return False


def ensure_chrome_running():
    """Ensure Chrome is running, launch if needed"""
    if is_chrome_running():
        return True

    print("[Browser Utils] Chrome not running, attempting to launch...", file=sys.stderr)
    return launch_chrome()
