#!/usr/bin/env node
import { argv } from 'process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToExistingChrome, launchControlledChromium, ensureLoggedIn, sendPrompt } from './lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getRepoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function getSessionsFilePath() {
  return path.join(getRepoRoot(), 'sessions.json');
}

function getDefaultUserDataDir() {
  if (process.env.CHATGPT_PROFILE) {
    return process.env.CHATGPT_PROFILE;
  }

  if (process.platform === 'win32') {
    return path.join('C:\\Users', process.env.USERNAME || 'Default', 'AppData', 'Local', 'chromium-chatgpt');
  }

  return path.join(process.env.HOME || '/tmp', '.config', 'chromium-chatgpt');
}

function getCentralSessionsDir() {
  if (process.platform === 'win32') {
    return path.join('C:\\Users', process.env.USERNAME || 'Default', 'AppData', 'Local', 'chromium-chatgpt-sessions');
  }

  return path.join(process.env.HOME || '/tmp', '.config', 'chromium-chatgpt-sessions');
}

function loadSessions() {
  const sessionsPath = getSessionsFilePath();
  if (!fs.existsSync(sessionsPath)) {
    const now = new Date().toISOString();
    const bootstrap = {
      sessions: [
        {
          index: 0,
          id: 'chatgpt-session-bootstrap',
          debugPort: 9222,
          userDataDir: getCentralSessionsDir(),
          createdAt: now,
          lastUsed: now,
          loginStatus: 'unknown',
          provider: 'chatgpt'
        }
      ],
      default_session: 0,
      metadata: {
        created: now,
        last_updated: now,
        last_active_session_index: 0,
        session_cursor: 0
      }
    };
    fs.writeFileSync(sessionsPath, JSON.stringify(bootstrap, null, 2), 'utf-8');
    return bootstrap;
  }

  return JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
}

function saveSessions(data) {
  data.metadata = data.metadata || {};
  data.metadata.last_updated = new Date().toISOString();
  fs.writeFileSync(getSessionsFilePath(), JSON.stringify(data, null, 2), 'utf-8');
}

function getSessionByIndex(data, index) {
  return (data.sessions || []).find((session) => session.index === index);
}

function resolveSessionIndex(data, explicitIndex) {
  const sessions = data.sessions || [];
  if (!sessions.length) {
    return null;
  }

  if (typeof explicitIndex === 'number') {
    return explicitIndex;
  }

  if (data.metadata && typeof data.metadata.last_active_session_index === 'number') {
    return data.metadata.last_active_session_index;
  }

  if (typeof data.default_session === 'number') {
    return data.default_session;
  }

  return [...sessions].sort((a, b) => a.index - b.index)[0].index;
}

function isChatGPTDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname === 'chatgpt.com' || hostname === 'chat.openai.com';
  } catch {
    // Invalid URL, not a ChatGPT domain
    return false;
  }
}

async function enforceSingleChatPage(browser, keepPage) {
  const pages = await browser.pages();
  for (const p of pages) {
    if (p === keepPage) {
      continue;
    }
    const url = p.url();
    if (isChatGPTDomain(url)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await p.close();
      } catch {
        // ignore
      }
    }
  }
}

function extractConversationFromUrl(url) {
  const match = url.match(/\/c\/([a-zA-Z0-9\-]+)/);
  return match ? match[1] : null;
}

