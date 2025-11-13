#!/usr/bin/env node

import {
  connectToExistingChrome,
  launchControlledChromium,
  ensureLoggedIn,
  oneShotLoginFlow,
  sendPrompt
} from './index.js';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  try {
    if (command === '--connect') {
      await handleConnect(args);
    } else if (command === '--launch') {
      await handleLaunch(args);
    } else if (command === '--login') {
      await handleLogin(args);
    } else if (command === '--send') {
      await handleSend(args);
    } else {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
chatgpt-attach - ChatGPT web UI automation

Usage:
  node cli.js --connect [--url <url>] [--match <pattern>]
  node cli.js --launch [--user-data-dir <path>] [--headless]
  node cli.js --login <userDataDir>
  node cli.js --send "<prompt>" [--url <url>]

Options:
  --connect                Connect to existing Chrome at remote debugging URL
  --launch                 Launch new controlled Chromium instance
  --login <path>           Run interactive one-shot login flow
  --send "<prompt>"        Send prompt to ChatGPT (requires Chrome connection)
  --url <url>              Remote debugging URL (default: http://127.0.0.1:9222)
  --match <pattern>        URL pattern to match (default: chat.openai.com)
  --user-data-dir <path>   Chrome user data directory path
  --headless               Run browser in headless mode
`);
}

async function handleConnect(args) {
  let url = 'http://127.0.0.1:9222';
  let match = 'chat.openai.com';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    } else if (args[i] === '--match' && args[i + 1]) {
      match = args[++i];
    }
  }

  const { browser, page } = await connectToExistingChrome({
    browserURL: url,
    findUrlMatch: match
  });

  console.log('\n✓ Connected to Chrome');
  console.log(`✓ Page URL: ${page.url()}`);

  await browser.disconnect();
}

async function handleLaunch(args) {
  let userDataDir = null;
  let headless = false;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--user-data-dir' && args[i + 1]) {
      userDataDir = args[++i];
    } else if (args[i] === '--headless') {
      headless = true;
    }
  }

  const { browser, page } = await launchControlledChromium({
    userDataDir,
    headless
  });

  console.log('\n✓ Chromium launched');
  console.log(`✓ User data dir: ${userDataDir || 'default'}`);
  console.log(`✓ Page URL: ${page.url()}`);

  await browser.close();
}

async function handleLogin(args) {
  if (args.length < 2) {
    console.error('Error: --login requires a user data directory path');
    process.exit(1);
  }

  const userDataDir = args[1];
  await oneShotLoginFlow(userDataDir);
}

async function handleSend(args) {
  if (args.length < 2) {
    console.error('Error: --send requires a prompt');
    process.exit(1);
  }

  let prompt = args[1];
  let url = 'http://127.0.0.1:9222';

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      url = args[++i];
    }
  }

  const { browser, page } = await connectToExistingChrome({
    browserURL: url
  });

  const response = await sendPrompt(page, prompt);
  console.log('\n' + response);

  await browser.disconnect();
}

main().catch((error) => {
  console.error(`\n✗ Fatal error: ${error.message}`);
  process.exit(1);
});
