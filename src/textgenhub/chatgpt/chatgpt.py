from pathlib import Path
import subprocess
from textgenhub.utils.scrape_response import extract_response_json

NODE_PATH = "node"
CHATGPT_CLI = Path(__file__).parent / "chatgpt_cli.js"


def ask_chatgpt(prompt: str, headless: bool = True, remove_cache: bool = True) -> str:
    stdout_json_line = None

    cmd = [
        NODE_PATH,
        str(CHATGPT_CLI),
        "--prompt", prompt,
        "--headless", str(headless).lower(),
        "--remove-cache", str(remove_cache).lower()
    ]

    with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=CHATGPT_CLI.parent) as proc:
        # first, read bytes directly and attempt to encode them in UTF-8
        if proc.stdout is not None:
            raw_bytes = proc.stdout.read()
            try:
                text = raw_bytes.decode("utf-8")
            except UnicodeDecodeError as e:
                print(f"UnicodeDecodeError at byte {e.start}, replacing invalid bytes")
                text = raw_bytes.decode("utf-8", errors="replace")

            for line in text.splitlines():
                print(line)  # shows all Node logs live
                if line.strip().startswith('{"response":'):
                    stdout_json_line = line.strip()
        else:
            raise RuntimeError("Subprocess stdout is None. Failed to capture output.")

        proc.wait()

    if not stdout_json_line:
        raise RuntimeError("Node script did not produce JSON response")

    return extract_response_json(stdout_json_line)


class ChatGPTSession:
    """
    ChatGPT session for continuous conversations
    """
    
    def __init__(self, headless: bool = True, remove_cache: bool = True):
        self.headless = headless
        self.remove_cache = remove_cache
        self.proc = None
        self.stdout_lines = []
        
    def start(self):
        """Start the ChatGPT session"""
        if self.proc is not None:
            raise RuntimeError("Session already started")
            
        cmd = [
            NODE_PATH,
            str(CHATGPT_CLI),
            "--headless", str(self.headless).lower(),
            "--remove-cache", str(self.remove_cache).lower(),
            "--continuous", "true"
        ]
        
        self.proc = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.STDOUT, 
            stdin=subprocess.PIPE,
            cwd=CHATGPT_CLI.parent
        )
        
        # Start a thread to read stdout
        import threading
        self.stdout_thread = threading.Thread(target=self._read_stdout)
        self.stdout_thread.daemon = True
        self.stdout_thread.start()
        
    def _read_stdout(self):
        """Read stdout lines in a separate thread"""
        if self.proc.stdout is None:
            return
            
        for line in iter(self.proc.stdout.readline, b''):
            try:
                text = line.decode("utf-8").strip()
                if text:
                    print(text)  # Print all output for debugging
                    self.stdout_lines.append(text)
            except UnicodeDecodeError:
                print(f"UnicodeDecodeError in session output")
                
    def send_prompt(self, prompt: str) -> str:
        """Send a prompt and get response"""
        if self.proc is None:
            raise RuntimeError("Session not started. Call start() first.")
            
        if self.proc.stdin is None:
            raise RuntimeError("Cannot send prompt: stdin not available")
            
        # Send the prompt
        self.proc.stdin.write((prompt + '\n').encode('utf-8'))
        self.proc.stdin.flush()
        
        # Wait for response
        import time
        start_time = time.time()
        timeout = 120  # 2 minutes timeout
        
        while time.time() - start_time < timeout:
            for line in self.stdout_lines:
                if line.strip().startswith('{"response":'):
                    self.stdout_lines.remove(line)
                    if not self.headless:
                        print("Debug mode (non-headless): Waiting 5 seconds after response is ready for UI inspection...")
                        time.sleep(5)
                    return extract_response_json(line.strip())
            time.sleep(0.1)
            
        raise RuntimeError("Timeout waiting for response")
        
    def close(self):
        """Close the session"""
        if self.proc:
            if self.proc.stdin:
                self.proc.stdin.close()
            self.proc.terminate()
            self.proc.wait()
            self.proc = None


def create_chatgpt_session(headless: bool = True, remove_cache: bool = True) -> ChatGPTSession:
    """
    Create a new ChatGPT session for continuous conversations
    
    Args:
        headless (bool): Whether to run browser in headless mode
        remove_cache (bool): Whether to remove browser cache when closing
        
    Returns:
        ChatGPTSession: A session object for continuous prompting
    """
    session = ChatGPTSession(headless=headless, remove_cache=remove_cache)
    session.start()
    return session


class ChatGPT:
    """
    ChatGPT interface for generating responses
    """

    def __init__(self, headless: bool = True, remove_cache: bool = True):
        self.headless = headless
        self.remove_cache = remove_cache

    def chat(self, prompt: str) -> str:
        """
        Send a prompt to ChatGPT and get a response

        Args:
            prompt (str): The prompt to send to ChatGPT

        Returns:
            str: The response from ChatGPT
        """
        return ask_chatgpt(prompt, headless=self.headless, remove_cache=self.remove_cache)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="ChatGPT CLI via Node.js wrapper")
    parser.add_argument("--prompt", type=str, required=True, help="Prompt to send to ChatGPT")
    parser.add_argument("--headless", type=lambda x: x.lower() == "true", default=True, help="Run Node in headless mode")
    parser.add_argument("--remove-cache", type=lambda x: x.lower() == "false", default=False, help="Remove cache on cleanup")
    parser.add_argument("--continuous", type=lambda x: x.lower() == "true", default=False, help="Enable continuous mode")

    args = parser.parse_args()

    resp = ask_chatgpt(args.prompt, headless=args.headless, remove_cache=args.remove_cache)
    print("Response returned from ask_chatgpt method: ", resp)
