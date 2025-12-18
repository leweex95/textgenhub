#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

import { connectToExistingChrome, ensureLoggedIn, launchControlledChromium } from './lib/index.js';

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
          userDataDir: getDefaultUserDataDir(),
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

async function isPortActive(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
}

async function pickAvailablePort(startPort = 9222, maxTries = 200) {
  for (let i = 0; i < maxTries; i++) {
    const port = startPort + i;
    // Treat port as available if debugging endpoint isn't responding.
    // This is simple and works well for local usage.
    // eslint-disable-next-line no-await-in-loop
    const active = await isPortActive(port);
    if (!active) {
      return port;
    }
  }
  throw new Error('Unable to find an available debug port');
}

function promptEnter(message) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}

async function waitForLogin(page, seconds) {
  const deadline = Date.now() + seconds * 1000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await ensureLoggedIn(page);
      return;
    } catch {
      // keep waiting
    }

    if (Date.now() > deadline) {
      throw new Error(`Login not detected within ${seconds} seconds`);
    }

    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { index: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--index') {
      out.index = parseInt(args[i + 1]);
      i++;
      continue;
    }
  }
  return out;
}

(async function main() {
  const { index: requestedIndex } = parseArgs();
  const sessionsData = loadSessions();
  sessionsData.sessions = sessionsData.sessions || [];

  const usedIndexes = new Set(sessionsData.sessions.map((s) => s.index));
  let nextIndex;

  if (requestedIndex !== null) {
    // If a specific index is requested, use it (will overwrite if exists)
    nextIndex = requestedIndex;
    // Remove existing session with this index if it exists
    sessionsData.sessions = sessionsData.sessions.filter((s) => s.index !== requestedIndex);
  } else {
    // Auto-assign next available index
    nextIndex = 0;
    while (usedIndexes.has(nextIndex)) {
      nextIndex++;
    }
  }

  const debugPort = await pickAvailablePort(9222);
  const id = `chatgpt-session-${Date.now()}`;
  const centralDir = getCentralSessionsDir();
  const userDataDir = path.join(centralDir, id);

  const now = new Date().toISOString();
  const newSession = {
    index: nextIndex,
    id,
    debugPort,
    userDataDir,
    createdAt: now,
    lastUsed: now,
    loginStatus: 'unknown',
    provider: 'chatgpt'
  };

  sessionsData.sessions.push(newSession);
  sessionsData.default_session = sessionsData.default_session ?? 0;
  sessionsData.metadata = sessionsData.metadata || { created: now, session_cursor: 0 };
  sessionsData.metadata.last_active_session_index = nextIndex;
  sessionsData.metadata.session_cursor = (sessionsData.metadata.session_cursor || 0) + 1;
  saveSessions(sessionsData);

  console.log(`[INFO] Created session index ${nextIndex}`);
  console.log(`[INFO] userDataDir: ${userDataDir}`);
  console.log(`[INFO] debugPort: ${debugPort}`);

  // Launch browser for login.
  const { browser, page } = await launchControlledChromium({ userDataDir, debugPort, headless: false });

  console.log('[INFO] A Chrome window should be open for this session.');
  console.log('[INFO] Please log in to ChatGPT in that window.');
  console.log('[INFO] This script will auto-detect login, or you can press Enter to force a re-check.');

  // Give the user a chance to speed things up.
  await promptEnter('Press Enter once you completed login (or just wait)... ');

  await waitForLogin(page, 15 * 60);

  // Update login status.
  const updated = loadSessions();
  const session = updated.sessions.find((s) => s.index === nextIndex);
  if (session) {
    session.loginStatus = 'logged_in';
    session.lastUsed = new Date().toISOString();
    updated.metadata.last_active_session_index = nextIndex;
    saveSessions(updated);
  }

  console.log('[INFO] Login detected. Session is ready and will be kept open.');
  console.log('[INFO] You can now run: poetry run textgenhub chatgpt --prompt "..." --session ' + nextIndex);

  // Intentionally do not close the browser.
  await browser.disconnect();
})();