function usage() {
  console.log('Usage: node bin/send-prompt-cli.js [--help|-h] --prompt|-p "Your prompt here" [--json|--html|--format|-f json|html] [--raw|-r] [--debug|-d] [--timeout|-t seconds] [--typing-speed speed] [--session INDEX] [--close|-c]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h              Show this help message');
  console.log('  --prompt, -p TEXT       The prompt to send to ChatGPT (required)');
  console.log('  --json                  Output in JSON format with events (default)');
  console.log('  --html                  Output in HTML format with events');
  console.log('  --format, -f FMT        Output format: json or html');
  console.log('  --raw, -r               Output raw text without any formatting or events');
  console.log('  --debug, -d             Enable debug output');
  console.log('  --timeout, -t SEC       Timeout in seconds (default: 120)');
  console.log('  --typing-speed SPEED    Typing speed in seconds per character (default: null for instant paste, > 0 for character-by-character typing)');
  console.log('  --session INDEX         Explicit session index to use (see: poetry run textgenhub sessions list)');
  console.log('  --close, -c             Close browser session after completion (default: keep open)');
  console.log('');
  console.log('Output Formats:');
  console.log('  Default (no flags): JSON format with connection/response events');
  console.log('  --json:             JSON format with connection/response events');
  console.log('  --html:             HTML format with connection/response events');
  console.log('  --raw:              Plain text output only (no events or formatting)');
  console.log('');
  console.log('Examples:');
  console.log('  node bin/send-prompt-cli.js --prompt "What is AI?"');
  console.log('  node bin/send-prompt-cli.js --prompt "Hello world" --html');
  console.log('  node bin/send-prompt-cli.js --raw --prompt "Complex question"');
  console.log('  node bin/send-prompt-cli.js --prompt "One-time query" --close');
  console.log('  node bin/send-prompt-cli.js --prompt "Quick test" --typing-speed 0.01');
  process.exit(2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { prompt: null, format: 'json', debug: false, timeout: 120, raw: false, closeBrowser: false, typingSpeed: null, sessionIndex: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--help' || a === '-h') {
      usage();
    }
    if (a === '--prompt' || a === '-p') {
      out.prompt = args[i + 1];
      i++;
      continue;
    }
    if (a === '--format' || a === '-f') {
      out.format = args[i + 1];
      i++;
      continue;
    }
    if (a === '--json') {
      out.format = 'json';
      continue;
    }
    if (a === '--html') {
      out.format = 'html';
      continue;
    }
    if (a === '--debug' || a === '-d') {
      out.debug = true;
      continue;
    }
    if (a === '--timeout' || a === '-t') {
      out.timeout = parseInt(args[i + 1]);
      i++;
      continue;
    }
    if (a === '--typing-speed') {
      const speedValue = args[i + 1];
      if (speedValue === 'null' || speedValue === 'None' || speedValue === '') {
        out.typingSpeed = null;
      } else {
        out.typingSpeed = parseFloat(speedValue);
      }
      i++;
      continue;
    }
    if (a === '--raw' || a === '-r') {
      out.raw = true;
      continue;
    }
    if (a === '--close' || a === '-c') {
      out.closeBrowser = true;
      continue;
    }
    if (a === '--session') {
      const parsedIndex = parseInt(args[i + 1], 10);
      if (Number.isNaN(parsedIndex)) {
        console.error('Invalid value for --session. Please provide a numeric index.');
        process.exit(2);
      }
      out.sessionIndex = parsedIndex;
      i++;
      continue;
    }
    // No positional prompts allowed - must use --prompt
    console.error(`Unknown argument: ${a}`);
    console.error('Use --prompt to specify the prompt text.');
    usage();
  }
  return out;
}

