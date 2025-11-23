#!/usr/bin/env node
'use strict';

const PerplexityProvider = require('./perplexity');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('prompt', { type: 'string', demandOption: true })
    .option('headless', { type: 'boolean', default: true })
    .option('remove-cache', { type: 'boolean', default: false })
    .option('debug', { type: 'boolean', default: false })
    .option('output-format', { type: 'string', choices: ['json', 'html'], default: 'json' })
    .option('typing-speed', { type: 'number', default: null })
    .argv;

  const provider = new PerplexityProvider({
    headless: argv.headless,
    removeCache: argv['remove-cache'],
    debug: argv.debug
  });

  try {
    await provider.initialize();
    const response = await provider.generateContent(argv.prompt, { typingSpeed: argv['typing-speed'] });

    if (argv['output-format'] === 'html') {
      // For HTML output, try to get HTML content if available
      const html = provider.getLastHtml ? await provider.getLastHtml() : '';
      console.log(html || response);
    } else {
      // JSON output with metadata
      const html = provider.getLastHtml ? await provider.getLastHtml() : '';
      console.log(JSON.stringify({
        response,
        html
      }, null, 2));
    }

    await provider.cleanup();
  } catch (err) {
    // Always output a JSON error object for CI artifact capture
    let artifactPath = err.artifactPath || (err.originalError && err.originalError.artifactPath);
    console.log(JSON.stringify({
      error: err.message || String(err),
      stack: err.stack,
      artifactPath
    }));
    process.exit(1);
  }
})();
