"""
Simple base provider for all text generation services.
No overengineering, just the essentials.
"""
from pathlib import Path
import subprocess
from ..utils.scrape_response import extract_response_json


class SimpleProvider:
    """Simple base class for all text generation providers"""

    def __init__(self, provider_name: str, cli_script: str):
        self.provider_name = provider_name
        self.cli_script = Path(__file__).parent.parent / provider_name / cli_script
        self.node_path = "node"

    def ask(
        self,
        prompt: str,
        headless: bool = True,
        remove_cache: bool = True,
        debug: bool = False,
        timeout: int = 120,
        typing_speed: float | None = None,
        session: int | None = None,
        close: bool = False,
    ) -> str:
        """
        Send a prompt to the provider and get a response.

        Args:
            prompt (str): The prompt to send
            headless (bool): Whether to run browser in headless mode
            remove_cache (bool): Whether to remove browser cache
            debug (bool): Whether to enable debug mode
            timeout (int): Timeout in seconds for the operation
            typing_speed (float | None): Typing speed in seconds per character (default: None for instant paste, > 0 for character-by-character typing)
            session (int | None): Specific ChatGPT session index to reuse (attach-based provider only)
            close (bool): Close the browser session after the request (attach-based provider only)

        Returns:
            str: The response from the provider
        """
        # Build command differently for the new attach-based ChatGPT CLI which
        # no longer accepts --headless or --remove-cache. For that provider,
        # only pass supported flags: --prompt, --timeout and optionally --debug.
        if self.provider_name == "chatgpt":
            cmd = [self.node_path, str(self.cli_script), "--prompt", prompt, "--timeout", str(timeout)]
            if typing_speed is not None:
                cmd.extend(["--typing-speed", str(typing_speed)])
            if debug:
                # The Node.js CLI treats presence of --debug as true
                cmd.append("--debug")
            if session is not None:
                cmd.extend(["--session", str(session)])
            if close:
                cmd.append("--close")
        else:
            # Legacy providers still accept headless/remove-cache flags
            cmd = [
                self.node_path,
                str(self.cli_script),
                "--prompt",
                prompt,
                "--headless",
                str(headless).lower(),
                "--remove-cache",
                str(remove_cache).lower(),
                "--timeout",
                str(timeout),
            ]
            if typing_speed is not None:
                cmd.extend(["--typing-speed", str(typing_speed)])
            if debug:
                # Some legacy CLIs expected a debug value; include the flag and a value
                cmd.append("--debug")
                cmd.append("true")

        stdout_json_line = None

        with subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, cwd=self.cli_script.parent) as proc:
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
            raise RuntimeError(f"{self.provider_name} script did not produce JSON response")

        return extract_response_json(stdout_json_line)
