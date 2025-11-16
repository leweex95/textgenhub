#!/usr/bin/env node
'use strict';

const { spawn } = require('child_process');
const path = require('path');

function parseArgs(argv) {
  const args = { prompt: '', debug: false, timeout: 120 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt' || a === '-p') { args.prompt = argv[++i] || ''; continue; }
    if (a === '--debug') { args.debug = (argv[++i] || 'false').toString().toLowerCase() === 'true'; continue; }
    if (a === '--headless') { /* ignored for attach */ i++; continue; }
    if (a === '--remove-cache') { /* ignored for attach */ i++; continue; }
    if (a === '--timeout' || a === '-t') { args.timeout = parseInt(argv[++i] || '120', 10); continue; }
  }
  #!/usr/bin/env node
  'use strict';

  const { spawn } = require('child_process');
  const path = require('path');

  function parseArgs(argv) {
    const args = { prompt: '', debug: false, timeout: 120 };
    for (let i = 2; i < argv.length; i++) {
      const a = argv[i];
      if (a === '--prompt' || a === '-p') { args.prompt = argv[++i] || ''; continue; }
      if (a === '--debug') { args.debug = (argv[++i] || 'false').toString().toLowerCase() === 'true'; continue; }
      if (a === '--headless') { /* ignored for attach */ i++; continue; }
      if (a === '--remove-cache') { /* ignored for attach */ i++; continue; }
      if (a === '--timeout' || a === '-t') { args.timeout = parseInt(argv[++i] || '120', 10); continue; }
    }
    if (!args.prompt) {
      console.error('Missing --prompt');
      process.exit(2);
    }
    return args;
  }

  (function main() {
    const { prompt, debug, timeout } = parseArgs(process.argv);

    // Resolve path to packages/chatgpt-attach bin script
    const cliPath = path.resolve(__dirname, '../../../packages/chatgpt-attach/bin/send-prompt-cli.js');
    const cliCwd = path.resolve(__dirname, '../../../packages/chatgpt-attach');

    const child = spawn(process.execPath, [cliPath, '--prompt', prompt, '--json', '--timeout', String(timeout)].concat(debug ? ['--debug'] : []), {
      cwd: cliCwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let capturedResponse = null;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stdoutBuffer += text;
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj && obj.event === 'response_received' && typeof obj.response === 'string') {
            capturedResponse = obj.response;
          }
        } catch (_e) {
          // ignore non-JSON lines
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrBuffer += chunk.toString('utf8');
    });

    child.on('close', (code) => {
      if (code === 0) {
        if (capturedResponse && capturedResponse.length > 0) {
          console.log(JSON.stringify({ response: capturedResponse }));
          process.exit(0);
        }
        // Fallback: try to take last non-empty line as response
        const lines = stdoutBuffer.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        const lastLine = lines[lines.length - 1] || '';
        if (lastLine) {
          console.log(JSON.stringify({ response: lastLine }));
          process.exit(0);
        }
        console.log(JSON.stringify({ error: 'no response from attach cli' }));
        process.exit(1);
      } else {
        let errMsg = 'attach cli failed';
        try {
          // Try to parse last stderr line as JSON error
          const errLines = stderrBuffer.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
          const last = errLines[errLines.length - 1];
          if (last) {
            const obj = JSON.parse(last);
            if (obj && obj.event === 'error' && obj.message) {
              errMsg = obj.message;
            }
          }
        } catch (_) {
          // ignore
        }
        console.log(JSON.stringify({ error: errMsg }));
        process.exit(1);
      }
    });
  })();
