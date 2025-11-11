#!/usr/bin/env python3
"""
ChatGPT Tab Manager - Ensures ChatGPT tab is open and focused in Chrome
Uses WebSocket communication with Chrome extension for reliable tab management
"""

import asyncio
import json
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

from browser_utils import is_chrome_running

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    import websockets

    WEBSOCKETS_AVAILABLE = True
except ImportError:
    WEBSOCKETS_AVAILABLE = False

if not WEBSOCKETS_AVAILABLE:
    print(f"[{datetime.now().isoformat()}] [Tab Manager] websockets not available, WebSocket features disabled", file=sys.stderr)


class ChatGPTTabManager:
    def __init__(self):
        self.ws_url = "ws://127.0.0.1:8765"
        self.timeout = 30  # seconds

    def check_server_running(self):
        """Check if the WebSocket server is running and accessible"""
        if not WEBSOCKETS_AVAILABLE:
            raise RuntimeError("websockets library not available. Please install websockets library.")

        try:
            # Try to connect to the server with a short timeout
            import asyncio

            async def test_connection():
                try:
                    # Try to establish connection with timeout
                    connect_coro = websockets.connect(self.ws_url)
                    websocket = await asyncio.wait_for(connect_coro, timeout=2.0)
                    # If we get here, connection succeeded - close it immediately
                    await websocket.close()
                    return True
                except Exception as e:
                    print(f"[{datetime.now().isoformat()}] [DEBUG] Connection test failed: {e}", file=sys.stderr)
                    return False

            result = asyncio.run(test_connection())
            if not result:
                raise RuntimeError(f"WebSocket server not running at {self.ws_url}\n" "Please start the server first:\n" "  cd src/textgenhub/chatgpt_extension_cli/cli\n" "  python server.py")
        except Exception as e:
            if "WebSocket server not running" in str(e):
                raise e
            raise RuntimeError(
                f"Cannot connect to WebSocket server at {self.ws_url}: {e}\n" "Please ensure the server is running:\n" "  cd src/textgenhub/chatgpt_extension_cli/cli\n" "  python server.py"
            )

    async def send_focus_request(self):
        """Send focus_tab request to the extension via WebSocket"""
        print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Connecting to WebSocket at {self.ws_url}", file=sys.stderr)
        try:
            async with websockets.connect(self.ws_url) as websocket:
                message_id = str(uuid.uuid4())

                # Send focus_tab request
                request = {"type": "cli_request", "request_type": "focus_tab", "messageId": message_id}

                print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Sending focus_tab request: {json.dumps(request)}", file=sys.stderr)
                await websocket.send(json.dumps(request))

                # Wait for response
                start_time = time.time()
                timeout = 5  # 5 seconds for testing
                print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Waiting for response (timeout: {timeout}s)...", file=sys.stderr)
                while time.time() - start_time < timeout:
                    try:
                        print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Waiting for message on WebSocket...", file=sys.stderr)
                        response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received WebSocket message: {response}", file=sys.stderr)
                        data = json.loads(response)

                        if data.get("messageId") == message_id and data.get("type") == "response":
                            success = data.get("success", False)
                            error = data.get("error")

                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Response success={success}, error={error}", file=sys.stderr)
                            if success:
                                print(f"[{datetime.now().isoformat()}] [Tab Manager] ChatGPT tab focused successfully via extension!", file=sys.stderr)
                                return True
                            else:
                                print(f"[{datetime.now().isoformat()}] [Tab Manager] Failed to focus tab: {error}", file=sys.stderr)
                                return False
                        elif data.get("type") == "ack":
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received ACK for message {data.get('messageId')}", file=sys.stderr)
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Extension is connected and responding!", file=sys.stderr)
                        elif data.get("type") == "error":
                            error_msg = data.get("error", "Unknown error")
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received error: {error_msg}", file=sys.stderr)
                        else:
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received other message type: {data.get('type')}", file=sys.stderr)

                    except asyncio.TimeoutError:
                        print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Timeout waiting for message, continuing...", file=sys.stderr)
                        continue

                print(f"[{datetime.now().isoformat()}] [Tab Manager] Timeout waiting for focus response after {timeout}s", file=sys.stderr)
                return False

        except Exception as e:
            print(f"[{datetime.now().isoformat()}] [Tab Manager] WebSocket error: {e}", file=sys.stderr)
            return False

    def open_chatgpt_in_chrome(self):
        """Open ChatGPT in a new Chrome tab using system default browser"""
        import subprocess

        try:
            # Use start command to open URL in default browser
            subprocess.run(["cmd", "/c", "start", "https://chat.openai.com/"], shell=True)
            print(f"[{datetime.now().isoformat()}] [Tab Manager] Opened ChatGPT in new tab", file=sys.stderr)
            time.sleep(5)  # Wait longer for tab to open and extension to load
            return True
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] [Tab Manager] Failed to open ChatGPT: {e}", file=sys.stderr)
            return False

    def ensure_chatgpt_tab_focused(self):
        """Main function to ensure ChatGPT tab is open and focused"""
        # Check server first
        self.check_server_running()

        print(f"[{datetime.now().isoformat()}] [Tab Manager] Checking Chrome status...", file=sys.stderr)

        # Check if Chrome is running
        if not is_chrome_running():
            print(f"[{datetime.now().isoformat()}] [Tab Manager] Chrome is not running. Please start Chrome first.", file=sys.stderr)
            return False

        # First, check for existing ChatGPT tabs
        print(f"[{datetime.now().isoformat()}] [Tab Manager] Checking for existing ChatGPT tabs...", file=sys.stderr)
        tabs = asyncio.run(self.debug_tabs())

        # Look for ChatGPT tabs in the debug output
        chatgpt_tabs = []
        for tab in tabs:
            url = tab.get("url", "").lower()
            title = tab.get("title", "").lower()
            # Exclude chrome:// URLs and be more specific about ChatGPT detection
            if url.startswith("chrome://") or not any(domain in url for domain in ["chatgpt.com", "chat.openai.com", "openai.com"]):
                continue
            if "chatgpt" in title or "openai" in title:
                chatgpt_tabs.append(tab)

        if chatgpt_tabs:
            print(f"[Tab Manager] Found {len(chatgpt_tabs)} existing ChatGPT tab(s):", file=sys.stderr)
            for tab in chatgpt_tabs:
                print(f"[Tab Manager]   Tab {tab['id']}: {tab['url']} - '{tab['title']}' - active: {tab['active']}", file=sys.stderr)

            # Try to focus existing ChatGPT tab via extension
            print("[Tab Manager] Attempting to focus existing ChatGPT tab via extension...", file=sys.stderr)
            success = asyncio.run(self.send_focus_request())
            if success:
                print("[Tab Manager] Successfully focused existing ChatGPT tab!")
                return True
            else:
                print("[Tab Manager] Failed to focus existing tab. Extension may not be connected.", file=sys.stderr)
                return False
        else:
            print("[Tab Manager] No existing ChatGPT tabs found, opening new one...", file=sys.stderr)
            if self.open_chatgpt_in_chrome():
                # Wait for the new tab to load and extension to connect
                print("[Tab Manager] Waiting for new tab to load...", file=sys.stderr)
                time.sleep(3)

                # Try focusing the newly opened tab
                print("[Tab Manager] Attempting to focus the newly opened ChatGPT tab...", file=sys.stderr)
                success = asyncio.run(self.send_focus_request())
                if success:
                    print("[Tab Manager] Successfully focused newly opened ChatGPT tab!")
                    return True

        print("[Tab Manager] All focus attempts failed. ChatGPT may be open but not focused.", file=sys.stderr)
        return False

    async def debug_tabs(self):
        """Get debug information about all tabs from the extension"""
        print("[Tab Manager] DEBUG: Requesting tab information from extension", file=sys.stderr)
        try:
            async with websockets.connect(self.ws_url) as websocket:
                message_id = str(uuid.uuid4())

                # Send debug_tabs request
                request = {"type": "cli_request", "request_type": "debug_tabs", "messageId": message_id}

                print(f"[Tab Manager] DEBUG: Sending debug_tabs request: {json.dumps(request)}", file=sys.stderr)
                await websocket.send(json.dumps(request))

                # Wait for response
                start_time = time.time()
                timeout = 10
                print(f"[Tab Manager] DEBUG: Waiting for debug response (timeout: {timeout}s)...", file=sys.stderr)
                while time.time() - start_time < timeout:
                    try:
                        print("[Tab Manager] DEBUG: Waiting for message on WebSocket...", file=sys.stderr)
                        response = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                        print(f"[Tab Manager] DEBUG: Received WebSocket message: {response}", file=sys.stderr)
                        data = json.loads(response)

                        if data.get("messageId") == message_id and data.get("type") == "response":
                            tabs = data.get("tabs", [])
                            tab_count = data.get("tab_count", 0)

                            print(f"[Tab Manager] DEBUG: Extension reports {tab_count} total tabs:", file=sys.stderr)
                            for tab in tabs:
                                print(f"[Tab Manager]   Tab {tab['id']}: {tab['url']} - '{tab['title']}' - active: {tab['active']}", file=sys.stderr)

                            return tabs
                        elif data.get("type") == "ack":
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received ACK for debug message {data.get('messageId')}", file=sys.stderr)
                        elif data.get("type") == "error":
                            error_msg = data.get("error", "Unknown error")
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received error: {error_msg}", file=sys.stderr)
                            return []
                        else:
                            print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Received other message type: {data.get('type')}", file=sys.stderr)

                    except asyncio.TimeoutError:
                        print(f"[{datetime.now().isoformat()}] [Tab Manager] DEBUG: Timeout waiting for message, continuing...", file=sys.stderr)
                        continue

                print(f"[{datetime.now().isoformat()}] [Tab Manager] Timeout waiting for debug response after {timeout}s", file=sys.stderr)
                return []

        except Exception as e:
            print(f"[Tab Manager] WebSocket error: {e}", file=sys.stderr)
            return []

    def debug_all_tabs(self):
        """Debug function to print all currently opened tabs"""
        # Check server first
        self.check_server_running()

        print("[Tab Manager] Getting all currently opened tabs...", file=sys.stderr)
        try:
            tabs = asyncio.run(self.debug_tabs())
            print(f"\n[DEBUG] Found {len(tabs)} total tabs:", file=sys.stderr)
            for i, tab in enumerate(tabs, 1):
                print(f"[DEBUG] Tab {i}: ID={tab.get('id', 'N/A')}, URL='{tab.get('url', 'N/A')}', Title='{tab.get('title', 'N/A')}', Active={tab.get('active', 'N/A')}", file=sys.stderr)
        except Exception as e:
            print(f"[Tab Manager] Error getting tabs: {e}", file=sys.stderr)


def main():
    """Main entry point"""
    manager = ChatGPTTabManager()

    try:
        # Actually focus ChatGPT tab instead of just debugging
        if manager.ensure_chatgpt_tab_focused():
            print("[Tab Manager] Successfully focused ChatGPT tab!")
            return True
        else:
            print("[Tab Manager] Failed to focus ChatGPT tab.")
            return False
    except RuntimeError as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
