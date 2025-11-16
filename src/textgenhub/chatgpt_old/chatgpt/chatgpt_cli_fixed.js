#!/usr/bin/env node
'use strict';

// Clean wrapper that delegates to packages/chatgpt-attach/bin/send-prompt-cli.js
const { spawn } = require('child_process');
const path = require('path');

function parseArgs(argv) {
  const args = { prompt: null, headless: true, debug: false, outputFormat: 'json' };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--prompt' || a === '-p') { args.prompt = argv[i + 1]; i++; continue; }
    if (a === '--headless') { args.headless = true; continue; }
    if (a === '--no-headless') { args.headless = false; continue; }
    if (a === '--debug') { args.debug = true; continue; }
    if (a === '--output-format') { args.outputFormat = argv[i + 1]; i++; continue; }
  }
  if (!args.prompt) {
    console.error('Usage: chatgpt_cli.js --prompt "..." [--output-format json|html]');
    process.exit(2);
  }
  return args;
}

(function main() {
  const { prompt, outputFormat, debug } = parseArgs(process.argv);

  // Delegate to packages/chatgpt-attach CLI and normalize output
  const attachCli = path.resolve(__dirname, '..', '..', '..', 'packages', 'chatgpt-attach', 'bin', 'send-prompt-cli.js');

  const args = [attachCli, '--prompt', prompt];
  if (outputFormat === 'html') args.push('--html');
  if (debug) args.push('--debug');

  const node = process.execPath;
  const child = spawn(node, args, { stdio: ['ignore', 'pipe', 'pipe'] });

  let finalResponse = '';
  let htmlContent = '';

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const data = JSON.parse(trimmed);
        if (data && data.event === 'response_received') {
          finalResponse = data.response || '';
        }
      } catch (_) {
        // Non-JSON line (ignored in json mode)
        if (outputFormat === 'html') {
          htmlContent += trimmed + '\n';
        }
      }
    }
  });

  let stderrBuf = '';
  child.stderr.on('data', (chunk) => { stderrBuf += chunk.toString('utf8'); });

  child.on('close', (code) => {
    if (code !== 0 && !finalResponse) {
      console.error(stderrBuf || `attach CLI exited with code ${code}`);
      process.exit(code || 1);
    }
    const out = { response: finalResponse };
    if (outputFormat === 'html') out.html = htmlContent;
    console.log(JSON.stringify(out));
    process.exit(0);
  });
})();
