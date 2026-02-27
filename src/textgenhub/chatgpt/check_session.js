#!/usr/bin/env node
/**
 * check_session.js - Verify login status of one or all ChatGPT sessions.
 *
 * Usage:
 *   node check_session.js                   # check all sessions
 *   node check_session.js --index 0         # check a single session
 *
 * Output (stdout): a single JSON line with the results array.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectToExistingChrome, launchControlledChromium, ensureLoggedIn } from './lib/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getSessionsFilePath() {
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join('C:\\Users', process.env.USERNAME || 'Default', 'AppData', 'Local');
    return path.join(localAppData, 'textgenhub', 'sessions.json');
  }
  const home = process.env.HOME || '/tmp';
  return path.join(home, '.local', 'share', 'textgenhub', 'sessions.json');
}

function loadSessions() {
  const sessionsPath = getSessionsFilePath();
  if (!fs.existsSync(sessionsPath)) {
    return { sessions: [] };
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

async function checkSession(session) {
  const result = {
    index: session.index,
    id: session.id,
    name: session.name || null,
    debugPort: session.debugPort,
    browserRunning: false,
    loginStatus: 'unknown',
    error: null,
    checkedAt: new Date().toISOString()
  };

  const port = session.debugPort;

  // Step 1: check if the debug port is reachable (browser running?)
  const portActive = await isPortActive(port);
  if (!portActive) {
    result.browserRunning = false;
    result.loginStatus = 'browser_not_running';
    result.error = `No browser detected on port ${port}. Session needs re-init or browser launch.`;
    return result;
  }

  result.browserRunning = true;

  // Step 2: connect via puppeteer and check login
  let browser;
  try {
    const browserURL = `http://127.0.0.1:${port}`;
    let page;
    try {
      ({ browser, page } = await connectToExistingChrome({ browserURL }));
    } catch (connectErr) {
      // Could connect to port but no ChatGPT page found — try to open one
      const puppeteer = (await import('puppeteer')).default;
      browser = await puppeteer.connect({ browserURL, defaultViewport: null });
      const pages = await browser.pages();
      if (pages.length > 0) {
        page = pages[0];
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2', timeout: 30000 });
      } else {
        page = await browser.newPage();
        await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2', timeout: 30000 });
      }
    }

    // Step 3: verify login
    try {
      await ensureLoggedIn(page);
      result.loginStatus = 'logged_in';
    } catch (loginErr) {
      result.loginStatus = 'logged_out';
      result.error = loginErr.message;
    }
  } catch (err) {
    result.loginStatus = 'error';
    result.error = err.message;
  } finally {
    if (browser) {
      try {
        await browser.disconnect();
      } catch {
        // ignore disconnect errors
      }
    }
  }

  return result;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { index: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--index') {
      out.index = parseInt(args[i + 1], 10);
      i++;
    }
  }
  return out;
}

(async function main() {
  const { index: requestedIndex } = parseArgs();
  const sessionsData = loadSessions();
  const sessions = sessionsData.sessions || [];

  if (!sessions.length) {
    const output = { results: [], error: 'No sessions found. Create one with: poetry run textgenhub sessions init' };
    console.log(JSON.stringify(output));
    process.exit(1);
  }

  let toCheck;
  if (requestedIndex !== null) {
    const match = sessions.find((s) => s.index === requestedIndex);
    if (!match) {
      const output = { results: [], error: `Session index ${requestedIndex} not found.` };
      console.log(JSON.stringify(output));
      process.exit(1);
    }
    toCheck = [match];
  } else {
    toCheck = sessions;
  }

  const results = [];
  for (const session of toCheck) {
    console.error(`[INFO] Checking session ${session.index} (port ${session.debugPort})...`);
    const result = await checkSession(session);
    results.push(result);

    // Update loginStatus in sessions.json
    const latest = loadSessions();
    const s = (latest.sessions || []).find((x) => x.index === session.index);
    if (s) {
      s.loginStatus = result.loginStatus;
      s.lastChecked = result.checkedAt;
      saveSessions(latest);
    }
  }

  // Output structured JSON on stdout
  console.log(JSON.stringify({ results }));
  process.exit(0);
})();
