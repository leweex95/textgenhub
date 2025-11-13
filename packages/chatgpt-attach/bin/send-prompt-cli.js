#!/usr/bin/env node
import { argv } from 'process';
import { connectToExistingChrome, launchControlledChromium, ensureLoggedIn, sendPrompt } from '../lib/index.js';

function usage() {
  console.log('Usage: node bin/send-prompt-cli.js [--help|-h] --prompt|-p "Your prompt here" [--json|--html|--format|-f json|html] [--raw|-r] [--debug|-d] [--timeout|-t seconds] [--close|-c]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h          Show this help message');
  console.log('  --prompt, -p TEXT   The prompt to send to ChatGPT (required)');
  console.log('  --json              Output in JSON format with events (default)');
  console.log('  --html              Output in HTML format with events');
  console.log('  --format, -f FMT    Output format: json or html');
  console.log('  --raw, -r           Output raw text without any formatting or events');
  console.log('  --debug, -d         Enable debug output');
  console.log('  --timeout, -t SEC   Timeout in seconds (default: 120)');
  console.log('  --close, -c         Close browser session after completion (default: keep open)');
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
  process.exit(2);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { prompt: null, format: 'json', debug: false, timeout: 120, raw: false, closeBrowser: false };
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
    if (a === '--raw' || a === '-r') {
      out.raw = true;
      continue;
    }
    if (a === '--close' || a === '-c') {
      out.closeBrowser = true;
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
  const { prompt, format, debug, timeout, raw, closeBrowser } = parseArgs();
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

    try {
      // Try to connect to existing Chrome first
      ({ browser, page } = await connectToExistingChrome());
    } catch (connectError) {
      if (!raw && format === 'json') {
        console.log(JSON.stringify({ event: 'launching_chrome', timestamp: new Date().toISOString() }));
      } else if (!raw) {
        console.log('Chrome not running, launching new instance...');
      }
      // If connection fails, launch Chrome automatically
      ({ browser, page } = await launchControlledChromium());
      browserLaunched = true;
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
      if (browser && closeBrowser && browserLaunched) {
        try {
          await browser.close();
        } catch (disconnectError) {
          // Ignore disconnect errors during cleanup
        }
      }
      process.exit(3);
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
    });

    if (raw) {
      // Raw output - just the response text
      console.log(response);
    } else if (format === 'json') {
      console.log(JSON.stringify({ event: 'response_received', responseLength: response.length, response, timestamp: new Date().toISOString() }));
    } else {
      // HTML format
      console.log(`<p>${response.replace(/\n/g, '<br>')}</p>`);
    }

    if (closeBrowser && browserLaunched) {
      await browser.close();
    } else {
      // keep open - don't close launched browsers, don't disconnect from connected browsers
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
    if (browser && closeBrowser && browserLaunched) {
      try {
        await browser.close();
      } catch (disconnectError) {
        // Ignore disconnect errors during cleanup
      }
    }
    process.exit(1);
  }
})();
