#!/usr/bin/env node
'use strict';

const ChatGPTProvider = require('./chatgpt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

(async () => {
  const argv = yargs(hideBin(process.argv))
    .option('prompt', { type: 'string', demandOption: true })
    .option('headless', { type: 'boolean', default: true })
    .option('remove-cache', { type: 'boolean', default: false })
    .option('debug', { type: 'boolean', default: true }) // Force debug true
    .argv;

  // Always enable debug mode for investigation
  const provider = new ChatGPTProvider({
    headless: argv.headless,
    removeCache: argv['remove-cache'],
    debug: true
  });

  try {
    await provider.initialize();
    const response = await provider.generateContent(argv.prompt);
    console.log(JSON.stringify({ response }));
    await provider.cleanup();
  } catch (err) {
    // Print full error context for debugging
    console.error('[ChatGPT CLI ERROR]', {
      message: err.message,
      stack: err.stack,
      originalError: err.originalError ? {
        message: err.originalError.message,
        stack: err.originalError.stack
      } : undefined
    });
    process.exit(1);
  }
})();
