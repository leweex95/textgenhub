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
    .argv;

  const provider = new PerplexityProvider({
    headless: argv.headless,
    removeCache: argv['remove-cache'],
    debug: argv.debug
  });

  try {
    await provider.initialize();
    const response = await provider.generateContent(argv.prompt);
    console.log(JSON.stringify({ response }));
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