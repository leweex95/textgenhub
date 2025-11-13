# chatgpt-attach

Node.js automation module for driving ChatGPT's web UI using an existing Chrome user profile. Runs reliably with unfocused or minimized tabs, avoids repeated logins through session persistence, and requires no OpenAI API.

## Features

- **Chrome Profile Reuse** — Connect to existing Chrome or launch with persistent user data directory
- **Session Persistence** — One-time login; cookies and session data survive restarts
- **Reliable Automation** — Works with minimized/unfocused windows
- **Recovery** — Detects invalid sessions and prompts for re-authentication
- **Structured Logging** — JSON event logs for debugging and monitoring
- **Error Handling** — Specific error classes for different failure modes

## Installation

```bash
npm install chatgpt-attach
```

Or locally:

```bash
cd packages/chatgpt-attach
npm install
```

## Quick Start

### 1. Windows PowerShell: Launch Chrome with Remote Debugging

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\<YourUsername>\AppData\Local\chromium-profile" `
  --disable-background-timer-throttling `
  --disable-backgrounding-occluded-windows `
  --disable-renderer-backgrounding
```

Replace `<YourUsername>` with your actual Windows username.

### 2. One-Time Interactive Login

```bash
node packages/chatgpt-attach/lib/cli.js --login "C:\Users\<YourUsername>\AppData\Local\chromium-profile"
```

A browser window will open. Complete the ChatGPT login manually. Once logged in, press Enter in the terminal.

### 3. Connect and Send Prompts

```bash
# Verify connection
node packages/chatgpt-attach/lib/cli.js --connect

# Send a prompt
node packages/chatgpt-attach/lib/cli.js --send "Hello, ChatGPT!"
```

## CLI Usage

### Connect to Existing Chrome

```bash
node lib/cli.js --connect [--url <url>] [--match <pattern>]
```

- `--url` — Remote debugging URL (default: `http://127.0.0.1:9222`)
- `--match` — URL pattern to match (default: `chat.openai.com`)

### Launch Controlled Chromium

```bash
node lib/cli.js --launch [--user-data-dir <path>] [--headless]
```

- `--user-data-dir` — Path to Chrome user data directory
- `--headless` — Run in headless mode

### Run One-Shot Login

```bash
node lib/cli.js --login <userDataDir>
```

### Send a Prompt

```bash
node lib/cli.js --send "<prompt>" [--url <url>]
```

## API

### `connectToExistingChrome({ browserURL, findUrlMatch })`

Connect to a running Chrome instance with remote debugging enabled.

**Parameters:**
- `browserURL` (string, optional) — Remote debugging URL (default: `http://127.0.0.1:9222`)
- `findUrlMatch` (string, optional) — URL pattern to match (default: `chat.openai.com`)

**Returns:** `{ browser, page }` — Puppeteer browser and page objects

**Throws:** `NoPageError` if ChatGPT page not found

```javascript
import { connectToExistingChrome } from 'chatgpt-attach';

const { browser, page } = await connectToExistingChrome();
console.log(page.url());
await browser.disconnect();
```

### `launchControlledChromium({ userDataDir, disableThrottlingFlags, headless })`

Launch a new Chromium instance with persistent user profile.

**Parameters:**
- `userDataDir` (string, optional) — Path to user data directory
- `disableThrottlingFlags` (boolean, optional) — Apply throttling-disable flags (default: `true`)
- `headless` (boolean, optional) — Run in headless mode (default: `false`)

**Returns:** `{ browser, page }` — Browser and page objects

```javascript
import { launchControlledChromium } from 'chatgpt-attach';

const { browser, page } = await launchControlledChromium({
  userDataDir: 'C:\\path\\to\\profile',
  headless: false
});
```

### `ensureLoggedIn(page)`

Verify that ChatGPT is logged in by checking DOM and auth session.

**Parameters:**
- `page` — Puppeteer page object

**Returns:** `true` if logged in

**Throws:**
- `LoginRequiredError` if redirected to login page
- `SessionInvalidError` if session data is invalid

```javascript
import { ensureLoggedIn } from 'chatgpt-attach';

try {
  await ensureLoggedIn(page);
  console.log('Logged in!');
} catch (error) {
  console.error(error.message);
}
```

### `oneShotLoginFlow(userDataDir)`

Launch browser and prompt user to log in manually. Saves session to disk.

**Parameters:**
- `userDataDir` (string) — Path to user data directory where session persists

**Returns:** `true` on success

**Throws:** Any automation error during login

```javascript
import { oneShotLoginFlow } from 'chatgpt-attach';

try {
  await oneShotLoginFlow('C:\\path\\to\\profile');
  console.log('Login complete. Session persisted.');
} catch (error) {
  console.error('Login failed:', error.message);
}
```

### `sendPrompt(page, prompt)`

Submit a prompt and wait for ChatGPT's response.

**Parameters:**
- `page` — Puppeteer page object
- `prompt` (string) — The prompt text

