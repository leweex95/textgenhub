#!/usr/bin/env python3
"""
ChatGPT Tab Manager - Ensures ChatGPT tab is open and focused in Chrome
Uses Windows API to find and focus Chrome windows with ChatGPT tabs
"""

import time
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from browser_utils import is_chrome_running

try:
    import win32gui
    import win32con
    import win32api
    import win32process

    WINDOWS_API_AVAILABLE = True
except ImportError:
    WINDOWS_API_AVAILABLE = False
    print("[Tab Manager] pywin32 not available, Windows API features disabled", file=sys.stderr)


class ChatGPTTabManager:
    def __init__(self):
        self.chatgpt_keywords = ["chatgpt", "chat gpt", "openai", "chat.openai.com", "chatgpt.com", "gpt", "ai chat"]

    def get_chrome_windows(self):
        """Get all Chrome window handles and their titles"""
        chrome_windows = []

        def enum_windows_callback(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    title = win32gui.GetWindowText(hwnd)
                    if title and ("Chrome" in title or "Google Chrome" in title):
                        # Get process name to confirm it's Chrome
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        try:
                            handle = win32api.OpenProcess(win32con.PROCESS_QUERY_INFORMATION | win32con.PROCESS_VM_READ, False, pid)
                            exe_name = win32process.GetModuleFileNameEx(handle, 0)
                            win32api.CloseHandle(handle)
                            if "chrome.exe" in exe_name.lower():
                                chrome_windows.append((hwnd, title))
                        except Exception:
                            pass  # Skip if we can't get process info
                except Exception:
                    pass  # Skip windows we can't access
            return True

        win32gui.EnumWindows(enum_windows_callback, None)
        return chrome_windows

    def is_chatgpt_window(self, title):
        """Check if a window title indicates a ChatGPT tab"""
        title_lower = title.lower()

        # Exclude extension pages and settings
        exclude_keywords = ["extensions", "settings", "chrome://", "new tab", "downloads", "history", "bookmarks"]

        for exclude in exclude_keywords:
            if exclude in title_lower:
                return False

        # Check for ChatGPT keywords
        return any(keyword in title_lower for keyword in self.chatgpt_keywords)

    def focus_window(self, hwnd):
        """Bring window to front and focus it"""
        try:
            # Restore if minimized
            if win32gui.IsIconic(hwnd):
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)

            # Bring to front
            win32gui.SetForegroundWindow(hwnd)

            # Additional focus attempt
            win32gui.BringWindowToTop(hwnd)

            return True
        except Exception as e:
            print(f"[Tab Manager] Failed to focus window: {e}", file=sys.stderr)
            return False

    def open_chatgpt_in_chrome(self):
        """Open ChatGPT in a new Chrome tab using system default browser"""
        import subprocess

        try:
            # Use start command to open URL in default browser
            subprocess.run(["cmd", "/c", "start", "https://chat.openai.com/"], shell=True)
            print("[Tab Manager] Opened ChatGPT in new tab", file=sys.stderr)
            time.sleep(5)  # Wait longer for tab to open and title to update
            return True
        except Exception as e:
            print(f"[Tab Manager] Failed to open ChatGPT: {e}", file=sys.stderr)
            return False

    def ensure_chatgpt_tab_focused(self):
        """Main function to ensure ChatGPT tab is open and focused"""
        if not WINDOWS_API_AVAILABLE:
            print("[Tab Manager] Windows API not available. Please install pywin32.", file=sys.stderr)
            return False

        print("[Tab Manager] Checking Chrome status...", file=sys.stderr)

        # Check if Chrome is running
        if not is_chrome_running():
            print("[Tab Manager] Chrome is not running. Please start Chrome first.", file=sys.stderr)
            return False

        # Get all Chrome windows
        chrome_windows = self.get_chrome_windows()
        print(f"[Tab Manager] Found {len(chrome_windows)} Chrome windows", file=sys.stderr)

        # Look for ChatGPT windows
        chatgpt_windows = []
        for hwnd, title in chrome_windows:
            if self.is_chatgpt_window(title):
                chatgpt_windows.append((hwnd, title))

        if chatgpt_windows:
            # Focus the first ChatGPT window found
            hwnd, title = chatgpt_windows[0]
            print(f"[Tab Manager] Found ChatGPT window: {title}", file=sys.stderr)
            if self.focus_window(hwnd):
                print("[Tab Manager] ChatGPT tab focused successfully!")
                return True
            else:
                print("[Tab Manager] Failed to focus ChatGPT window", file=sys.stderr)
                return False
        else:
            print("[Tab Manager] No ChatGPT tab found, opening new one...", file=sys.stderr)
            if self.open_chatgpt_in_chrome():
                # Since window titles don't update immediately, let's focus the main Chrome window
                # and inform the user that ChatGPT should be open
                print("[Tab Manager] ChatGPT tab opened in Chrome.", file=sys.stderr)
                print("[Tab Manager] Note: You may need to manually switch to the ChatGPT tab in Chrome.", file=sys.stderr)

                # Try to focus the first Chrome window to bring Chrome to front
                if chrome_windows:
                    hwnd, title = chrome_windows[0]
                    print(f"[Tab Manager] Bringing Chrome window to front: {title}", file=sys.stderr)
                    return self.focus_window(hwnd)

                return True
            else:
                return False


def main():
    """Main entry point"""
    manager = ChatGPTTabManager()

    if manager.ensure_chatgpt_tab_focused():
        print("[Tab Manager] Operation completed successfully!")
        return True
    else:
        print("[Tab Manager] Operation failed.")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