(async function main() {
  const { prompt, format, debug, timeout, raw, closeBrowser, typingSpeed, sessionIndex } = parseArgs();
  if (!prompt) return usage();

  // Validate format
  if (!['json', 'html'].includes(format)) {
    console.error(`Invalid format: ${format}. Must be 'json' or 'html'`);
    process.exit(2);
  }

  let browser, page, browserLaunched = false;
  try {
    if (!raw && format === 'json') {
      console.log(JSON.stringify({ event: 'connecting', timestamp: new Date().toISOString() }));
    }

    const sessionsData = loadSessions();
    const targetSession = resolveSessionIndex(sessionsData, sessionIndex);
    if (targetSession === null) {
      console.error('No sessions found. Create one with: node src/textgenhub/chatgpt/init_session.js');
      process.exit(1);
    }

    const selectedSession = getSessionByIndex(sessionsData, targetSession);
    if (!selectedSession) {
      console.error(`Session index ${targetSession} not found. Run: poetry run textgenhub sessions list`);
      process.exit(1);
    }

    const debugPort = selectedSession.debugPort || 9222;
    const browserURL = `http://127.0.0.1:${debugPort}`;
    const userDataDir = selectedSession.userDataDir || getDefaultUserDataDir();

    try {
      ({ browser, page } = await connectToExistingChrome({ browserURL }));
    } catch (connectError) {
      if (!raw && format === 'json') {
        console.log(JSON.stringify({ event: 'launching_chrome', timestamp: new Date().toISOString(), sessionIndex: targetSession }));
      } else if (!raw) {
        console.log(`Chrome session ${targetSession} not running, launching...`);
      }
      ({ browser, page } = await launchControlledChromium({ userDataDir, debugPort, headless: false }));
      browserLaunched = true;
    }

    try {
      await enforceSingleChatPage(browser, page);
    } catch {
      // ignore
    }

    if (!raw && format === 'json') {
      console.log(JSON.stringify({ event: 'connected', timestamp: new Date().toISOString() }));
    }

    // Ensure browser window is visible and positioned at bottom
    try {
      await page.bringToFront();
      await page.setViewport({ width: 1200, height: 800 });

      // Position window at bottom of screen
      await page.evaluate(() => {
        try {
          const screen = window.screen;
          const visibleHeight = 100;
          const y = screen.height - visibleHeight;
          const x = Math.max(0, (screen.width - 1200) / 2);
          window.moveTo(x, y);
        } catch (e) {
          // Ignore positioning errors
        }
      });
    } catch (windowError) {
      // Ignore window positioning errors
    }

    // quick login check
    try {
      await ensureLoggedIn(page);
    } catch (err) {
      if (!raw && format === 'json') {
        console.error(JSON.stringify({ event: 'login_required', message: err.message, timestamp: new Date().toISOString() }));
      } else if (!raw) {
        console.error(`Login required: ${err.message}`);
      }
      // Clean up browser connection on login error
      if (browser && closeBrowser) {
        try {
          await browser.close();
        } catch {
          // Ignore disconnect errors during cleanup
        }
      }
      process.exit(3);
    }

    // Restore last conversation if present.
    if (selectedSession.lastConversationUrl && typeof selectedSession.lastConversationUrl === 'string') {
      try {
        const currentUrl = page.url();
        if (!currentUrl.includes('/c/') || currentUrl !== selectedSession.lastConversationUrl) {
          await page.goto(selectedSession.lastConversationUrl, { waitUntil: 'networkidle2' });
        }
      } catch {
        // Ignore navigation failures.
      }
    }

    if (!raw && format === 'json') {
      console.log(JSON.stringify({ event: 'prompt_sent', prompt, timestamp: new Date().toISOString() }));
    }
    const response = await sendPrompt(page, prompt, debug, timeout, (responseLength) => {
      if (!raw && format === 'json') {
        console.log(JSON.stringify({ event: 'response_waiting', responseLength, timestamp: new Date().toISOString() }));
      } else if (!raw) {
        console.log(`Waiting for response to complete... (${responseLength} chars)`);
      }
    }, typingSpeed);

    // Persist conversation URL and session usage.
    try {
      const updated = loadSessions();
      const sessionToUpdate = getSessionByIndex(updated, targetSession);
      if (sessionToUpdate) {
        sessionToUpdate.lastUsed = new Date().toISOString();
        sessionToUpdate.loginStatus = 'logged_in';

        const url = page.url();
        const conversationId = extractConversationFromUrl(url);
        if (conversationId) {
          sessionToUpdate.lastConversationUrl = url;
          sessionToUpdate.lastConversationId = conversationId;
        }

        updated.metadata = updated.metadata || {};
        updated.metadata.last_active_session_index = targetSession;
        saveSessions(updated);
      }
    } catch {
      // ignore persistence errors
    }

    if (raw) {
      // Raw output - just the response text
      console.log(response);
    } else if (format === 'json') {
      console.log(JSON.stringify({ event: 'response_received', responseLength: response.length, response, timestamp: new Date().toISOString() }));
      // Also output in SimpleProvider expected format
      console.log(JSON.stringify({ response }));
    } else {
      // HTML format - both as formatted HTML and as JSON response
      const htmlContent = `<p>${response.replace(/\n/g, '<br>')}</p>`;
      console.log(htmlContent);
      // Also output in SimpleProvider expected format for extraction
      console.log(JSON.stringify({ response: htmlContent }));
    }

    if (closeBrowser) {
      await browser.close();
    } else {
      if (!raw) {
        console.log(JSON.stringify({ event: 'session_kept_open', message: 'Browser session remains open for future use', timestamp: new Date().toISOString() }));
      }
    }
    process.exit(0);
  } catch (error) {
    if (!raw && format === 'json') {
      console.error(JSON.stringify({ event: 'error', message: error.message, stack: error.stack }));
    } else if (!raw) {
      console.error(`Error: ${error.message}`);
    } else {
      // Raw mode - just output the error message
      console.error(error.message);
    }
    // Clean up browser connection on error
    if (browser && closeBrowser) {
      try {
        await browser.close();
      } catch {
        // Ignore disconnect errors during cleanup
      }
    }
    process.exit(1);
  }
})();