**Returns:** `string` — Full ChatGPT response text

**Throws:**
- `LoginRequiredError` if not logged in
- `SessionInvalidError` if session is invalid
- `ScrapeError` if response extraction fails

```javascript
import { sendPrompt } from 'chatgpt-attach';

try {
  const response = await sendPrompt(page, 'What is Node.js?');
  console.log(response);
} catch (error) {
  console.error(error.message);
}
```

### `scrapeResponse(page)`

Extract the final visible ChatGPT response from the page.

**Parameters:**
- `page` — Puppeteer page object

**Returns:** `string` — Response text

**Throws:** `ScrapeError` if extraction fails

```javascript
import { scrapeResponse } from 'chatgpt-attach';

const text = await scrapeResponse(page);
console.log(text);
```

## Error Classes

### `NoPageError`

Thrown when ChatGPT tab cannot be found in the browser.

```javascript
import { NoPageError } from 'chatgpt-attach';

try {
  const { page } = await connectToExistingChrome();
} catch (error) {
  if (error instanceof NoPageError) {
    console.log('Open ChatGPT in your browser first!');
  }
}
```

### `LoginRequiredError`

Thrown when the page redirects to login (session invalid or expired).

```javascript
import { LoginRequiredError } from 'chatgpt-attach';

try {
  await ensureLoggedIn(page);
} catch (error) {
  if (error instanceof LoginRequiredError) {
    await oneShotLoginFlow(userDataDir);
  }
}
```

### `SessionInvalidError`

Thrown when the auth API reports invalid session data.

### `ScrapeError`

Thrown when response text cannot be extracted from the page.

## Event Logging

All operations emit structured JSON logs. Subscribe using the global logger:

```javascript
import { globalLogger } from 'chatgpt-attach';

globalLogger.on('connected', (data) => {
  console.log('Connected:', data);
});

globalLogger.on('login_required', () => {
  console.log('Login needed!');
});

globalLogger.on('prompt_sent', (data) => {
  console.log('Prompt sent:', data.prompt);
});

globalLogger.on('response_received', (data) => {
  console.log('Response length:', data.responseLength);
});

globalLogger.on('session_invalid', () => {
  console.log('Session expired');
});
```

## Session Persistence & Reauth

### How It Works

1. **First Run:** Launch Chrome, complete login manually, cookies are saved to `userDataDir`
2. **Subsequent Runs:** Open Chrome with same `--user-data-dir`; session is automatically restored
3. **Reauth Detection:** If `/api/auth/session` returns invalid data or page redirects to `/auth/login`, `LoginRequiredError` or `SessionInvalidError` is thrown
4. **Recovery:** Call `oneShotLoginFlow(userDataDir)` again to re-login and update cookies

### Windows PowerShell Example

```powershell
$profile = "C:\Users\csibi\AppData\Local\chromium-profile"

# First time: interactive login
node lib/cli.js --login $profile

# Later: reuse session
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir=$profile `
  --disable-background-timer-throttling `
  --disable-backgrounding-occluded-windows `
  --disable-renderer-backgrounding

# In another terminal
node lib/cli.js --send "Hi ChatGPT!"
```

## Chrome Flags Explained

| Flag | Purpose |
|------|---------|
| `--remote-debugging-port=9222` | Enable remote protocol for Puppeteer connection |
| `--user-data-dir=<path>` | Persist cookies, session, extensions to this path |
| `--disable-background-timer-throttling` | Prevent DOM throttling when tab is backgrounded |
| `--disable-backgrounding-occluded-windows` | Keep rendering active when window is minimized |
| `--disable-renderer-backgrounding` | Prevent renderer process throttling |
| `--disable-ipc-flooding-protection` | Avoid IPC message drops during heavy automation |

## Troubleshooting

### "ChatGPT page not found"

**Cause:** No open ChatGPT tab or wrong debugging URL

**Fix:**
1. Open `https://chat.openai.com` in Chrome
2. Verify Chrome is running with `--remote-debugging-port=9222`
3. Check localhost:9222 in browser to see connected pages

### "Session is invalid or expired"

**Cause:** Session cookies expired or were cleared

**Fix:**
```bash
node lib/cli.js --login "C:\path\to\profile"
```

### "Browser closed unexpectedly"

**Cause:** Process crash or system resource exhaustion

**Fix:**
- Restart Chrome
- Check available memory
- Try headless mode: `--headless`

### Timeout during prompt

**Cause:** Network latency or ChatGPT server slow

**Fix:** Increase timeout in `sendPrompt` or check internet connection

## Testing

```bash
cd packages/chatgpt-attach
npm install
npm test
```

## Requirements

- Node.js >= 18.0.0
- Chrome or Chromium browser
- Windows PowerShell (for examples) or equivalent shell
- Active internet connection for ChatGPT

## Non-Goals / Constraints

- No OpenAI API usage
- No stealth mode beyond natural browser behavior
- No official authentication bypass
- Free and local only
- Windows Chrome profile reuse required

## License

ISC
